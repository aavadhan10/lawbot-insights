-- Create feedback table for user feedback system
CREATE TABLE IF NOT EXISTS public.feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE NOT NULL,
  rating INTEGER CHECK (rating >= 1 AND rating <= 5),
  category TEXT NOT NULL,
  message TEXT NOT NULL,
  screenshot_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;

-- Users can create feedback
CREATE POLICY "Users can create feedback" 
ON public.feedback 
FOR INSERT 
WITH CHECK (auth.uid() = user_id AND organization_id = get_user_organization(auth.uid()));

-- Users can view their own feedback
CREATE POLICY "Users can view their own feedback" 
ON public.feedback 
FOR SELECT 
USING (auth.uid() = user_id);

-- Partners can view all org feedback
CREATE POLICY "Partners can view org feedback" 
ON public.feedback 
FOR SELECT 
USING (has_role(auth.uid(), 'partner'::app_role) AND organization_id = get_user_organization(auth.uid()));