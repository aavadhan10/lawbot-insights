import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { formatDistanceToNow } from "date-fns";
import { FileText, Pencil, Check, X } from "lucide-react";
import { toast } from "sonner";

interface DraftVersion {
  id: string;
  version_number: number;
  content: any;
  created_at: string;
  changes_summary?: string;
  version_name?: string;
}

interface DraftVersionHistoryProps {
  draftId: string;
  onRestoreVersion: (content: any) => void;
}

export const DraftVersionHistory = ({ draftId, onRestoreVersion }: DraftVersionHistoryProps) => {
  const [versions, setVersions] = useState<DraftVersion[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingVersionId, setEditingVersionId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");

  const loadVersions = async () => {
    if (!draftId) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('draft_versions')
        .select('*')
        .eq('draft_id', draftId)
        .order('version_number', { ascending: false });

      if (error) throw error;
      setVersions(data || []);
    } catch (error) {
      console.error('Error loading versions:', error);
      toast.error('Failed to load version history');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadVersions();
  }, [draftId]);

  const handleRestore = (version: DraftVersion) => {
    onRestoreVersion(version.content);
    const versionLabel = version.version_name || `Version ${version.version_number}`;
    toast.success(`Restored to ${versionLabel}`);
  };

  const handleStartEdit = (version: DraftVersion) => {
    setEditingVersionId(version.id);
    setEditingName(version.version_name || "");
  };

  const handleSaveEdit = async (versionId: string) => {
    try {
      const { error } = await supabase
        .from('draft_versions')
        .update({ version_name: editingName || null })
        .eq('id', versionId);

      if (error) throw error;

      setVersions(versions.map(v => 
        v.id === versionId ? { ...v, version_name: editingName || undefined } : v
      ));
      setEditingVersionId(null);
      toast.success("Version name updated");
    } catch (error) {
      console.error('Error updating version name:', error);
      toast.error('Failed to update version name');
    }
  };

  const handleCancelEdit = () => {
    setEditingVersionId(null);
    setEditingName("");
  };

  return (
    <ScrollArea className="h-[calc(100vh-12rem)]">
      {loading ? (
        <div className="text-sm text-muted-foreground text-center py-8">
          Loading versions...
        </div>
      ) : versions.length === 0 ? (
        <div className="text-sm text-muted-foreground text-center py-8">
          No version history yet
        </div>
      ) : (
        <div className="space-y-3">
          {versions.map((version) => (
            <div
              key={version.id}
              className="p-4 border rounded-lg bg-background hover:bg-muted/50 transition-colors"
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <FileText className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                  {editingVersionId === version.id ? (
                    <div className="flex items-center gap-1 flex-1">
                      <Input
                        value={editingName}
                        onChange={(e) => setEditingName(e.target.value)}
                        className="h-7 text-sm"
                        placeholder={`Version ${version.version_number}`}
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleSaveEdit(version.id);
                          if (e.key === 'Escape') handleCancelEdit();
                        }}
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0"
                        onClick={() => handleSaveEdit(version.id)}
                      >
                        <Check className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0"
                        onClick={handleCancelEdit}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ) : (
                    <>
                      <span className="font-medium flex-1 break-words">
                        {version.version_name || `Version ${version.version_number}`}
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 flex-shrink-0"
                        onClick={() => handleStartEdit(version)}
                      >
                        <Pencil className="h-3 w-3" />
                      </Button>
                    </>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleRestore(version)}
                  className="flex-shrink-0"
                >
                  Restore
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mb-2">
                {formatDistanceToNow(new Date(version.created_at), { addSuffix: true })}
              </p>
              {version.changes_summary && (
                <p className="text-sm text-muted-foreground break-words">
                  {version.changes_summary}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </ScrollArea>
  );
};
