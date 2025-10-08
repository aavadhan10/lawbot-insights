import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.74.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Function to split text into chunks with overlap
function splitIntoChunks(text: string, chunkSize = 3000, overlap = 200): string[] {
  const chunks: string[] = [];
  const safeOverlap = Math.max(0, overlap);
  const step = Math.max(1, chunkSize - safeOverlap);

  for (let start = 0; start < text.length; start += step) {
    const end = Math.min(start + chunkSize, text.length);
    chunks.push(text.slice(start, end));
    if (end === text.length) break; // Avoid infinite loop on last chunk
  }

  return chunks;
}

// Function to generate embeddings using OpenAI with retry logic
async function generateEmbedding(text: string, apiKey: string, retries = 2): Promise<number[]> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await fetch('https://api.openai.com/v1/embeddings', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'text-embedding-3-small',
          input: text,
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`OpenAI embeddings error: ${response.status} - ${error}`);
      }

      const data = await response.json();
      return data.data[0].embedding;
    } catch (error) {
      if (attempt === retries) throw error;
      // Exponential backoff: 1s, 2s
      const delay = Math.pow(2, attempt) * 1000;
      console.log(`Retry ${attempt + 1}/${retries} after ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  throw new Error('Failed to generate embedding after retries');
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { documentId } = await req.json();
    
    if (!documentId) {
      return new Response(
        JSON.stringify({ error: 'Document ID is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!OPENAI_API_KEY) {
      console.error('OPENAI_API_KEY is not set');
      return new Response(
        JSON.stringify({ error: 'OpenAI API key not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      console.error('Supabase credentials not set');
      return new Response(
        JSON.stringify({ error: 'Supabase configuration error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    console.log(`Starting vectorization for document: ${documentId}`);

    // Fetch document to get user_id
    const { data: document, error: fetchError } = await supabase
      .from('documents')
      .select('content_text, filename, user_id')
      .eq('id', documentId)
      .single();

    if (fetchError || !document) {
      console.error('Error fetching document:', fetchError);
      return new Response(
        JSON.stringify({ error: 'Document not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check rate limit (5 vectorizations per hour)
    const { data: canProceed, error: rateLimitError } = await supabase
      .rpc('check_rate_limit', {
        _user_id: document.user_id,
        _action_type: 'vectorize',
        _limit: 5,
        _window_minutes: 60
      });

    if (rateLimitError || !canProceed) {
      console.log(`Rate limit exceeded for vectorization`);
      return new Response(
        JSON.stringify({ 
          error: 'Rate limit exceeded. You can vectorize 5 documents per hour. Please try again later.' 
        }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Update document status to processing
    await supabase
      .from('documents')
      .update({ vectorization_status: 'processing' })
      .eq('id', documentId);

    const content = document.content_text;
    if (!content || content.trim().length === 0) {
      console.error('Document has no text content');
      await supabase
        .from('documents')
        .update({ vectorization_status: 'failed' })
        .eq('id', documentId);
      
      return new Response(
        JSON.stringify({ error: 'Document has no text content to vectorize' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Document ${document.filename}: ${content.length} characters`);

    // Split content into chunks (larger chunks = fewer embeddings = faster)
    const chunks = splitIntoChunks(content, 3000, 200);
    console.log(`Split into ${chunks.length} chunks`);

    // Delete existing chunks for this document
    await supabase
      .from('document_chunks')
      .delete()
      .eq('document_id', documentId);

    // Process chunks in batches with concurrent embeddings
    // Reduced batch sizes to stay under memory limits
    const BATCH_SIZE = 3;
    const CONCURRENCY = 2; // Generate 2 embeddings in parallel
    let totalInserted = 0;

    for (let batchStart = 0; batchStart < chunks.length; batchStart += BATCH_SIZE) {
      const batchEnd = Math.min(batchStart + BATCH_SIZE, chunks.length);
      const batchChunks = chunks.slice(batchStart, batchEnd);
      
      console.log(`Processing batch ${Math.floor(batchStart / BATCH_SIZE) + 1}/${Math.ceil(chunks.length / BATCH_SIZE)} (chunks ${batchStart + 1}-${batchEnd}/${chunks.length})`);
      
      // Generate embeddings concurrently (limited concurrency to avoid memory issues)
      const chunkInserts = [];
      for (let i = 0; i < batchChunks.length; i += CONCURRENCY) {
        const concurrentChunks = batchChunks.slice(i, Math.min(i + CONCURRENCY, batchChunks.length));
        const embeddingPromises = concurrentChunks.map(chunk => generateEmbedding(chunk, OPENAI_API_KEY));
        
        try {
          const embeddings = await Promise.all(embeddingPromises);
          
          for (let j = 0; j < concurrentChunks.length; j++) {
            const chunkIndex = batchStart + i + j;
            chunkInserts.push({
              document_id: documentId,
              chunk_text: concurrentChunks[j],
              chunk_index: chunkIndex,
              embedding: embeddings[j],
              metadata: {
                char_count: concurrentChunks[j].length,
                filename: document.filename,
              }
            });
          }
        } catch (error) {
          console.error(`Error generating embeddings:`, error);
          await supabase
            .from('documents')
            .update({ vectorization_status: 'failed' })
            .eq('id', documentId);
          
          return new Response(
            JSON.stringify({ error: 'Failed to generate embeddings' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }

      // Insert this batch immediately to free memory
      const { error: insertError } = await supabase
        .from('document_chunks')
        .insert(chunkInserts);

      if (insertError) {
        console.error(`Error inserting batch at chunk ${batchStart}:`, insertError);
        await supabase
          .from('documents')
          .update({ vectorization_status: 'failed' })
          .eq('id', documentId);
        
        return new Response(
          JSON.stringify({ error: 'Failed to store document chunks' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      totalInserted += chunkInserts.length;
      console.log(`Batch inserted successfully. Total progress: ${totalInserted}/${chunks.length} chunks`);
    }

    // Update document status to completed
    await supabase
      .from('documents')
      .update({
        is_vectorized: true,
        vectorization_status: 'completed',
        chunk_count: chunks.length,
      })
      .eq('id', documentId);

    console.log(`Successfully vectorized document ${documentId} with ${chunks.length} chunks`);

    return new Response(
      JSON.stringify({
        success: true,
        documentId,
        chunkCount: chunks.length,
        message: `Document vectorized successfully with ${chunks.length} chunks`,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in embed-document function:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
