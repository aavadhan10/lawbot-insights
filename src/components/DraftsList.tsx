import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/contexts/OrganizationContext";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { FileText, Trash2, File, PlusCircle, History } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { DraftVersionHistory } from "./DraftVersionHistory";
import { TemplatePreviewDialog } from "./TemplatePreviewDialog";
import { templates, Template } from "@/utils/templates";

interface Draft {
  id: string;
  title: string;
  document_type: string;
  created_at: string;
  updated_at: string;
  current_version: number;
  conversation_id?: string;
}

interface DraftsListProps {
  onSelectDraft: (draftId: string, conversationId?: string) => void;
  selectedDraftId?: string;
  onRestoreVersion?: (content: any) => void;
  onInsertTemplate?: (content: string) => void;
  hasOpenDocument?: boolean;
}

export const DraftsList = ({ 
  onSelectDraft, 
  selectedDraftId, 
  onRestoreVersion,
  onInsertTemplate,
  hasOpenDocument = false
}: DraftsListProps) => {
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [showTemplatePreview, setShowTemplatePreview] = useState(false);
  const { userRole } = useOrganization();

  useEffect(() => {
    loadDrafts();
  }, [userRole]);

  const loadDrafts = async () => {
    if (!userRole?.organization.id) return;

    try {
      const { data, error } = await supabase
        .from('document_drafts')
        .select('id, title, document_type, created_at, updated_at, current_version, conversation_id')
        .eq('organization_id', userRole.organization.id)
        .order('updated_at', { ascending: false });

      if (error) throw error;
      setDrafts(data || []);
    } catch (error) {
      console.error('Error loading drafts:', error);
      toast.error('Failed to load drafts');
    } finally {
      setLoading(false);
    }
  };

  const deleteDraft = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const { error } = await supabase
        .from('document_drafts')
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast.success('Draft deleted');
      loadDrafts();
    } catch (error) {
      console.error('Error deleting draft:', error);
      toast.error('Failed to delete draft');
    }
  };

  const createNewDocument = async () => {
    if (!userRole?.organization.id) return;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('document_drafts')
        .insert({
          title: 'Untitled document',
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
      
      toast.success('New document created');
      loadDrafts();
      onSelectDraft(data.id);
    } catch (error) {
      console.error('Error creating document:', error);
      toast.error('Failed to create document');
    }
  };

  const createDocumentFromTemplate = async (template: Template) => {
    if (!userRole?.organization.id) return;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('document_drafts')
        .insert({
          title: 'Untitled document',
          document_type: template.type,
          content: { text: template.content, changes: [] },
          user_id: user.id,
          organization_id: userRole.organization.id,
          current_version: 1,
          status: 'draft'
        })
        .select()
        .single();

      if (error) throw error;
      
      toast.success('Template document created');
      loadDrafts();
      onSelectDraft(data.id);
    } catch (error) {
      console.error('Error creating document from template:', error);
      toast.error('Failed to create document');
    }
  };

  const handleTemplateClick = (template: Template) => {
    setSelectedTemplate(template);
    setShowTemplatePreview(true);
  };

  if (loading) {
    return <div className="p-4 text-sm text-muted-foreground">Loading drafts...</div>;
  }

  return (
    <div className="h-full flex flex-col border-r bg-background">
      <div className="p-4 border-b space-y-3">
        <h2 className="text-lg font-semibold">Documents</h2>
        <Button 
          onClick={createNewDocument}
          className="w-full"
          variant="default"
        >
          <PlusCircle className="h-4 w-4 mr-2" />
          New Document
        </Button>
      </div>
      
      <Tabs defaultValue="drafts" className="flex-1 flex flex-col">
        <TabsList className="mx-4 mt-2 grid w-auto grid-cols-2">
          <TabsTrigger value="drafts" className="text-xs">
            <FileText className="h-3.5 w-3.5 mr-1.5" />
            Drafts
          </TabsTrigger>
          <TabsTrigger value="templates" className="text-xs">
            <File className="h-3.5 w-3.5 mr-1.5" />
            Templates
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="drafts" className="flex-1 mt-0 overflow-hidden">
          <ScrollArea className="h-full">
            <div className="p-4 space-y-2">
              {loading ? (
                <p className="text-sm text-muted-foreground">Loading drafts...</p>
              ) : drafts.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <FileText className="h-12 w-12 text-muted-foreground/40 mb-3" />
                  <p className="text-sm font-medium text-foreground mb-1">No drafts yet</p>
                  <p className="text-xs text-muted-foreground">Start a conversation to create your first draft</p>
                </div>
              ) : (
                drafts.map((draft) => (
                  <div
                    key={draft.id}
                    onClick={() => onSelectDraft(draft.id, draft.conversation_id)}
                    className={`
                      p-3 rounded-lg cursor-pointer transition-all
                      ${selectedDraftId === draft.id 
                        ? 'bg-primary/10 border-2 border-primary shadow-sm' 
                        : 'hover:bg-accent border-2 border-transparent'
                      }
                    `}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-start gap-2 flex-1 min-w-0">
                        <FileText className="h-4 w-4 mt-0.5 flex-shrink-0 text-primary" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium break-words">{draft.title}</p>
                          <p className="text-xs text-muted-foreground">
                            {draft.document_type} • v{draft.current_version}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {formatDistanceToNow(new Date(draft.updated_at), { addSuffix: true })}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <Sheet>
                          <SheetTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={(e) => e.stopPropagation()}
                              title="View version history"
                            >
                              <History className="h-4 w-4" />
                            </Button>
                          </SheetTrigger>
                          <SheetContent className="w-96 bg-background border-l shadow-2xl">
                            <SheetHeader>
                              <SheetTitle>Version History</SheetTitle>
                              <SheetDescription>
                                View and restore previous versions of this document
                              </SheetDescription>
                            </SheetHeader>
                              <DraftVersionHistory 
                                draftId={draft.id} 
                                onRestoreVersion={onRestoreVersion}
                              />
                            </SheetContent>
                          </Sheet>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 flex-shrink-0 hover:bg-destructive/10 hover:text-destructive"
                          onClick={(e) => deleteDraft(draft.id, e)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        </TabsContent>
        
        <TabsContent value="templates" className="flex-1 mt-0 overflow-hidden">
          <ScrollArea className="h-full">
            <div className="p-4 space-y-2">
              {templates.map((template) => (
                <div
                  key={template.id}
                  className="p-3 rounded-lg cursor-pointer transition-all hover:bg-accent border-2 border-transparent hover:border-primary/50"
                  onClick={() => handleTemplateClick(template)}
                >
                  <div className="flex items-start gap-2">
                    <File className="h-4 w-4 mt-0.5 flex-shrink-0 text-primary" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{template.title}</p>
                      <p className="text-xs text-muted-foreground">{template.type}</p>
                      <p className="text-xs text-muted-foreground mt-1">{template.description}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </TabsContent>
      </Tabs>

      <TemplatePreviewDialog
        template={selectedTemplate}
        open={showTemplatePreview}
        onOpenChange={setShowTemplatePreview}
        onCreateNew={() => selectedTemplate && createDocumentFromTemplate(selectedTemplate)}
        onInsertIntoCurrent={onInsertTemplate && selectedTemplate ? () => {
          onInsertTemplate(selectedTemplate.content);
          setShowTemplatePreview(false);
        } : undefined}
        hasCurrentDocument={hasOpenDocument}
      />
    </div>
  );
};
