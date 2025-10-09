import { useState, useEffect } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, FileText, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";

interface Finding {
  id: string;
  original_text: string | null;
  suggested_text: string | null;
  clause_text: string;
  risk_level: string;
  status?: string;
}

interface ContractViewerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  documentId: string;
  findings: Finding[];
}

export default function ContractViewer({ open, onOpenChange, documentId, findings }: ContractViewerProps) {
  const [contractText, setContractText] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);
  const [findingStatuses, setFindingStatuses] = useState<Record<string, string>>({});
  const [activeCard, setActiveCard] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (open && documentId) {
      loadContract();
      loadFindingStatuses();
    }
  }, [open, documentId]);

  const loadFindingStatuses = () => {
    const statuses: Record<string, string> = {};
    findings.forEach(f => {
      statuses[f.id] = f.status || 'pending';
    });
    setFindingStatuses(statuses);
  };

  const loadContract = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('documents')
        .select('content_text')
        .eq('id', documentId)
        .single();

      if (error) throw error;
      setContractText(data.content_text || "");
    } catch (error) {
      console.error('Error loading contract:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const highlightContract = (text: string) => {
    let highlightedText = text;
    
    const sortedFindings = [...findings]
      .filter(f => f.original_text)
      .sort((a, b) => (b.original_text?.length || 0) - (a.original_text?.length || 0));

    sortedFindings.forEach((finding, index) => {
      if (finding.original_text) {
        const originalText = finding.original_text.trim();
        const marker = `__FINDING_${index}__`;
        const status = findingStatuses[finding.id] || 'pending';
        
        highlightedText = highlightedText.replace(
          originalText,
          marker
        );
        
        let bgColor = 'rgba(254, 243, 199, 0.5)'; // yellow for pending
        if (status === 'applied') bgColor = 'rgba(187, 247, 208, 0.5)'; // green
        if (status === 'dismissed') bgColor = 'transparent';
        
        const replacement = `<span 
          id="finding-${finding.id}" 
          class="cursor-pointer transition-colors hover:opacity-80 ${status === 'dismissed' ? '' : 'border-b-2 border-dashed border-yellow-600'}"
          style="background-color: ${bgColor};"
          data-finding-id="${finding.id}"
          onclick="document.getElementById('card-${finding.id}')?.scrollIntoView({behavior: 'smooth', block: 'center'})"
        >${originalText}</span>`;
        
        highlightedText = highlightedText.replace(marker, replacement);
      }
    });

    return highlightedText;
  };

  const handleStatusChange = async (findingId: string, newStatus: string) => {
    try {
      const { error } = await supabase
        .from('clause_findings')
        .update({ status: newStatus })
        .eq('id', findingId);

      if (error) throw error;

      setFindingStatuses(prev => ({ ...prev, [findingId]: newStatus }));
      
      toast({
        title: newStatus === 'applied' ? "Change accepted" : "Change rejected",
        description: `The suggestion has been ${newStatus}.`,
      });
    } catch (error) {
      console.error('Error updating finding status:', error);
      toast({
        title: "Error",
        description: "Failed to update suggestion status.",
        variant: "destructive",
      });
    }
  };

  const scrollToFinding = (findingId: string) => {
    const element = document.getElementById(`finding-${findingId}`);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setActiveCard(findingId);
      setTimeout(() => setActiveCard(null), 2000);
    }
  };

  const pendingCount = Object.values(findingStatuses).filter(s => s === 'pending').length;
  const appliedCount = Object.values(findingStatuses).filter(s => s === 'applied').length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-full w-screen h-screen m-0 p-0 gap-0">
        <div className="bg-background h-full flex flex-col">
          <div className="px-6 py-4 border-b flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <FileText className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h2 className="text-xl font-semibold">Contract Review</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  {appliedCount} of {findings.length} suggestions applied • {pendingCount} pending
                </p>
              </div>
            </div>
            <Button 
              variant="ghost" 
              size="icon"
              onClick={() => onOpenChange(false)}
              className="h-8 w-8"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
          
          {isLoading ? (
            <div className="flex items-center justify-center flex-1">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : (
            <div className="flex flex-1 overflow-hidden">
              {/* Document Area */}
              <ScrollArea className="flex-[2] border-r">
                <div className="p-12 bg-white min-h-full">
                  <div 
                    className="text-foreground text-[15px] leading-[1.8] whitespace-pre-wrap"
                    style={{ 
                      fontFamily: 'ui-serif, Georgia, Cambria, "Times New Roman", Times, serif',
                      textAlign: 'justify',
                      hyphens: 'auto'
                    }}
                    dangerouslySetInnerHTML={{ __html: highlightContract(contractText) }}
                  />
                </div>
              </ScrollArea>

              {/* Suggestions Sidebar */}
              <ScrollArea className="flex-1 bg-muted/30">
                <div className="p-4 space-y-3">
                  <h3 className="font-semibold text-sm text-muted-foreground px-2">
                    SUGGESTIONS ({findings.length})
                  </h3>
                  
                  {findings.map((finding, idx) => {
                    const status = findingStatuses[finding.id] || 'pending';
                    const isActive = activeCard === finding.id;
                    
                    return (
                      <div
                        key={finding.id}
                        id={`card-${finding.id}`}
                        onClick={() => scrollToFinding(finding.id)}
                        className={`bg-background border rounded-lg p-4 cursor-pointer transition-all hover:shadow-md ${
                          isActive ? 'ring-2 ring-primary' : ''
                        } ${status === 'dismissed' ? 'opacity-50' : ''}`}
                      >
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <Badge variant="outline" className="text-xs">
                            #{idx + 1}
                          </Badge>
                          <Badge 
                            variant={finding.risk_level === 'high' ? 'destructive' : 'secondary'}
                            className="text-xs"
                          >
                            {finding.risk_level}
                          </Badge>
                        </div>

                        {status === 'pending' && (
                          <>
                            <div className="space-y-2 mb-3">
                              <div>
                                <p className="text-xs font-medium text-muted-foreground mb-1">Original:</p>
                                <p className="text-sm line-clamp-2">{finding.original_text}</p>
                              </div>
                              <div>
                                <p className="text-xs font-medium text-muted-foreground mb-1">Suggested:</p>
                                <p className="text-sm text-primary line-clamp-2">{finding.suggested_text}</p>
                              </div>
                            </div>

                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                variant="default"
                                className="flex-1"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleStatusChange(finding.id, 'applied');
                                }}
                              >
                                <Check className="w-3 h-3 mr-1" />
                                Accept
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="flex-1"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleStatusChange(finding.id, 'dismissed');
                                }}
                              >
                                <X className="w-3 h-3 mr-1" />
                                Reject
                              </Button>
                            </div>
                          </>
                        )}

                        {status === 'applied' && (
                          <div className="flex items-center gap-2 text-green-600">
                            <Check className="w-4 h-4" />
                            <span className="text-sm font-medium">Applied</span>
                          </div>
                        )}

                        {status === 'dismissed' && (
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <X className="w-4 h-4" />
                            <span className="text-sm font-medium">Rejected</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
