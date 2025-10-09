-- Update existing conversations that are missing organization_id
-- This will set organization_id based on the user's organization from user_roles table

UPDATE conversations c
SET organization_id = ur.organization_id
FROM user_roles ur
WHERE c.user_id = ur.user_id 
  AND c.organization_id IS NULL;