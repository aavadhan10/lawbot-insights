-- Create contract_reviews table
CREATE TABLE public.contract_reviews (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  document_id UUID NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  organization_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'processing' CHECK (status IN ('processing', 'completed', 'failed')),
  analysis_results JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create clause_findings table
CREATE TABLE public.clause_findings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  review_id UUID NOT NULL REFERENCES public.contract_reviews(id) ON DELETE CASCADE,
  clause_title TEXT NOT NULL,
  clause_text TEXT NOT NULL,
  risk_level TEXT NOT NULL CHECK (risk_level IN ('high', 'medium', 'low')),
  issue_description TEXT NOT NULL,
  recommendation TEXT NOT NULL,
  original_text TEXT NOT NULL,
  suggested_text TEXT NOT NULL,
  benchmark_data JSONB DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'applied', 'dismissed')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create benchmark_clauses table for CUAD data
CREATE TABLE public.benchmark_clauses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  clause_type TEXT NOT NULL,
  clause_text TEXT NOT NULL,
  source_document TEXT NOT NULL,
  industry TEXT,
  is_favorable BOOLEAN DEFAULT true,
  metadata JSONB DEFAULT '{}'::jsonb,
  embedding vector(1536),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.contract_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clause_findings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.benchmark_clauses ENABLE ROW LEVEL SECURITY;

-- RLS Policies for contract_reviews
CREATE POLICY "Users can create contract reviews"
  ON public.contract_reviews
  FOR INSERT
  WITH CHECK (
    auth.uid() = user_id 
    AND organization_id = get_user_organization(auth.uid())
  );

CREATE POLICY "Users can view their org contract reviews"
  ON public.contract_reviews
  FOR SELECT
  USING (organization_id = get_user_organization(auth.uid()));

CREATE POLICY "Users can update their org contract reviews"
  ON public.contract_reviews
  FOR UPDATE
  USING (organization_id = get_user_organization(auth.uid()));

CREATE POLICY "Users can delete their contract reviews"
  ON public.contract_reviews
  FOR DELETE
  USING (auth.uid() = user_id);

-- RLS Policies for clause_findings
CREATE POLICY "Users can view findings from their org reviews"
  ON public.clause_findings
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.contract_reviews
      WHERE contract_reviews.id = clause_findings.review_id
      AND contract_reviews.organization_id = get_user_organization(auth.uid())
    )
  );

CREATE POLICY "Users can create findings for their org reviews"
  ON public.clause_findings
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.contract_reviews
      WHERE contract_reviews.id = clause_findings.review_id
      AND contract_reviews.organization_id = get_user_organization(auth.uid())
    )
  );

CREATE POLICY "Users can update findings from their org reviews"
  ON public.clause_findings
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.contract_reviews
      WHERE contract_reviews.id = clause_findings.review_id
      AND contract_reviews.organization_id = get_user_organization(auth.uid())
    )
  );

-- RLS Policies for benchmark_clauses (read-only for all authenticated users)
CREATE POLICY "Authenticated users can view benchmark clauses"
  ON public.benchmark_clauses
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Create indexes for performance
CREATE INDEX idx_contract_reviews_document_id ON public.contract_reviews(document_id);
CREATE INDEX idx_contract_reviews_organization_id ON public.contract_reviews(organization_id);
CREATE INDEX idx_contract_reviews_status ON public.contract_reviews(status);
CREATE INDEX idx_clause_findings_review_id ON public.clause_findings(review_id);
CREATE INDEX idx_clause_findings_risk_level ON public.clause_findings(risk_level);
CREATE INDEX idx_clause_findings_status ON public.clause_findings(status);
CREATE INDEX idx_benchmark_clauses_clause_type ON public.benchmark_clauses(clause_type);
CREATE INDEX idx_benchmark_clauses_embedding ON public.benchmark_clauses USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- Trigger for updated_at
CREATE TRIGGER update_contract_reviews_updated_at
  BEFORE UPDATE ON public.contract_reviews
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();