-- Enable pgvector extension for vector similarity search
CREATE EXTENSION IF NOT EXISTS vector;

-- Create document_chunks table for storing vectorized content
CREATE TABLE public.document_chunks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid REFERENCES public.documents(id) ON DELETE CASCADE NOT NULL,
  chunk_text text NOT NULL,
  chunk_index integer NOT NULL,
  embedding vector(1536),
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

-- Create index for fast vector similarity search
CREATE INDEX document_chunks_embedding_idx ON public.document_chunks 
USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- Create index for document lookups
CREATE INDEX document_chunks_document_id_idx ON public.document_chunks(document_id);

-- Enable RLS
ALTER TABLE public.document_chunks ENABLE ROW LEVEL SECURITY;

-- RLS policies for document_chunks
CREATE POLICY "Users can view chunks from their org documents"
ON public.document_chunks FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.documents
    WHERE documents.id = document_chunks.document_id
    AND documents.organization_id = get_user_organization(auth.uid())
  )
);

CREATE POLICY "Users can insert chunks for their org documents"
ON public.document_chunks FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.documents
    WHERE documents.id = document_chunks.document_id
    AND documents.organization_id = get_user_organization(auth.uid())
  )
);

-- Add vectorization tracking columns to documents table
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS is_vectorized boolean DEFAULT false;
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS vectorization_status text DEFAULT 'pending';
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS chunk_count integer DEFAULT 0;

-- Create vector similarity search function
CREATE OR REPLACE FUNCTION public.match_document_chunks(
  query_embedding vector(1536),
  match_threshold float DEFAULT 0.7,
  match_count int DEFAULT 10,
  filter_document_ids uuid[] DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  document_id uuid,
  chunk_text text,
  chunk_index integer,
  similarity float
)
LANGUAGE sql STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    document_chunks.id,
    document_chunks.document_id,
    document_chunks.chunk_text,
    document_chunks.chunk_index,
    1 - (document_chunks.embedding <=> query_embedding) AS similarity
  FROM document_chunks
  WHERE 
    (filter_document_ids IS NULL OR document_chunks.document_id = ANY(filter_document_ids))
    AND 1 - (document_chunks.embedding <=> query_embedding) > match_threshold
  ORDER BY document_chunks.embedding <=> query_embedding
  LIMIT match_count;
$$;