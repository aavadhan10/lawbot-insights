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
    const { clauseText, clauseType, findingId } = await req.json();
    
    if (!clauseText || !findingId) {
      throw new Error('clauseText and findingId are required');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY')!;

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get auth header
    const authHeader = req.headers.get('Authorization');
    const token = authHeader?.replace('Bearer ', '');
    const { data: { user } } = await supabase.auth.getUser(token);

    if (!user) {
      throw new Error('Unauthorized');
    }

    console.log('Benchmarking clause:', findingId);

    // Generate embedding for the clause
    const embeddingResponse = await fetch('https://ai.gateway.lovable.dev/v1/embeddings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'text-embedding-3-small',
        input: clauseText
      })
    });

    if (!embeddingResponse.ok) {
      throw new Error('Failed to generate embedding');
    }

    const embeddingData = await embeddingResponse.json();
    const embedding = embeddingData.data[0].embedding;

    // Search for similar clauses in benchmark data
    const { data: similarClauses, error: searchError } = await supabase.rpc(
      'match_benchmark_clauses',
      {
        query_embedding: embedding,
        match_threshold: 0.7,
        match_count: 5,
        filter_clause_type: clauseType || null
      }
    );

    if (searchError) {
      console.error('Error searching benchmark clauses:', searchError);
      throw searchError;
    }

    // Prepare benchmark data
    const benchmarkData = {
      similar_clauses: similarClauses || [],
      total_matches: similarClauses?.length || 0,
      average_similarity: similarClauses?.length > 0 
        ? similarClauses.reduce((acc: number, c: any) => acc + c.similarity, 0) / similarClauses.length
        : 0,
      is_market_standard: similarClauses?.length >= 3 && 
        similarClauses.some((c: any) => c.similarity > 0.85),
      benchmarked_at: new Date().toISOString()
    };

    // Update the finding with benchmark data
    const { error: updateError } = await supabase
      .from('clause_findings')
      .update({ benchmark_data: benchmarkData })
      .eq('id', findingId);

    if (updateError) {
      console.error('Error updating finding:', updateError);
      throw updateError;
    }

    console.log('Benchmark completed successfully');

    return new Response(
      JSON.stringify({ 
        success: true, 
        benchmarkData 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );
  } catch (error) {
    console.error('Error in benchmark-clause:', error);
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

// Note: The match_benchmark_clauses RPC function should be created via migration:
// CREATE OR REPLACE FUNCTION match_benchmark_clauses(
//   query_embedding vector(1536),
//   match_threshold float,
//   match_count int,
//   filter_clause_type text DEFAULT NULL
// )
// RETURNS TABLE (
//   id uuid,
//   clause_type text,
//   clause_text text,
//   source_document text,
//   is_favorable boolean,
//   similarity float
// )
// LANGUAGE sql STABLE
// AS $$
//   SELECT
//     id,
//     clause_type,
//     clause_text,
//     source_document,
//     is_favorable,
//     1 - (embedding <=> query_embedding) as similarity
//   FROM benchmark_clauses
//   WHERE (filter_clause_type IS NULL OR clause_type = filter_clause_type)
//     AND 1 - (embedding <=> query_embedding) > match_threshold
//   ORDER BY embedding <=> query_embedding
//   LIMIT match_count;
// $$;