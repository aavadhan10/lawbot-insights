import { useState, useEffect } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { supabase } from "@/integrations/supabase/client";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, FileText } from "lucide-react";

interface Finding {
  id: string;
  original_text: string | null;
  suggested_text: string | null;
  clause_text: string;
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

  useEffect(() => {
    if (open && documentId) {
      loadContract();
    }
  }, [open, documentId]);

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
    
    // Sort findings by original_text length (longest first) to avoid partial replacements
    const sortedFindings = [...findings]
      .filter(f => f.original_text && f.suggested_text)
      .sort((a, b) => (b.original_text?.length || 0) - (a.original_text?.length || 0));

    sortedFindings.forEach((finding, index) => {
      if (finding.original_text && finding.suggested_text) {
        const originalText = finding.original_text.trim();
        const suggestedText = finding.suggested_text.trim();
        
        // Create a unique marker for this replacement
        const marker = `__REPLACEMENT_${index}__`;
        
        // Replace the original text with a marker
        highlightedText = highlightedText.replace(
          originalText,
          marker
        );
        
        // Replace the marker with the highlighted version (strikethrough in red, suggestion in blue)
        const replacement = `<span class="inline">
          <span class="line-through decoration-2" style="color: #dc2626; background-color: rgba(254, 202, 202, 0.3);">${originalText}</span>
          <span class="font-normal" style="color: #1e40af; background-color: rgba(191, 219, 254, 0.5);"> ${suggestedText}</span>
        </span>`;
        
        highlightedText = highlightedText.replace(marker, replacement);
      }
    });

    return highlightedText;
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-3xl lg:max-w-5xl p-0">
        <div className="bg-gradient-to-b from-primary/5 to-background h-full flex flex-col">
          <SheetHeader className="px-6 py-4 border-b bg-background/80 backdrop-blur">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <FileText className="w-5 h-5 text-primary" />
              </div>
              <SheetTitle className="text-xl">Contract Document</SheetTitle>
            </div>
          </SheetHeader>
          
          <ScrollArea className="flex-1 px-6 py-6">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            ) : (
              <div className="space-y-6">
                <div className="flex gap-6 text-xs p-4 bg-background border rounded-lg shadow-sm">
                  <div className="flex items-center gap-2">
                    <span className="line-through decoration-2 px-2 py-1 rounded" style={{ color: '#dc2626', backgroundColor: 'rgba(254, 202, 202, 0.3)' }}>Strikethrough</span>
                    <span className="text-muted-foreground">= Problematic</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-1 rounded" style={{ color: '#1e40af', backgroundColor: 'rgba(191, 219, 254, 0.5)' }}>Highlighted</span>
                    <span className="text-muted-foreground">= Suggested</span>
                  </div>
                </div>
                
                <div className="bg-background rounded-lg shadow-md border p-12 min-h-[600px]">
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
              </div>
            )}
          </ScrollArea>
        </div>
      </SheetContent>
    </Sheet>
  );
}
