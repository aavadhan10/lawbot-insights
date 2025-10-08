-- Create document_versions table to track all versions of a document
CREATE TABLE IF NOT EXISTS public.document_versions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  draft_id UUID NOT NULL REFERENCES public.document_drafts(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- Enable RLS
ALTER TABLE public.document_versions ENABLE ROW LEVEL SECURITY;

-- Create policies for document versions
CREATE POLICY "Users can view versions of their organization's drafts"
ON public.document_versions
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.document_drafts
    WHERE document_drafts.id = document_versions.draft_id
    AND document_drafts.organization_id = get_user_organization(auth.uid())
  )
);

CREATE POLICY "Users can create versions for their organization's drafts"
ON public.document_versions
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.document_drafts
    WHERE document_drafts.id = document_versions.draft_id
    AND document_drafts.organization_id = get_user_organization(auth.uid())
  )
);

-- Add index for better performance
CREATE INDEX idx_document_versions_draft_id ON public.document_versions(draft_id);
CREATE INDEX idx_document_versions_created_at ON public.document_versions(created_at DESC);