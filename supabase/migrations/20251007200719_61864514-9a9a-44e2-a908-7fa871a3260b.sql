-- Add indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_document_drafts_org_updated ON public.document_drafts(organization_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_document_drafts_user_status ON public.document_drafts(user_id, status);
CREATE INDEX IF NOT EXISTS idx_draft_versions_draft_version ON public.draft_versions(draft_id, version_number DESC);
CREATE INDEX IF NOT EXISTS idx_conversations_org_updated ON public.conversations(organization_id, updated_at DESC);