import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Template } from "@/utils/templates";
import { FileText, Plus } from "lucide-react";

interface TemplatePreviewDialogProps {
  template: Template | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onInsertIntoCurrent?: () => void;
  onCreateNew: () => void;
  hasCurrentDocument: boolean;
}

export const TemplatePreviewDialog = ({
  template,
  open,
  onOpenChange,
  onInsertIntoCurrent,
  onCreateNew,
  hasCurrentDocument
}: TemplatePreviewDialogProps) => {
  if (!template) return null;

  const previewContent = template.content.length > 500 
    ? template.content.slice(0, 500) + '\n\n...'
    : template.content;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl bg-white dark:bg-neutral-950">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <FileText className="h-6 w-6 text-primary" />
            <div>
              <DialogTitle className="text-xl">{template.title}</DialogTitle>
              <DialogDescription className="mt-1">
                {template.description}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4">
          <div className="border rounded-lg p-4 bg-muted/30">
            <h4 className="text-sm font-medium mb-2">Template Preview</h4>
            <ScrollArea className="h-[400px] w-full rounded border bg-background">
              <pre className="p-4 text-xs font-mono whitespace-pre-wrap break-words">
                {previewContent}
              </pre>
            </ScrollArea>
          </div>

          <div className="flex items-center gap-3 pt-2">
            {hasCurrentDocument && onInsertIntoCurrent && (
              <Button
                onClick={() => {
                  onInsertIntoCurrent();
                  onOpenChange(false);
                }}
                className="flex-1"
                variant="default"
              >
                <Plus className="h-4 w-4 mr-2" />
                Insert into Current Document
              </Button>
            )}
            <Button
              onClick={() => {
                onCreateNew();
                onOpenChange(false);
              }}
              className="flex-1"
              variant={hasCurrentDocument ? "outline" : "default"}
            >
              <FileText className="h-4 w-4 mr-2" />
              Create New Document
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
