import { useState, useEffect } from "react";
import { useOrganization } from "@/contexts/OrganizationContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Upload, FileText, Loader2, Eye } from "lucide-react";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import ClauseCard from "@/components/contract-review/ClauseCard";
import ReviewSummary from "@/components/contract-review/ReviewSummary";
import ContractViewer from "@/components/contract-review/ContractViewer";
import ContractHistory from "@/components/contract-review/ContractHistory";
import type { User } from "@supabase/supabase-js";

export default function ContractReview() {
  const { userRole } = useOrganization();
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => setUser(user));
  }, []);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedDocumentId, setSelectedDocumentId] = useState<string | null>(null);
  const [currentReviewId, setCurrentReviewId] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [showContractViewer, setShowContractViewer] = useState(false);
  const [analysisMode, setAnalysisMode] = useState<'quick' | 'thorough'>('quick');

  // Fetch existing documents
  const { data: documents } = useQuery({
    queryKey: ['documents', userRole?.organization?.id],
    queryFn: async () => {
      if (!userRole?.organization?.id) return [];
      const { data, error } = await supabase
        .from('documents')
        .select('*')
        .eq('organization_id', userRole.organization.id)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data;
    },
    enabled: !!userRole?.organization?.id
  });

  // Fetch review and findings
  const { data: reviewData, refetch: refetchReview } = useQuery({
    queryKey: ['contract-review', currentReviewId],
    queryFn: async () => {
      if (!currentReviewId) return null;
      
      const { data: review, error: reviewError } = await supabase
        .from('contract_reviews')
        .select('*')
        .eq('id', currentReviewId)
        .single();
      
      if (reviewError) throw reviewError;

      const { data: findings, error: findingsError } = await supabase
        .from('clause_findings')
        .select('*')
        .eq('review_id', currentReviewId)
        .order('risk_level', { ascending: false });
      
      if (findingsError) throw findingsError;

      return { review, findings: findings || [] };
    },
    enabled: !!currentReviewId,
    refetchInterval: (query) => {
      // Poll every 2 seconds while processing, keep polling for a bit after to catch completion
      const data = query.state.data;
      if (!data?.review) return 2000; // Keep polling if no data yet
      return data.review.status === 'processing' ? 2000 : false;
    }
  });

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 20 * 1024 * 1024) {
        toast.error("File size must be less than 20MB");
        return;
      }
      if (!['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain'].includes(file.type)) {
        toast.error("Only PDF, DOCX, and TXT files are supported");
        return;
      }
      setSelectedFile(file);
    }
  };

  const handleUploadAndAnalyze = async () => {
    if (!selectedFile || !user || !userRole?.organization?.id) {
      toast.error("Please select a file");
      return;
    }

    setIsAnalyzing(true);
    try {
      // Parse document using existing parse-document function
      const formData = new FormData();
      formData.append('file', selectedFile);

      const parseResponse = await supabase.functions.invoke('parse-document', {
        body: formData
      });

      if (parseResponse.error) throw parseResponse.error;
      
      const { text } = parseResponse.data;

      // Create document record
      const { data: document, error: docError } = await supabase
        .from('documents')
        .insert({
          filename: selectedFile.name,
          file_type: selectedFile.type,
          file_size: selectedFile.size,
          content_text: text,
          organization_id: userRole.organization.id,
          user_id: user.id
        })
        .select()
        .single();

      if (docError) throw docError;

      // Start contract analysis with selected mode
      const analyzeResponse = await supabase.functions.invoke('analyze-contract', {
        body: { documentId: document.id, mode: analysisMode }
      });

      if (analyzeResponse.error) throw analyzeResponse.error;

      setCurrentReviewId(analyzeResponse.data.reviewId);
      toast.success("Analysis started! Results will appear automatically when ready.");
      
    } catch (error) {
      console.error('Error analyzing contract:', error);
      toast.error(error instanceof Error ? error.message : "Failed to analyze contract");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleAnalyzeExisting = async (documentId: string) => {
    if (!user || !userRole?.organization?.id) return;

    setIsAnalyzing(true);
    setSelectedDocumentId(documentId);
    
    try {
      const analyzeResponse = await supabase.functions.invoke('analyze-contract', {
        body: { documentId, mode: analysisMode }
      });

      if (analyzeResponse.error) throw analyzeResponse.error;

      setCurrentReviewId(analyzeResponse.data.reviewId);
      toast.success("Analysis started! Results will appear automatically.");
      
    } catch (error) {
      console.error('Error analyzing contract:', error);
      toast.error(error instanceof Error ? error.message : "Failed to analyze contract");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleRetryAnalysis = async () => {
    if (!reviewData?.review.document_id) return;
    setCurrentReviewId(null);
    setTimeout(() => handleAnalyzeExisting(reviewData.review.document_id), 100);
  };

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-muted-foreground">Please sign in to access contract review</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-muted/30 to-background">
      <div className="container mx-auto py-12 px-4">
        <div className="max-w-4xl mx-auto">
        {!currentReviewId ? (
          <div className="glass-card rounded-2xl p-8 max-w-4xl mx-auto shadow-xl animate-scale-in">
            {/* Upload Section */}
            <div className="mb-8">
              <h2 className="text-2xl font-heading font-semibold mb-6 text-center">Upload Contract</h2>
              <div className="space-y-6">
                <div className="border-2 border-dashed border-primary/30 rounded-xl p-12 text-center bg-gradient-to-b from-primary/5 to-transparent hover:border-primary/50 hover:shadow-glow transition-all duration-normal group">
                  <input
                    type="file"
                    accept=".pdf,.docx,.txt"
                    onChange={handleFileSelect}
                    className="hidden"
                    id="file-upload"
                  />
                  <label htmlFor="file-upload" className="cursor-pointer block">
                    <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-primary/10 mb-4 group-hover:bg-primary/20 transition-colors">
                      <FileText className="w-10 h-10 text-primary" />
                    </div>
                    {selectedFile ? (
                      <div className="animate-fade-in">
                        <p className="text-lg font-medium mb-1">{selectedFile.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                        </p>
                      </div>
                    ) : (
                      <>
                        <p className="text-lg font-medium mb-2">Click to upload or drag and drop</p>
                        <p className="text-sm text-muted-foreground">PDF, DOCX, or TXT (max 20MB)</p>
                      </>
                    )}
                  </label>
                </div>
                
                <div className="space-y-3">
                  <label className="text-sm font-semibold block">Analysis Mode</label>
                  <div className="flex gap-3 bg-muted/50 p-1.5 rounded-xl">
                    <Button
                      type="button"
                      variant={analysisMode === 'quick' ? 'default' : 'ghost'}
                      onClick={() => setAnalysisMode('quick')}
                      className="flex-1 rounded-lg"
                      size="default"
                    >
                      Quick (20k chars)
                    </Button>
                    <Button
                      type="button"
                      variant={analysisMode === 'thorough' ? 'default' : 'ghost'}
                      onClick={() => setAnalysisMode('thorough')}
                      className="flex-1 rounded-lg"
                      size="default"
                    >
                      Thorough (50k+ chars)
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground text-center">
                    {analysisMode === 'quick' 
                      ? '⚡ Fast analysis with flash-lite model, best for quick reviews'
                      : '🔍 Comprehensive analysis with chunking for large documents'}
                  </p>
                </div>
                
                <Button 
                  onClick={handleUploadAndAnalyze} 
                  disabled={!selectedFile || isAnalyzing}
                  className="w-full h-12 text-base"
                  size="lg"
                >
                  {isAnalyzing ? (
                    <>
                      <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                      Analyzing Contract...
                    </>
                  ) : (
                    <>
                      <Upload className="w-5 h-5 mr-2" />
                      Upload & Analyze
                    </>
                  )}
                </Button>
              </div>
            </div>

            {/* Existing Documents */}
            {documents && documents.length > 0 && (
              <div className="border-t pt-8">
                <h3 className="text-lg font-heading font-semibold mb-4">Recent Documents</h3>
                <div className="space-y-2 max-h-[300px] overflow-y-auto">
                  {documents.slice(0, 5).map((doc) => (
                    <div
                      key={doc.id}
                      className="flex items-center justify-between p-4 rounded-xl border bg-background/50 hover:bg-accent/50 hover:shadow-md cursor-pointer transition-all duration-normal group"
                      onClick={() => !isAnalyzing && handleAnalyzeExisting(doc.id)}
                    >
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                          <FileText className="w-5 h-5 text-primary" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-medium truncate">{doc.filename}</p>
                          <p className="text-sm text-muted-foreground">
                            {new Date(doc.created_at).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      {selectedDocumentId === doc.id && isAnalyzing ? (
                        <Loader2 className="w-5 h-5 animate-spin flex-shrink-0 text-primary" />
                      ) : (
                        <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button variant="ghost" size="sm">Analyze</Button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
        </div>
        ) : null}
        </div>
      </div>

      {/* Results Section */}
      {currentReviewId && (
        <div className="container mx-auto py-8 px-4">
          <div className="max-w-6xl mx-auto">
            {reviewData?.review.status === 'processing' ? (
              <div className="glass-card rounded-2xl p-12 text-center animate-fade-in">
                <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-gradient-primary mb-6 animate-glow-pulse">
                  <Loader2 className="w-12 h-12 animate-spin text-white" />
                </div>
                <h3 className="text-2xl font-heading font-semibold mb-3">Analyzing Contract...</h3>
                
                {reviewData.review.analysis_results && 
                 typeof reviewData.review.analysis_results === 'object' &&
                 'progress_percent' in reviewData.review.analysis_results && (
                  <div className="max-w-lg mx-auto mt-6 space-y-3">
                    <div className="w-full bg-secondary h-3 rounded-full overflow-hidden shadow-inner">
                      <div 
                        className="bg-gradient-primary h-full transition-all duration-300 rounded-full shadow-glow"
                        style={{ width: `${(reviewData.review.analysis_results as any).progress_percent || 0}%` }}
                      />
                    </div>
                    <p className="text-sm font-medium">
                      Processing chunk {(reviewData.review.analysis_results as any).processed_chunks || 0} of {(reviewData.review.analysis_results as any).total_chunks || 0}
                      <span className="mx-2">•</span>
                      <span className="text-primary font-semibold">
                        {(reviewData.review.analysis_results as any).total_findings || 0} findings
                      </span>
                    </p>
                  </div>
                )}
                
                <p className="text-muted-foreground mt-4 max-w-md mx-auto">
                  Extracting clauses, assessing risks, and benchmarking against market standards.
                </p>
              </div>
            ) : reviewData?.review.status === 'completed' && reviewData.findings.length > 0 ? (
              <>
                <div className="flex items-center justify-between mb-8 animate-fade-in">
                  <h2 className="text-3xl font-heading font-bold">Review Results</h2>
                  <div className="flex gap-3">
                    <Button 
                      variant="outline" 
                      onClick={() => setShowContractViewer(true)}
                      className="flex items-center gap-2"
                    >
                      <Eye className="w-4 h-4" />
                      View Contract
                    </Button>
                    <Button variant="secondary" onClick={() => setCurrentReviewId(null)}>
                      New Review
                    </Button>
                  </div>
                </div>

                {reviewData.review.analysis_results && 
                 typeof reviewData.review.analysis_results === 'object' &&
                 'was_truncated' in reviewData.review.analysis_results &&
                 reviewData.review.analysis_results.was_truncated && (
                  <div className="glass-card border-l-4 border-warning p-5 rounded-xl mb-6 animate-fade-in">
                    <p className="font-semibold text-warning mb-2 flex items-center gap-2">
                      ⚠️ Large Document Notice
                    </p>
                    <p className="text-sm text-foreground/80">
                      This document was large ({(reviewData.review.analysis_results as any).total_chars?.toLocaleString()} characters). 
                      Quick mode analyzed the first {(reviewData.review.analysis_results as any).analyzed_chars?.toLocaleString()} characters. 
                      Use Thorough mode for complete analysis of large documents.
                    </p>
                  </div>
                )}

                <ReviewSummary 
                  findings={reviewData.findings} 
                  reviewId={currentReviewId}
                />

                <div className="space-y-5">
                  {reviewData.findings.map((finding, index) => (
                    <div 
                      key={finding.id}
                      className="animate-slide-up"
                      style={{ animationDelay: `${index * 50}ms` }}
                    >
                      <ClauseCard
                        finding={finding}
                        onUpdate={refetchReview}
                      />
                    </div>
                  ))}
                </div>

                {/* Contract History Section */}
                <div className="mt-8">
                  <ContractHistory documentId={reviewData.review.document_id} />
                </div>
              </>
            ) : reviewData?.review.status === 'completed' && reviewData.findings.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-muted-foreground">Analysis complete but no findings were generated.</p>
                <Button 
                  variant="outline" 
                  onClick={() => setCurrentReviewId(null)}
                  className="mt-4"
                >
                  Start New Review
                </Button>
              </div>
            ) : reviewData?.review.status === 'failed' ? (
              <div className="text-center py-12">
                <p className="text-destructive mb-2">Analysis Failed</p>
                {reviewData.review.analysis_results && 
                 typeof reviewData.review.analysis_results === 'object' &&
                 'error_message' in reviewData.review.analysis_results && (
                  <p className="text-sm text-muted-foreground mb-2">
                    {(reviewData.review.analysis_results as any).error_message}
                  </p>
                )}
                <p className="text-sm text-muted-foreground mb-4">
                  {reviewData.review.analysis_results && 
                   typeof reviewData.review.analysis_results === 'object' &&
                   'mode' in reviewData.review.analysis_results &&
                   (reviewData.review.analysis_results as any).mode === 'thorough'
                    ? "Try Quick mode for faster analysis on large documents"
                    : "Try Thorough mode for more comprehensive analysis"}
                </p>
                <div className="flex gap-2 justify-center">
                  <Button 
                    variant="outline" 
                    onClick={() => {
                      if (reviewData.review.analysis_results && 
                          typeof reviewData.review.analysis_results === 'object' &&
                          'mode' in reviewData.review.analysis_results) {
                        setAnalysisMode((reviewData.review.analysis_results as any).mode === 'thorough' ? 'quick' : 'thorough');
                      }
                      handleRetryAnalysis();
                    }}
                  >
                    Retry with {reviewData.review.analysis_results && 
                               typeof reviewData.review.analysis_results === 'object' &&
                               'mode' in reviewData.review.analysis_results &&
                               (reviewData.review.analysis_results as any).mode === 'thorough' ? 'Quick' : 'Thorough'} Mode
                  </Button>
                  <Button 
                    variant="ghost" 
                    onClick={() => setCurrentReviewId(null)}
                  >
                    Start New Review
                  </Button>
                </div>
              </div>
            ) : (
              <div className="text-center py-12">
                <Loader2 className="w-12 h-12 animate-spin mx-auto mb-4" />
                <p className="text-muted-foreground">Loading analysis results...</p>
              </div>
            )}
          </div>
        </div>
      )}

      {reviewData?.review && (
        <ContractViewer
          open={showContractViewer}
          onOpenChange={setShowContractViewer}
          documentId={reviewData.review.document_id}
          findings={reviewData.findings}
        />
      )}
    </div>
  );
}