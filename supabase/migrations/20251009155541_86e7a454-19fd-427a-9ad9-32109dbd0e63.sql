-- Revert document_versions policies back to draft-based access
DROP POLICY IF EXISTS "Users can create versions for their org documents" ON public.document_versions;
DROP POLICY IF EXISTS "Users can view versions from their org documents" ON public.document_versions;

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
