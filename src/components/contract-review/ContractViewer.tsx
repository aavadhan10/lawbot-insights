import { useState, useEffect } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { supabase } from "@/integrations/supabase/client";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2 } from "lucide-react";

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
        
        // Replace the marker with the highlighted version
        const replacement = `<span class="relative inline-block">
          <span class="line-through text-destructive/70 bg-destructive/10 px-1">${originalText}</span>
          <span class="text-success bg-success/10 px-1 ml-1 font-medium">${suggestedText}</span>
        </span>`;
        
        highlightedText = highlightedText.replace(marker, replacement);
      }
    });

    return highlightedText;
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-2xl lg:max-w-4xl">
        <SheetHeader>
          <SheetTitle>Contract with Highlighted Changes</SheetTitle>
        </SheetHeader>
        
        <ScrollArea className="h-[calc(100vh-8rem)] mt-6">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin" />
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex gap-4 text-sm mb-4 p-3 bg-muted rounded-lg">
                <div className="flex items-center gap-2">
                  <span className="line-through text-destructive/70 bg-destructive/10 px-2 py-1 rounded">Original</span>
                  <span className="text-muted-foreground">= Problematic text</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-success bg-success/10 px-2 py-1 rounded font-medium">Suggested</span>
                  <span className="text-muted-foreground">= Recommended replacement</span>
                </div>
              </div>
              
              <div 
                className="prose prose-sm max-w-none whitespace-pre-wrap font-mono text-sm leading-relaxed"
                dangerouslySetInnerHTML={{ __html: highlightContract(contractText) }}
              />
            </div>
          )}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
