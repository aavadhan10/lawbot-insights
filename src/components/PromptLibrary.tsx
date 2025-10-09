import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { promptLibrary, type PromptTemplate } from "@/types/prompts";
import { FileText } from "lucide-react";

interface PromptLibraryProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectPrompt: (filledPrompt: string) => void;
}

export const PromptLibrary = ({ open, onOpenChange, onSelectPrompt }: PromptLibraryProps) => {
  const [selectedPrompt, setSelectedPrompt] = useState<PromptTemplate | null>(null);
  const [placeholderValues, setPlaceholderValues] = useState<Record<string, string>>({});

  const handlePromptClick = (prompt: PromptTemplate) => {
    setSelectedPrompt(prompt);
    const initialValues: Record<string, string> = {};
    prompt.placeholders.forEach(ph => {
      initialValues[ph] = "";
    });
    setPlaceholderValues(initialValues);
  };

  const handleBack = () => {
    setSelectedPrompt(null);
    setPlaceholderValues({});
  };

  const handleUsePrompt = () => {
    if (!selectedPrompt) return;

    let filledPrompt = selectedPrompt.template;
    Object.entries(placeholderValues).forEach(([key, value]) => {
      filledPrompt = filledPrompt.replace(`[[[${key}]]]`, value || `[${key}]`);
    });

    onSelectPrompt(filledPrompt);
    onOpenChange(false);
    setSelectedPrompt(null);
    setPlaceholderValues({});
  };

  const categories = Array.from(new Set(promptLibrary.map(p => p.category)));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh] bg-background">
        <DialogHeader>
          <DialogTitle>Prompt Library</DialogTitle>
        </DialogHeader>

        {!selectedPrompt ? (
          <ScrollArea className="h-[500px] pr-4">
            {categories.map(category => (
              <div key={category} className="mb-6">
                <h3 className="text-sm font-semibold mb-3 text-muted-foreground">{category}</h3>
                <div className="space-y-2">
                  {promptLibrary
                    .filter(p => p.category === category)
                    .map(prompt => (
                      <button
                        key={prompt.id}
                        onClick={() => handlePromptClick(prompt)}
                        className="w-full text-left p-3 rounded-lg border hover:bg-accent transition-colors"
                      >
                        <div className="flex items-start gap-3">
                          <FileText className="w-4 h-4 mt-1 text-muted-foreground" />
                          <div className="flex-1">
                            <div className="font-medium mb-1">{prompt.title}</div>
                            <div className="text-sm text-muted-foreground line-clamp-2">
                              {prompt.template.substring(0, 100)}...
                            </div>
                          </div>
                        </div>
                      </button>
                    ))}
                </div>
              </div>
            ))}
          </ScrollArea>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={handleBack}>
                ← Back
              </Button>
              <Badge>{selectedPrompt.category}</Badge>
            </div>

            <div className="p-4 bg-muted rounded-lg">
              <div className="text-sm font-medium mb-2">Prompt Template:</div>
              <div className="text-sm whitespace-pre-wrap">{selectedPrompt.template}</div>
            </div>

            <ScrollArea className="h-[300px]">
              <div className="space-y-4 pr-4">
                <div className="text-sm font-semibold mb-2">Fill in the placeholders:</div>
                {selectedPrompt.placeholders.map(placeholder => (
                  <div key={placeholder} className="space-y-2">
                    <Label htmlFor={placeholder}>{placeholder}</Label>
                    <Input
                      id={placeholder}
                      value={placeholderValues[placeholder] || ""}
                      onChange={(e) => setPlaceholderValues(prev => ({
                        ...prev,
                        [placeholder]: e.target.value
                      }))}
                      placeholder={`Enter ${placeholder.toLowerCase()}`}
                    />
                  </div>
                ))}
              </div>
            </ScrollArea>

            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button variant="outline" onClick={handleBack}>
                Cancel
              </Button>
              <Button onClick={handleUsePrompt}>
                Use This Prompt
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
