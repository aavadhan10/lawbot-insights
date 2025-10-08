-- Step 2: Insert BrieflyLegal organization
INSERT INTO organizations (name, slug, settings)
VALUES (
  'BrieflyLegal',
  'brieflylegal',
  '{}'::jsonb
);

-- Step 3: Assign user to BrieflyLegal with admin role
INSERT INTO user_roles (user_id, organization_id, role)
SELECT 
  '2e0bd863-e56c-46d6-a83c-7387588b7a56'::uuid,
  id,
  'admin'::app_role
FROM organizations
WHERE slug = 'brieflylegal';