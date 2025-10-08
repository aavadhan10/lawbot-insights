import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.74.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CUADContract {
  title: string;
  paragraphs: string[];
  qa: Array<{
    question: string;
    answers: string[];
    is_impossible: boolean;
  }>;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { githubUrl, organizationId, userId } = await req.json();
    
    if (!githubUrl || !organizationId || !userId) {
      return new Response(
        JSON.stringify({ error: 'Missing required parameters: githubUrl, organizationId, userId' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return new Response(
        JSON.stringify({ error: 'Supabase configuration error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    console.log(`Fetching CUAD dataset from: ${githubUrl}`);

    // Fetch CUAD_v1.json from GitHub
    const response = await fetch(githubUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch CUAD dataset: ${response.status} ${response.statusText}`);
    }

    const cuadData = await response.json();
    const contracts: CUADContract[] = cuadData.data || [];
    
    console.log(`Found ${contracts.length} contracts in CUAD dataset`);

    let imported = 0;
    let skipped = 0;
    let failed = 0;
    const errors: string[] = [];

    // Process in batches of 50
    const BATCH_SIZE = 50;
    for (let i = 0; i < contracts.length; i += BATCH_SIZE) {
      const batch = contracts.slice(i, Math.min(i + BATCH_SIZE, contracts.length));
      console.log(`Processing batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(contracts.length / BATCH_SIZE)} (${batch.length} contracts)`);

      const inserts = [];
      
      for (const contract of batch) {
        try {
          // Check if contract already exists
          const { data: existing } = await supabase
            .from('documents')
            .select('id')
            .eq('filename', contract.title)
            .eq('organization_id', organizationId)
            .maybeSingle();

          if (existing) {
            console.log(`Skipping existing contract: ${contract.title}`);
            skipped++;
            continue;
          }

          // Infer contract type from title
          const title = contract.title.toLowerCase();
          let contractType = 'General Agreement';
          if (title.includes('distribution') || title.includes('distributor')) {
            contractType = 'Distribution Agreement';
          } else if (title.includes('nda') || title.includes('non-disclosure') || title.includes('confidentiality')) {
            contractType = 'Non-Disclosure Agreement';
          } else if (title.includes('employment') || title.includes('employee')) {
            contractType = 'Employment Agreement';
          } else if (title.includes('license') || title.includes('licensing')) {
            contractType = 'License Agreement';
          } else if (title.includes('service')) {
            contractType = 'Service Agreement';
          } else if (title.includes('joint venture')) {
            contractType = 'Joint Venture Agreement';
          }

          // Combine paragraphs into content
          const contentText = contract.paragraphs.join('\n\n');

          // Prepare metadata
          const metadata = {
            source: 'CUAD',
            contract_type: contractType,
            cuad_annotations: contract.qa,
            total_clauses: contract.qa.length,
            import_date: new Date().toISOString(),
          };

          inserts.push({
            organization_id: organizationId,
            user_id: userId,
            filename: contract.title,
            content_text: contentText,
            file_type: 'cuad_contract',
            file_size: contentText.length,
            metadata: metadata,
            is_vectorized: false,
            vectorization_status: 'pending',
          });

        } catch (error) {
          console.error(`Error processing contract ${contract.title}:`, error);
          const errorMsg = error instanceof Error ? error.message : 'Unknown error';
          errors.push(`${contract.title}: ${errorMsg}`);
          failed++;
        }
      }

      // Insert batch
      if (inserts.length > 0) {
        const { error: insertError } = await supabase
          .from('documents')
          .insert(inserts);

        if (insertError) {
          console.error('Batch insert error:', insertError);
          errors.push(`Batch insert failed: ${insertError.message}`);
          failed += inserts.length;
        } else {
          imported += inserts.length;
          console.log(`Successfully inserted ${inserts.length} contracts`);
        }
      }
    }

    console.log(`Import complete: ${imported} imported, ${skipped} skipped, ${failed} failed`);

    return new Response(
      JSON.stringify({
        success: true,
        summary: {
          total: contracts.length,
          imported,
          skipped,
          failed,
        },
        errors: errors.length > 0 ? errors.slice(0, 10) : undefined, // Return first 10 errors
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in import-cuad-batch function:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
