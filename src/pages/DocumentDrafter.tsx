import { useState, useEffect } from "react";
import { DocumentEditor } from "@/components/DocumentEditor";
import { DraftsList } from "@/components/DraftsList";
import { DraftVersionHistory } from "@/components/DraftVersionHistory";
import { ChatDialog } from "@/components/ChatDialog";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { MessageSquare } from "lucide-react";

const DocumentDrafter = () => {
  const [documentContent, setDocumentContent] = useState("");
  const [displayedContent, setDisplayedContent] = useState("");
  const [documentTitle, setDocumentTitle] = useState("New Document");
  const [documentChanges, setDocumentChanges] = useState<any[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [selectedDraftId, setSelectedDraftId] = useState<string>();
  const [selectedConversationId, setSelectedConversationId] = useState<string>();
  const [currentDraftId, setCurrentDraftId] = useState<string>();
  const [isChatOpen, setIsChatOpen] = useState(false);
  const { toast } = useToast();

  // Check localStorage for selectedDraftId on mount
  useEffect(() => {
    const storedDraftId = localStorage.getItem('selectedDraftId');
    if (storedDraftId) {
      setSelectedDraftId(storedDraftId);
      localStorage.removeItem('selectedDraftId');
    }
  }, []);

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

  const handleSelectDraft = (draftId: string, conversationId?: string) => {
    setSelectedDraftId(draftId);
    setSelectedConversationId(conversationId);
  };

  const handleRestoreVersion = (content: any) => {
    setDocumentContent(content.text || content);
    toast({
      title: "Version Restored",
      description: "The document has been restored to the selected version.",
    });
  };

  return (
    <div className="h-full flex flex-col bg-gradient-to-br from-background via-muted/30 to-background">
      {/* Header */}
      <div className="px-6 py-8 flex-shrink-0 border-b bg-background/50 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Document Drafter</h1>
              <div className="flex items-center gap-2 mt-1">
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                  AI: Ready
                </span>
              </div>
            </div>
            <DraftVersionHistory 
              draftId={currentDraftId || ''} 
              onRestoreVersion={handleRestoreVersion}
            />
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-hidden flex">
        {/* Left Sidebar - Drafts List */}
        <div className="w-80 flex-shrink-0">
          <DraftsList
            onSelectDraft={handleSelectDraft}
            selectedDraftId={selectedDraftId}
          />
        </div>

        {/* Right - Document Editor */}
        <div className="flex-1 relative">
          <DocumentEditor
            content={displayedContent}
            title={documentTitle}
            changes={documentChanges}
            isGenerating={isGenerating}
            onExport={handleExport}
            draftId={currentDraftId}
          />
          
          {/* Floating Chat Button */}
          <Button
            onClick={() => setIsChatOpen(true)}
            className="fixed bottom-8 right-8 h-14 w-14 rounded-full shadow-lg hover:shadow-xl transition-all"
            size="icon"
          >
            <MessageSquare className="h-5 w-5" />
          </Button>
        </div>
      </div>

      {/* Chat Dialog */}
      <ChatDialog
        open={isChatOpen}
        onOpenChange={setIsChatOpen}
        onDocumentGenerated={handleDocumentGenerated}
        onGeneratingChange={setIsGenerating}
        selectedDraftId={selectedDraftId}
        selectedConversationId={selectedConversationId}
        onDocumentNameChange={setDocumentTitle}
      />
    </div>
  );
};

export default DocumentDrafter;