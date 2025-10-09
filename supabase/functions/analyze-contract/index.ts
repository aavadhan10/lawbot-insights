import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.74.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Helper to chunk text at sentence boundaries
function chunkText(text: string, maxChars: number): string[] {
  if (text.length <= maxChars) return [text];
  
  const chunks: string[] = [];
  let start = 0;
  
  while (start < text.length) {
    let end = Math.min(start + maxChars, text.length);
    
    // Try to break at sentence boundary
    if (end < text.length) {
      const lastPeriod = text.lastIndexOf('. ', end);
      const lastNewline = text.lastIndexOf('\n\n', end);
      const breakPoint = Math.max(lastPeriod, lastNewline);
      if (breakPoint > start + maxChars * 0.7) {
        end = breakPoint + 1;
      }
    }
    
    chunks.push(text.substring(start, end));
    start = end;
  }
  
  return chunks;
}

// Helper to call AI with retries and timeout
async function callAIWithRetry(
  url: string,
  payload: any,
  lovableApiKey: string,
  maxRetries = 2
): Promise<any> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 45000); // 45s timeout
    
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${lovableApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`AI gateway error ${response.status}: ${errorText.substring(0, 200)}`);
      }
      
      // Parse JSON manually to catch incomplete responses
      const text = await response.text();
      try {
        return JSON.parse(text);
      } catch (parseError) {
        console.error(`JSON parse error (attempt ${attempt + 1}), first 300 chars:`, text.substring(0, 300));
        throw new Error('Invalid JSON response from AI');
      }
    } catch (error) {
      clearTimeout(timeoutId);
      
      if (attempt === maxRetries) throw error;
      
      // Exponential backoff
      const delay = Math.pow(2, attempt) * 1000;
      console.log(`Attempt ${attempt + 1} failed, retrying in ${delay}ms...`, error);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  throw new Error('All retry attempts failed');
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { documentId, mode = 'quick' } = await req.json();
    
    if (!documentId) {
      throw new Error('documentId is required');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY')!;

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get auth header and create client with user context
    const authHeader = req.headers.get('Authorization');
    const token = authHeader?.replace('Bearer ', '');
    const { data: { user } } = await supabase.auth.getUser(token);

    if (!user) {
      throw new Error('Unauthorized');
    }

    console.log('Analyzing contract for document:', documentId);

    // Fetch document
    const { data: document, error: docError } = await supabase
      .from('documents')
      .select('*')
      .eq('id', documentId)
      .single();

    if (docError || !document) {
      throw new Error('Document not found');
    }

    console.log('Document fetched, length:', document.content_text?.length || 0);

    // Set limits and behavior based on mode
    const MODEL = 'google/gemini-2.5-flash'; // Always use flash for reliability
    let contentToAnalyze = document.content_text || '';
    let wasTruncated = false;
    const chunks: string[] = [];
    
    if (mode === 'quick') {
      // Quick mode: simple truncation, single chunk, fast
      const MAX_CHARS = 30000;
      if (contentToAnalyze.length > MAX_CHARS) {
        console.log(`Quick mode: truncating ${contentToAnalyze.length} chars to ${MAX_CHARS}`);
        contentToAnalyze = contentToAnalyze.substring(0, MAX_CHARS);
        wasTruncated = true;
      }
      chunks.push(contentToAnalyze);
    } else {
      // Thorough mode: chunk for large docs
      const CHUNK_SIZE = 15000;
      if (contentToAnalyze.length > 35000) {
        console.log(`Thorough mode: chunking ${contentToAnalyze.length} chars into ~${CHUNK_SIZE} char chunks`);
        chunks.push(...chunkText(contentToAnalyze, CHUNK_SIZE));
      } else {
        chunks.push(contentToAnalyze);
      }
    }
    
    console.log(`Processing in ${chunks.length} chunk(s) using ${MODEL} (${mode} mode)`);

    // Create contract review record
    const { data: review, error: reviewError } = await supabase
      .from('contract_reviews')
      .insert({
        document_id: documentId,
        user_id: user.id,
        organization_id: document.organization_id,
        status: 'processing'
      })
      .select()
      .single();

    if (reviewError) {
      console.error('Error creating review:', reviewError);
      throw reviewError;
    }

    console.log('Created review:', review.id);

    // Background analysis with EdgeRuntime.waitUntil
    const backgroundAnalysis = async () => {
      const startTime = Date.now();
      const allFindings: any[] = [];
      
      try {
        // Analyze contract with AI
        const systemPrompt = `You are an expert legal contract reviewer specializing in identifying risks and providing actionable recommendations. 

Analyze the provided contract and extract ALL problematic clauses. For each issue, provide:
- A clear title describing the clause type
- The exact text of the problematic clause
- Risk level assessment (high/medium/low) based on:
  * HIGH: Unlimited liability, unfavorable termination, missing critical protections (data privacy, IP rights)
  * MEDIUM: Moderate concerns, negotiable terms, standard but unfavorable language
  * LOW: Minor issues, non-standard but acceptable terms
- A detailed explanation of why it's problematic
- A specific recommendation with exact suggested replacement text
- Reference to market standards when applicable

Focus on common contract issues:
- Liability and indemnification clauses
- Termination and renewal terms
- Intellectual property rights
- Data protection and privacy
- Warranties and representations
- Payment and pricing terms
- Confidentiality obligations
- Dispute resolution
- Force majeure
- Assignment and change of control

Be thorough and extract all issues, not just the most critical ones.`;

        // Process each chunk
        for (let i = 0; i < chunks.length; i++) {
          const chunkStartTime = Date.now();
          console.log(`Processing chunk ${i + 1}/${chunks.length}...`);
          
          const chunkContent = chunks[i];
          let chunkFindings: any[] = [];
          
          // Call AI with retries
          try {
            const payload = {
              model: MODEL,
              messages: [
                { role: 'system', content: systemPrompt },
                { 
                  role: 'user', 
                  content: `Analyze this contract ${chunks.length > 1 ? `(part ${i + 1}/${chunks.length})` : ''}:\n\n${chunkContent}` 
                }
              ],
              tools: [{
                type: 'function',
                function: {
                  name: 'extract_clause_findings',
                  description: 'Extract all problematic clauses from the contract with detailed analysis',
                  parameters: {
                    type: 'object',
                    properties: {
                      findings: {
                        type: 'array',
                        items: {
                          type: 'object',
                          properties: {
                            clause_title: { type: 'string' },
                            clause_text: { type: 'string' },
                            risk_level: { type: 'string', enum: ['high', 'medium', 'low'] },
                            issue_description: { type: 'string' },
                            recommendation: { type: 'string' },
                            original_text: { type: 'string' },
                            suggested_text: { type: 'string' }
                          },
                          required: ['clause_title', 'clause_text', 'risk_level', 'issue_description', 'recommendation', 'original_text', 'suggested_text']
                        }
                      }
                    },
                    required: ['findings']
                  }
                }
              }],
              tool_choice: { type: 'function', function: { name: 'extract_clause_findings' } }
            };
            
            const aiResponse = await callAIWithRetry('https://ai.gateway.lovable.dev/v1/chat/completions', payload, lovableApiKey);
            
            const toolCall = aiResponse.choices?.[0]?.message?.tool_calls?.[0];
            if (toolCall?.function?.arguments) {
              chunkFindings = JSON.parse(toolCall.function.arguments).findings || [];
            } else {
              // Fallback: try parsing inline JSON from content
              const content = aiResponse.choices?.[0]?.message?.content || '';
              const jsonMatch = content.match(/\{[\s\S]*"findings"[\s\S]*\}/);
              if (jsonMatch) {
                chunkFindings = JSON.parse(jsonMatch[0]).findings || [];
              }
            }
          } catch (error) {
            console.error(`Chunk ${i + 1} failed:`, error);
            // For quick mode on first chunk failure, just fail fast
            if (mode === 'quick' && i === 0) {
              throw error;
            }
            // For thorough mode or later chunks, continue with empty findings for this chunk
            chunkFindings = [];
          }
          
          allFindings.push(...chunkFindings);
          const chunkDuration = ((Date.now() - chunkStartTime) / 1000).toFixed(2);
          console.log(`Chunk ${i + 1} done in ${chunkDuration}s: ${chunkFindings.length} findings`);
          
          // Update progress
          const progress = Math.round(((i + 1) / chunks.length) * 100);
          await supabase
            .from('contract_reviews')
            .update({
              analysis_results: {
                progress_percent: progress,
                processed_chunks: i + 1,
                total_chunks: chunks.length,
                total_findings: allFindings.length,
                high_risk: allFindings.filter(f => f.risk_level === 'high').length,
                medium_risk: allFindings.filter(f => f.risk_level === 'medium').length,
                low_risk: allFindings.filter(f => f.risk_level === 'low').length
              }
            })
            .eq('id', review.id);
        }

        console.log(`Extracted total ${allFindings.length} findings from ${chunks.length} chunk(s)`);

        // Insert findings into database
        const findingsToInsert = allFindings.map((finding: any) => ({
          review_id: review.id,
          clause_title: finding.clause_title,
          clause_text: finding.clause_text,
          risk_level: finding.risk_level,
          issue_description: finding.issue_description,
          recommendation: finding.recommendation,
          original_text: finding.original_text,
          suggested_text: finding.suggested_text,
          benchmark_data: {},
          status: 'pending'
        }));

        const { error: findingsError } = await supabase
          .from('clause_findings')
          .insert(findingsToInsert);

        if (findingsError) {
          console.error('Error inserting findings:', findingsError);
          await supabase
            .from('contract_reviews')
            .update({ status: 'failed' })
            .eq('id', review.id);
          return;
        }

        // Update review status - final
        const totalDuration = ((Date.now() - startTime) / 1000).toFixed(2);
        await supabase
          .from('contract_reviews')
          .update({ 
            status: 'completed',
            analysis_results: { 
              total_findings: allFindings.length,
              high_risk: allFindings.filter((f: any) => f.risk_level === 'high').length,
              medium_risk: allFindings.filter((f: any) => f.risk_level === 'medium').length,
              low_risk: allFindings.filter((f: any) => f.risk_level === 'low').length,
              was_truncated: wasTruncated,
              was_chunked: chunks.length > 1,
              total_chunks: chunks.length,
              analyzed_chars: chunks.reduce((sum, c) => sum + c.length, 0),
              total_chars: document.content_text?.length || 0,
              processing_time_seconds: parseFloat(totalDuration),
              mode: mode
            }
          })
          .eq('id', review.id);

        console.log(`Contract analysis completed in ${totalDuration}s`);
      } catch (error) {
        console.error('Background analysis error:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        await supabase
          .from('contract_reviews')
          .update({ 
            status: 'failed',
            analysis_results: {
              error_message: errorMessage,
              failed_at: new Date().toISOString(),
              mode: mode
            }
          })
          .eq('id', review.id);
      }
    };

    // Use EdgeRuntime.waitUntil for reliable background execution
    try {
      // @ts-ignore - EdgeRuntime is available in Deno deploy
      const runtime = globalThis as any;
      if (runtime.EdgeRuntime && runtime.EdgeRuntime.waitUntil) {
        runtime.EdgeRuntime.waitUntil(backgroundAnalysis());
      } else {
        // Fallback for local development
        backgroundAnalysis();
      }
    } catch {
      // Fallback if EdgeRuntime not available
      backgroundAnalysis();
    }

    // Return immediately
    return new Response(
      JSON.stringify({ 
        success: true, 
        reviewId: review.id,
        message: 'Analysis started in background'
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );
  } catch (error) {
    console.error('Error in analyze-contract:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});