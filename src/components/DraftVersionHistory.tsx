import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { formatDistanceToNow } from "date-fns";
import { History, FileText } from "lucide-react";
import { toast } from "sonner";

interface DraftVersion {
  id: string;
  version_number: number;
  content: any;
  created_at: string;
  changes_summary?: string;
}

interface DraftVersionHistoryProps {
  draftId: string;
  onRestoreVersion: (content: any) => void;
}

export const DraftVersionHistory = ({ draftId, onRestoreVersion }: DraftVersionHistoryProps) => {
  const [versions, setVersions] = useState<DraftVersion[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const loadVersions = async () => {
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
    if (isOpen && draftId) {
      loadVersions();
    }
  }, [isOpen, draftId]);

  const handleRestore = (version: DraftVersion) => {
    onRestoreVersion(version.content);
    setIsOpen(false);
    toast.success(`Restored to version ${version.version_number}`);
  };

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setIsOpen(true)}
        disabled={!draftId}
      >
        <History className="w-4 h-4 mr-2" />
        Version History
      </Button>

      <Sheet open={isOpen} onOpenChange={setIsOpen}>
        <SheetContent className="w-96">
          <SheetHeader>
            <SheetTitle>Version History</SheetTitle>
          </SheetHeader>

          <ScrollArea className="h-[calc(100vh-8rem)] mt-4">
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
                    className="p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4 text-muted-foreground" />
                        <span className="font-medium">Version {version.version_number}</span>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRestore(version)}
                      >
                        Restore
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground mb-2">
                      {formatDistanceToNow(new Date(version.created_at), { addSuffix: true })}
                    </p>
                    {version.changes_summary && (
                      <p className="text-sm text-muted-foreground">
                        {version.changes_summary}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </SheetContent>
      </Sheet>
    </>
  );
};
