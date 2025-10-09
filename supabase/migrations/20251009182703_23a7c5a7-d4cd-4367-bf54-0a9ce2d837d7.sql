-- Add version_name column to draft_versions table
ALTER TABLE public.draft_versions 
ADD COLUMN version_name text;

-- Add index for faster querying
CREATE INDEX IF NOT EXISTS idx_draft_versions_draft_id_version 
ON public.draft_versions(draft_id, version_number DESC);