-- Create function for matching benchmark clauses
CREATE OR REPLACE FUNCTION match_benchmark_clauses(
  query_embedding vector(1536),
  match_threshold float,
  match_count int,
  filter_clause_type text DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  clause_type text,
  clause_text text,
  source_document text,
  is_favorable boolean,
  similarity float
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT
    id,
    clause_type,
    clause_text,
    source_document,
    is_favorable,
    1 - (embedding <=> query_embedding) as similarity
  FROM benchmark_clauses
  WHERE (filter_clause_type IS NULL OR clause_type = filter_clause_type)
    AND 1 - (embedding <=> query_embedding) > match_threshold
  ORDER BY embedding <=> query_embedding
  LIMIT match_count;
$$;