import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { DraftingChatInterface } from "./DraftingChatInterface";

interface ChatDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDocumentGenerated: (content: string, changes?: any[], draftId?: string) => void;
  onGeneratingChange: (isGenerating: boolean) => void;
  selectedDraftId?: string;
  selectedConversationId?: string;
  onDocumentNameChange?: (name: string) => void;
}

export const ChatDialog = ({
  open,
  onOpenChange,
  onDocumentGenerated,
  onGeneratingChange,
  selectedDraftId,
  selectedConversationId,
  onDocumentNameChange
}: ChatDialogProps) => {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:w-[500px] p-0 flex flex-col">
        <SheetHeader className="px-6 py-4 border-b">
          <SheetTitle>AI Assistant</SheetTitle>
        </SheetHeader>
        <div className="flex-1 overflow-hidden">
          <DraftingChatInterface
            onDocumentGenerated={onDocumentGenerated}
            onGeneratingChange={onGeneratingChange}
            selectedDraftId={selectedDraftId}
            selectedConversationId={selectedConversationId}
            onDocumentNameChange={onDocumentNameChange}
          />
        </div>
      </SheetContent>
    </Sheet>
  );
};
