-- Create document_drafts table
CREATE TABLE public.document_drafts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL,
  title TEXT NOT NULL,
  document_type TEXT NOT NULL,
  content JSONB NOT NULL DEFAULT '{"text": "", "changes": []}'::jsonb,
  current_version INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'draft',
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create draft_versions table
CREATE TABLE public.draft_versions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  draft_id UUID NOT NULL REFERENCES public.document_drafts(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,
  content JSONB NOT NULL,
  changes_summary TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.document_drafts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.draft_versions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for document_drafts
CREATE POLICY "Users can create their own drafts"
ON public.document_drafts
FOR INSERT
WITH CHECK (auth.uid() = user_id AND organization_id = get_user_organization(auth.uid()));

CREATE POLICY "Users can view their org drafts"
ON public.document_drafts
FOR SELECT
USING (organization_id = get_user_organization(auth.uid()));

CREATE POLICY "Users can update their own drafts"
ON public.document_drafts
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own drafts"
ON public.document_drafts
FOR DELETE
USING (auth.uid() = user_id);

-- RLS Policies for draft_versions
CREATE POLICY "Users can create versions for their drafts"
ON public.draft_versions
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.document_drafts
    WHERE id = draft_versions.draft_id
    AND user_id = auth.uid()
  )
);

CREATE POLICY "Users can view versions from their org drafts"
ON public.draft_versions
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.document_drafts
    WHERE id = draft_versions.draft_id
    AND organization_id = get_user_organization(auth.uid())
  )
);

-- Trigger to update updated_at
CREATE TRIGGER update_document_drafts_updated_at
BEFORE UPDATE ON public.document_drafts
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Index for performance
CREATE INDEX idx_document_drafts_user_id ON public.document_drafts(user_id);
CREATE INDEX idx_document_drafts_organization_id ON public.document_drafts(organization_id);
CREATE INDEX idx_draft_versions_draft_id ON public.draft_versions(draft_id);