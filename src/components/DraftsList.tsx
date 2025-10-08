import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/contexts/OrganizationContext";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { FileText, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

interface Draft {
  id: string;
  title: string;
  document_type: string;
  created_at: string;
  updated_at: string;
  current_version: number;
}

interface DraftsListProps {
  onSelectDraft: (draftId: string) => void;
  selectedDraftId?: string;
}

export const DraftsList = ({ onSelectDraft, selectedDraftId }: DraftsListProps) => {
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [loading, setLoading] = useState(true);
  const { userRole } = useOrganization();

  useEffect(() => {
    loadDrafts();
  }, [userRole]);

  const loadDrafts = async () => {
    if (!userRole?.organization.id) return;

    try {
      const { data, error } = await supabase
        .from('document_drafts')
        .select('id, title, document_type, created_at, updated_at, current_version')
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

  if (loading) {
    return <div className="p-4 text-sm text-muted-foreground">Loading drafts...</div>;
  }

  return (
    <ScrollArea className="h-full">
      <div className="p-4 space-y-2">
        <h3 className="text-sm font-semibold mb-3">Recent Drafts</h3>
        {drafts.length === 0 ? (
          <p className="text-sm text-muted-foreground">No drafts yet</p>
        ) : (
          drafts.map((draft) => (
            <div
              key={draft.id}
              onClick={() => onSelectDraft(draft.id)}
              className={`
                p-3 rounded-lg cursor-pointer transition-colors
                ${selectedDraftId === draft.id 
                  ? 'bg-primary/10 border border-primary' 
                  : 'hover:bg-accent border border-transparent'
                }
              `}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-start gap-2 flex-1 min-w-0">
                  <FileText className="h-4 w-4 mt-0.5 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{draft.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {draft.document_type} • v{draft.current_version}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(draft.updated_at), { addSuffix: true })}
                    </p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 flex-shrink-0"
                  onClick={(e) => deleteDraft(draft.id, e)}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </div>
          ))
        )}
      </div>
    </ScrollArea>
  );
};
