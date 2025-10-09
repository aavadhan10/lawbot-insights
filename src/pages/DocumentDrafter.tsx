import { useState, useEffect } from "react";
import { DocumentEditor } from "@/components/DocumentEditor";
import { DraftsList } from "@/components/DraftsList";
import { DraftingChatInterface } from "@/components/DraftingChatInterface";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { PlusCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/contexts/OrganizationContext";

const DocumentDrafter = () => {
  const [documentContent, setDocumentContent] = useState("");
  const [displayedContent, setDisplayedContent] = useState("");
  const [documentTitle, setDocumentTitle] = useState("New Document");
  const [documentChanges, setDocumentChanges] = useState<any[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [selectedDraftId, setSelectedDraftId] = useState<string>();
  const [selectedConversationId, setSelectedConversationId] = useState<string>();
  const [currentDraftId, setCurrentDraftId] = useState<string>();
  const { toast } = useToast();
  const { userRole } = useOrganization();

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

  const handleTitleSaved = (newTitle: string) => {
    setDocumentTitle(newTitle);
  };

  const createNewDocument = async () => {
    if (!userRole?.organization.id) return;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    try {
      const timestamp = new Date().toLocaleString();
      const { data, error } = await supabase
        .from('document_drafts')
        .insert({
          title: `Untitled Document - ${timestamp}`,
          document_type: 'General',
          content: { text: '', changes: [] },
          user_id: user.id,
          organization_id: userRole.organization.id,
          current_version: 1,
          status: 'draft'
        })
        .select()
        .single();

      if (error) throw error;
      
      toast({
        title: "Success",
        description: "New document created",
      });
      setSelectedDraftId(data.id);
      setCurrentDraftId(data.id);
    } catch (error) {
      console.error('Error creating document:', error);
      toast({
        title: "Error",
        description: "Failed to create document",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="h-full flex flex-col bg-gradient-to-br from-background via-muted/30 to-background">
      {/* Header */}
      <div className="px-6 py-8 flex-shrink-0 border-b bg-gradient-to-b from-background to-muted/20">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between bg-card rounded-2xl px-6 py-4 shadow-lg border border-white/10">
            <h1 className="text-2xl font-bold tracking-tight">Document Drafter</h1>
            <Button 
              onClick={createNewDocument}
              variant="default"
              size="sm"
            >
              <PlusCircle className="h-4 w-4 mr-2" />
              New Document
            </Button>
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
            onRestoreVersion={handleRestoreVersion}
          />
        </div>

        {/* Right - Document Editor & Chat */}
        <div className="flex-1 flex flex-col">
          <div className="flex-1 overflow-hidden">
            <DocumentEditor
              content={displayedContent}
              title={documentTitle}
              changes={documentChanges}
              isGenerating={isGenerating}
              onExport={handleExport}
              draftId={currentDraftId}
              onTitleSaved={handleTitleSaved}
            />
          </div>
          
          {/* Chat Interface at Bottom */}
          <div className="border-t bg-background">
            <DraftingChatInterface
              onDocumentGenerated={handleDocumentGenerated}
              onGeneratingChange={setIsGenerating}
              selectedDraftId={selectedDraftId}
              selectedConversationId={selectedConversationId}
              onDocumentNameChange={setDocumentTitle}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default DocumentDrafter;
