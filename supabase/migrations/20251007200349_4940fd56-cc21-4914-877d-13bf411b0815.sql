-- Create usage logs table for tracking draft operations
CREATE TABLE public.usage_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  action_type TEXT NOT NULL,
  resource_id UUID,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.usage_logs ENABLE ROW LEVEL SECURITY;

-- Users can view their own usage logs
CREATE POLICY "Users can view their own usage logs"
ON public.usage_logs
FOR SELECT
USING (auth.uid() = user_id);

-- Partners can view org usage logs
CREATE POLICY "Partners can view org usage logs"
ON public.usage_logs
FOR SELECT
USING (has_role(auth.uid(), 'partner'::app_role) AND organization_id = get_user_organization(auth.uid()));

-- System can insert usage logs
CREATE POLICY "System can insert usage logs"
ON public.usage_logs
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Create index for faster queries
CREATE INDEX idx_usage_logs_user_created ON public.usage_logs(user_id, created_at DESC);
CREATE INDEX idx_usage_logs_org_created ON public.usage_logs(organization_id, created_at DESC);
CREATE INDEX idx_usage_logs_action_type ON public.usage_logs(action_type);

-- Create organization-level rate limit check function
CREATE OR REPLACE FUNCTION public.check_org_rate_limit(
  _organization_id UUID,
  _action_type TEXT,
  _limit INTEGER,
  _window_minutes INTEGER DEFAULT 60
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  action_count INTEGER;
BEGIN
  -- Count actions in the time window
  SELECT COUNT(*)
  INTO action_count
  FROM usage_logs
  WHERE organization_id = _organization_id
    AND action_type = _action_type
    AND created_at > now() - (_window_minutes || ' minutes')::INTERVAL;
  
  RETURN action_count < _limit;
END;
$$;