import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { promptLibrary, PromptTemplate } from "@/types/prompts";
import { replacePlaceholders } from "@/utils/promptPlaceholders";

interface PromptLibraryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPromptSelected: (prompt: string) => void;
  selectedDocuments?: any[];
}

export const PromptLibraryDialog = ({ open, onOpenChange, onPromptSelected, selectedDocuments = [] }: PromptLibraryDialogProps) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const categories = Array.from(new Set(promptLibrary.map(p => p.category)));
  
  const filteredPrompts = promptLibrary.filter(prompt => {
    const matchesSearch = prompt.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         prompt.template.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = !selectedCategory || prompt.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const handleSelectPrompt = (template: PromptTemplate) => {
    // Replace placeholders with smart values based on context
    const processedPrompt = replacePlaceholders(template.template, selectedDocuments);
    onPromptSelected(processedPrompt);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh] bg-background">
        <DialogHeader>
          <DialogTitle>Prompt Library</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <Input
            placeholder="Search prompts..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <div className="flex gap-2 flex-wrap">
            <Badge
              variant={selectedCategory === null ? "default" : "outline"}
              className="cursor-pointer"
              onClick={() => setSelectedCategory(null)}
            >
              All
            </Badge>
            {categories.map(category => (
              <Badge
                key={category}
                variant={selectedCategory === category ? "default" : "outline"}
                className="cursor-pointer"
                onClick={() => setSelectedCategory(category)}
              >
                {category}
              </Badge>
            ))}
          </div>
          <ScrollArea className="h-[400px]">
            <div className="space-y-3">
              {filteredPrompts.map(prompt => (
                <div
                  key={prompt.id}
                  className="p-4 border rounded-lg hover:bg-accent cursor-pointer transition-colors"
                  onClick={() => handleSelectPrompt(prompt)}
                >
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="font-medium">{prompt.title}</h3>
                    <Badge variant="secondary">{prompt.category}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {prompt.template}
                  </p>
                  {prompt.placeholders.length > 0 && (
                    <div className="mt-2 flex gap-1 flex-wrap">
                      {prompt.placeholders.map(placeholder => (
                        <Badge key={placeholder} variant="outline" className="text-xs">
                          {placeholder}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  );
};
