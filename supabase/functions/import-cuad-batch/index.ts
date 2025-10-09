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
    const { contracts } = await req.json();
    
    if (!contracts || !Array.isArray(contracts)) {
      throw new Error('contracts array is required');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY')!;

    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log(`Processing ${contracts.length} CUAD contracts`);

    const results = {
      processed: 0,
      failed: 0,
      errors: [] as string[]
    };

    // Process contracts in batches
    for (const contract of contracts) {
      try {
        const { filename, content, clauseType } = contract;

        if (!content || content.length < 50) {
          console.log(`Skipping ${filename}: content too short`);
          continue;
        }

        // Extract key clauses from the contract using AI
        const extractResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${lovableApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'google/gemini-2.5-flash',
            messages: [
              { 
                role: 'system', 
                content: 'Extract important contract clauses from the provided text. Focus on identifying distinct, meaningful clauses related to liability, termination, IP, warranties, indemnification, and other key contract terms.' 
              },
              { 
                role: 'user', 
                content: `Extract key clauses from this contract:\n\n${content}` 
              }
            ],
            tools: [{
              type: 'function',
              function: {
                name: 'extract_clauses',
                parameters: {
                  type: 'object',
                  properties: {
                    clauses: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: {
                          type: { type: 'string' },
                          text: { type: 'string' },
                          is_favorable: { type: 'boolean' }
                        },
                        required: ['type', 'text', 'is_favorable']
                      }
                    }
                  },
                  required: ['clauses']
                }
              }
            }],
            tool_choice: { type: 'function', function: { name: 'extract_clauses' } }
          })
        });

        if (!extractResponse.ok) {
          results.failed++;
          results.errors.push(`${filename}: AI extraction failed`);
          continue;
        }

        const extractData = await extractResponse.json();
        const toolCall = extractData.choices?.[0]?.message?.tool_calls?.[0];
        
        if (!toolCall) {
          results.failed++;
          results.errors.push(`${filename}: No clauses extracted`);
          continue;
        }

        const clauses = JSON.parse(toolCall.function.arguments).clauses;

        // Generate embeddings for each clause
        for (const clause of clauses) {
          const embeddingResponse = await fetch('https://ai.gateway.lovable.dev/v1/embeddings', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${lovableApiKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model: 'text-embedding-3-small',
              input: clause.text
            })
          });

          if (!embeddingResponse.ok) {
            console.error(`Failed to generate embedding for clause in ${filename}`);
            continue;
          }

          const embeddingData = await embeddingResponse.json();
          const embedding = embeddingData.data[0].embedding;

          // Insert into benchmark_clauses
          const { error: insertError } = await supabase
            .from('benchmark_clauses')
            .insert({
              clause_type: clause.type || clauseType || 'general',
              clause_text: clause.text,
              source_document: filename,
              industry: extractIndustry(filename),
              is_favorable: clause.is_favorable,
              metadata: {
                original_filename: filename,
                extraction_date: new Date().toISOString()
              },
              embedding
            });

          if (insertError) {
            console.error(`Error inserting clause from ${filename}:`, insertError);
          }
        }

        results.processed++;
        console.log(`Processed ${filename}: ${clauses.length} clauses`);

      } catch (error) {
        results.failed++;
        results.errors.push(`${contract.filename}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        console.error(`Error processing ${contract.filename}:`, error);
      }

      // Add small delay to avoid rate limits
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    console.log(`Import completed: ${results.processed} processed, ${results.failed} failed`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        results 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );
  } catch (error) {
    console.error('Error in import-cuad-batch:', error);
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

function extractIndustry(filename: string): string | null {
  const industries = [
    'technology', 'healthcare', 'finance', 'retail', 'manufacturing',
    'real estate', 'telecommunications', 'energy', 'media', 'automotive'
  ];
  
  const lower = filename.toLowerCase();
  for (const industry of industries) {
    if (lower.includes(industry)) {
      return industry;
    }
  }
  
  return null;
}