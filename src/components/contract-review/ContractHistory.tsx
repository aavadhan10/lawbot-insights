import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { History, Eye, Clock } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";

interface Version {
  id: string;
  version_number: number;
  content: string;
  created_at: string;
  created_by: string;
}

interface ContractHistoryProps {
  documentId: string;
}

export default function ContractHistory({ documentId }: ContractHistoryProps) {
  const [versions, setVersions] = useState<Version[]>([]);
  const [selectedVersion, setSelectedVersion] = useState<Version | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadVersions();
  }, [documentId]);

  const loadVersions = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('document_versions')
        .select('*')
        .eq('draft_id', documentId)
        .order('version_number', { ascending: false });

      if (error) throw error;
      setVersions(data || []);
    } catch (error) {
      console.error('Error loading versions:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePreviewVersion = (version: Version) => {
    setSelectedVersion(version);
    setShowPreview(true);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (isLoading) {
    return (
      <Card className="p-6">
        <p className="text-sm text-muted-foreground">Loading history...</p>
      </Card>
    );
  }

  if (versions.length === 0) {
    return (
      <Card className="p-6">
        <div className="flex items-center gap-3 mb-2">
          <History className="w-5 h-5 text-muted-foreground" />
          <h3 className="font-semibold">Contract History</h3>
        </div>
        <p className="text-sm text-muted-foreground">
          No saved versions yet. Save changes in Edit Mode to create version history.
        </p>
      </Card>
    );
  }

  return (
    <>
      <Card className="p-6">
        <div className="flex items-center gap-3 mb-4">
          <History className="w-5 h-5 text-muted-foreground" />
          <h3 className="font-semibold">Contract History</h3>
          <Badge variant="secondary" className="ml-auto">
            {versions.length} {versions.length === 1 ? 'version' : 'versions'}
          </Badge>
        </div>

        <ScrollArea className="h-[300px] pr-4">
          <div className="space-y-2">
            {versions.map((version) => (
              <div
                key={version.id}
                className="border rounded-lg p-4 hover:bg-accent transition-colors"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant="outline" className="text-xs">
                        Version {version.version_number}
                      </Badge>
                      <Clock className="w-3 h-3 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">
                        {formatDate(version.created_at)}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {version.content.substring(0, 150)}...
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handlePreviewVersion(version)}
                    className="flex-shrink-0"
                  >
                    <Eye className="w-4 h-4 mr-1" />
                    View
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </Card>

      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="max-w-4xl max-h-[85vh]">
          <DialogHeader>
            <DialogTitle>
              Version {selectedVersion?.version_number} Preview
            </DialogTitle>
            <p className="text-sm text-muted-foreground">
              Saved on {selectedVersion && formatDate(selectedVersion.created_at)}
            </p>
          </DialogHeader>
          <ScrollArea className="h-[60vh] mt-4">
            <div className="p-6 bg-muted/30 rounded-lg">
              <pre className="whitespace-pre-wrap font-serif text-sm leading-relaxed">
                {selectedVersion?.content}
              </pre>
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </>
  );
}
