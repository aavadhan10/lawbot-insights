import { useState, useEffect } from "react";
import { DraftingChatInterface } from "@/components/DraftingChatInterface";
import { DocumentEditor } from "@/components/DocumentEditor";
import { DraftsList } from "@/components/DraftsList";
import { useToast } from "@/hooks/use-toast";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable";

const DocumentDrafter = () => {
  const [documentContent, setDocumentContent] = useState("");
  const [displayedContent, setDisplayedContent] = useState("");
  const [documentTitle, setDocumentTitle] = useState("New Document");
  const [documentChanges, setDocumentChanges] = useState<any[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [selectedDraftId, setSelectedDraftId] = useState<string>();
  const [currentDraftId, setCurrentDraftId] = useState<string>();
  const { toast } = useToast();

  // Typing animation effect
  useEffect(() => {
    if (!documentContent) {
      setDisplayedContent("");
      return;
    }

    if (documentContent === displayedContent) return;

    // If content is shorter (user cleared or switched), update immediately
    if (documentContent.length < displayedContent.length) {
      setDisplayedContent(documentContent);
      return;
    }

    // Typing animation: add chunks of characters progressively
    const chunkSize = 50; // Characters to add per interval
    const interval = 30; // Milliseconds between updates

    const timer = setTimeout(() => {
      const nextLength = Math.min(
        displayedContent.length + chunkSize,
        documentContent.length
      );
      setDisplayedContent(documentContent.slice(0, nextLength));
    }, interval);

    return () => clearTimeout(timer);
  }, [documentContent, displayedContent]);

  const handleDocumentGenerated = (content: string, changes?: any[], draftId?: string) => {
    setDocumentContent(content);
    setDocumentTitle(changes ? "Redlined Document" : "Generated Document");
    setDocumentChanges(changes || []);
    if (draftId) {
      setCurrentDraftId(draftId);
    }
  };

  const handleExport = (format: 'txt' | 'docx' | 'pdf') => {
    if (!documentContent) return;

    if (format === 'txt') {
      const blob = new Blob([documentContent], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${documentTitle}.txt`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      toast({
        title: "Exported",
        description: "Document exported as TXT file.",
      });
    } else {
      toast({
        title: "Coming Soon",
        description: `${format.toUpperCase()} export will be available soon.`,
      });
    }
  };

  return (
    <div className="h-full flex flex-col bg-background">
      <div className="border-b px-6 py-3 flex-shrink-0 bg-card">
        <h1 className="text-xl font-semibold">Document Drafter</h1>
      </div>

      <div className="flex-1 overflow-hidden">
        <ResizablePanelGroup direction="horizontal">
          <ResizablePanel defaultSize={25} minSize={20} maxSize={35}>
            <DraftingChatInterface
              onDocumentGenerated={handleDocumentGenerated}
              onGeneratingChange={setIsGenerating}
              selectedDraftId={selectedDraftId}
              onDocumentNameChange={setDocumentTitle}
            />
          </ResizablePanel>
          
          <ResizableHandle withHandle />
          
          <ResizablePanel defaultSize={75} minSize={50}>
            <div className="h-full">
              <DocumentEditor
                content={displayedContent}
                title={documentTitle}
                changes={documentChanges}
                isGenerating={isGenerating}
                onExport={handleExport}
                draftId={currentDraftId}
              />
            </div>
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
    </div>
  );
};

export default DocumentDrafter;