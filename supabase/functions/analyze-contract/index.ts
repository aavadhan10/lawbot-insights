import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.74.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { documentId } = await req.json();
    
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

    // For very large documents, truncate to first 50,000 characters to avoid timeouts
    const MAX_CHARS = 50000;
    let contentToAnalyze = document.content_text || '';
    let wasTruncated = false;
    
    if (contentToAnalyze.length > MAX_CHARS) {
      console.log(`Document too large (${contentToAnalyze.length} chars), truncating to ${MAX_CHARS}`);
      contentToAnalyze = contentToAnalyze.substring(0, MAX_CHARS);
      wasTruncated = true;
    }

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

    // Start background analysis task
    const backgroundAnalysis = async () => {
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

        console.log('Sending to AI for analysis...');
        const startTime = Date.now();

        const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${lovableApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'google/gemini-2.5-flash',
            messages: [
              { role: 'system', content: systemPrompt },
              { 
                role: 'user', 
                content: `Analyze this contract and extract all problematic clauses${wasTruncated ? ' (analyzing first 50,000 characters)' : ''}:\n\n${contentToAnalyze}` 
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
                          clause_title: { 
                            type: 'string',
                            description: 'Title describing the clause type (e.g., "Unlimited Liability Clause", "Termination for Convenience")'
                          },
                          clause_text: { 
                            type: 'string',
                            description: 'The full text of the relevant clause from the contract'
                          },
                          risk_level: { 
                            type: 'string', 
                            enum: ['high', 'medium', 'low'],
                            description: 'Risk assessment level'
                          },
                          issue_description: { 
                            type: 'string',
                            description: 'Detailed explanation of why this clause is problematic and what risks it poses'
                          },
                          recommendation: { 
                            type: 'string',
                            description: 'Specific actionable recommendation for addressing this issue'
                          },
                          original_text: { 
                            type: 'string',
                            description: 'The exact problematic text that should be modified'
                          },
                          suggested_text: { 
                            type: 'string',
                            description: 'The recommended replacement text that addresses the issue'
                          }
                        },
                        required: [
                          'clause_title',
                          'clause_text',
                          'risk_level',
                          'issue_description',
                          'recommendation',
                          'original_text',
                          'suggested_text'
                        ]
                      }
                    }
                  },
                  required: ['findings']
                }
              }
            }],
            tool_choice: { type: 'function', function: { name: 'extract_clause_findings' } }
          })
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error('AI gateway error:', response.status, errorText);
          
          // Update review status to failed
          await supabase
            .from('contract_reviews')
            .update({ status: 'failed' })
            .eq('id', review.id);
          
          return;
        }

        const aiResponse = await response.json();
        const duration = ((Date.now() - startTime) / 1000).toFixed(2);
        console.log(`AI response received in ${duration}s`);

        const toolCall = aiResponse.choices?.[0]?.message?.tool_calls?.[0];
        if (!toolCall) {
          console.error('No tool call in AI response:', JSON.stringify(aiResponse).substring(0, 500));
          await supabase
            .from('contract_reviews')
            .update({ status: 'failed' })
            .eq('id', review.id);
          return;
        }

        const findings = JSON.parse(toolCall.function.arguments).findings;
        console.log(`Extracted ${findings.length} findings${wasTruncated ? ' (from truncated document)' : ''}`);

        // Insert findings into database
        const findingsToInsert = findings.map((finding: any) => ({
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

        // Update review status
        await supabase
          .from('contract_reviews')
          .update({ 
            status: 'completed',
            analysis_results: { 
              total_findings: findings.length,
              high_risk: findings.filter((f: any) => f.risk_level === 'high').length,
              medium_risk: findings.filter((f: any) => f.risk_level === 'medium').length,
              low_risk: findings.filter((f: any) => f.risk_level === 'low').length,
              was_truncated: wasTruncated,
              analyzed_chars: contentToAnalyze.length,
              total_chars: document.content_text?.length || 0,
              processing_time_seconds: parseFloat(duration)
            }
          })
          .eq('id', review.id);

        console.log('Contract analysis completed successfully');
      } catch (error) {
        console.error('Background analysis error:', error);
        await supabase
          .from('contract_reviews')
          .update({ status: 'failed' })
          .eq('id', review.id);
      }
    };

    // Start background task (don't await)
    backgroundAnalysis();

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