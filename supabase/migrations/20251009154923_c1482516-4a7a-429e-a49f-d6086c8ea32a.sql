-- Update RLS policy for document_versions to work with regular documents
DROP POLICY IF EXISTS "Users can create versions for their organization's drafts" ON public.document_versions;

CREATE POLICY "Users can create versions for their org documents"
ON public.document_versions
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.documents
    WHERE documents.id = document_versions.draft_id
    AND documents.organization_id = get_user_organization(auth.uid())
  )
);

-- Also update the SELECT policy to use documents instead of drafts
DROP POLICY IF EXISTS "Users can view versions of their organization's drafts" ON public.document_versions;

CREATE POLICY "Users can view versions from their org documents"
ON public.document_versions
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.documents
    WHERE documents.id = document_versions.draft_id
    AND documents.organization_id = get_user_organization(auth.uid())
  )
);