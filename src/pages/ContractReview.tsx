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

      // Start contract analysis
      const analyzeResponse = await supabase.functions.invoke('analyze-contract', {
        body: { documentId: document.id }
      });

      if (analyzeResponse.error) throw analyzeResponse.error;

      setCurrentReviewId(analyzeResponse.data.reviewId);
      toast.success("Contract analysis started! This may take 30-60 seconds.");
      
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
        body: { documentId }
      });

      if (analyzeResponse.error) throw analyzeResponse.error;

      setCurrentReviewId(analyzeResponse.data.reviewId);
      toast.success("Contract analysis started!");
      
    } catch (error) {
      console.error('Error analyzing contract:', error);
      toast.error(error instanceof Error ? error.message : "Failed to analyze contract");
    } finally {
      setIsAnalyzing(false);
    }
  };

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-muted-foreground">Please sign in to access contract review</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Contract Review & Benchmarking</h1>
          <p className="text-muted-foreground">
            AI-powered contract analysis with risk assessment and market benchmarking
          </p>
        </div>

        {!currentReviewId ? (
          <>
            <div className="grid lg:grid-cols-2 gap-6">
            {/* Upload New Contract */}
            <div className="border rounded-lg p-6">
              <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                <Upload className="w-5 h-5" />
                Upload New Contract
              </h2>
              <div className="space-y-4">
                <div className="border-2 border-dashed rounded-lg p-8 text-center">
                  <input
                    type="file"
                    accept=".pdf,.docx,.txt"
                    onChange={handleFileSelect}
                    className="hidden"
                    id="file-upload"
                  />
                  <label htmlFor="file-upload" className="cursor-pointer">
                    <FileText className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                    {selectedFile ? (
                      <p className="font-medium">{selectedFile.name}</p>
                    ) : (
                      <>
                        <p className="font-medium mb-1">Click to upload or drag and drop</p>
                        <p className="text-sm text-muted-foreground">PDF, DOCX, or TXT (max 20MB)</p>
                      </>
                    )}
                  </label>
                </div>
                <Button 
                  onClick={handleUploadAndAnalyze} 
                  disabled={!selectedFile || isAnalyzing}
                  className="w-full"
                >
                  {isAnalyzing ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Analyzing...
                    </>
                  ) : (
                    "Upload & Analyze"
                  )}
                </Button>
              </div>
            </div>

            {/* Select Existing Document */}
            <div className="border rounded-lg p-6">
              <h2 className="text-xl font-semibold mb-4">Analyze Existing Document</h2>
              <div className="space-y-2 max-h-[400px] overflow-y-auto">
                {documents && documents.length > 0 ? (
                  documents.map((doc) => (
                    <div
                      key={doc.id}
                      className="flex items-center justify-between p-3 border rounded hover:bg-accent cursor-pointer"
                      onClick={() => !isAnalyzing && handleAnalyzeExisting(doc.id)}
                    >
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <FileText className="w-5 h-5 flex-shrink-0" />
                        <div className="min-w-0 flex-1">
                          <p className="font-medium truncate">{doc.filename}</p>
                          <p className="text-sm text-muted-foreground">
                            {new Date(doc.created_at).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      {selectedDocumentId === doc.id && isAnalyzing && (
                        <Loader2 className="w-4 h-4 animate-spin flex-shrink-0" />
                      )}
                    </div>
                  ))
                ) : (
                  <p className="text-center text-muted-foreground py-8">
                    No documents available. Upload a document to get started.
                  </p>
                )}
              </div>
            </div>
            </div>
          </>
        ) : (
          <div className="space-y-6">
            {reviewData?.review.status === 'processing' ? (
              <div className="text-center py-12">
                <Loader2 className="w-12 h-12 animate-spin mx-auto mb-4" />
                <h3 className="text-lg font-medium mb-2">Analyzing Contract...</h3>
                <p className="text-muted-foreground">
                  This usually takes 30-60 seconds. We're extracting clauses, assessing risks, 
                  and benchmarking against market standards.
                </p>
              </div>
            ) : reviewData?.review.status === 'completed' && reviewData.findings.length > 0 ? (
              <>
                <div className="flex items-center justify-between">
                  <h2 className="text-2xl font-bold">Review Results</h2>
                  <div className="flex gap-2">
                    <Button 
                      variant="outline" 
                      onClick={() => setShowContractViewer(true)}
                      className="flex items-center gap-2"
                    >
                      <Eye className="w-4 h-4" />
                      View Contract
                    </Button>
                    <Button variant="outline" onClick={() => setCurrentReviewId(null)}>
                      New Review
                    </Button>
                  </div>
                </div>

                {reviewData.review.analysis_results && 
                 typeof reviewData.review.analysis_results === 'object' &&
                 'was_truncated' in reviewData.review.analysis_results &&
                 reviewData.review.analysis_results.was_truncated && (
                  <div className="border-l-4 border-warning bg-warning/10 p-4 rounded">
                    <p className="font-medium text-warning mb-1">Large Document Notice</p>
                    <p className="text-sm">
                      This document was large ({(reviewData.review.analysis_results as any).total_chars?.toLocaleString()} characters), 
                      so we analyzed the first {(reviewData.review.analysis_results as any).analyzed_chars?.toLocaleString()} characters. 
                      For complete analysis, consider breaking the document into smaller sections.
                    </p>
                  </div>
                )}

                <ReviewSummary 
                  findings={reviewData.findings} 
                  reviewId={currentReviewId}
                />

                <div className="space-y-4">
                  {reviewData.findings.map((finding) => (
                    <ClauseCard
                      key={finding.id}
                      finding={finding}
                      onUpdate={refetchReview}
                    />
                  ))}
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
                <p className="text-destructive mb-2">Analysis failed</p>
                <p className="text-sm text-muted-foreground mb-4">
                  There was an error analyzing this contract. Please try again.
                </p>
                <Button 
                  variant="outline" 
                  onClick={() => setCurrentReviewId(null)}
                >
                  Start New Review
                </Button>
              </div>
            ) : (
              <div className="text-center py-12">
                <Loader2 className="w-12 h-12 animate-spin mx-auto mb-4" />
                <p className="text-muted-foreground">Loading analysis results...</p>
              </div>
            )}
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
    </div>
  );
}