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
            content: `Analyze this contract and extract all problematic clauses:\n\n${document.content_text}` 
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
      
      if (response.status === 429) {
        throw new Error('Rate limit exceeded. Please try again later.');
      }
      if (response.status === 402) {
        throw new Error('AI usage limit reached. Please add credits to continue.');
      }
      throw new Error('AI analysis failed');
    }

    const aiResponse = await response.json();
    console.log('AI response received');

    const toolCall = aiResponse.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) {
      throw new Error('No tool call in AI response');
    }

    const findings = JSON.parse(toolCall.function.arguments).findings;
    console.log(`Extracted ${findings.length} findings`);

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
      throw findingsError;
    }

    // Update review status
    const { error: updateError } = await supabase
      .from('contract_reviews')
      .update({ 
        status: 'completed',
        analysis_results: { 
          total_findings: findings.length,
          high_risk: findings.filter((f: any) => f.risk_level === 'high').length,
          medium_risk: findings.filter((f: any) => f.risk_level === 'medium').length,
          low_risk: findings.filter((f: any) => f.risk_level === 'low').length
        }
      })
      .eq('id', review.id);

    if (updateError) {
      console.error('Error updating review:', updateError);
      throw updateError;
    }

    console.log('Contract analysis completed successfully');

    return new Response(
      JSON.stringify({ 
        success: true, 
        reviewId: review.id,
        findings: findings.length
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