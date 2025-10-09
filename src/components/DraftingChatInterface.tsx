import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Send, Loader2, ChevronDown, ChevronRight, Check, FileText, AlignLeft, Scissors, Upload } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/contexts/OrganizationContext";
import { NoOrganizationWarning } from "@/components/NoOrganizationWarning";
import { FileUploadDialog } from "./FileUploadDialog";
import { PromptLibraryDialog } from "./PromptLibraryDialog";

interface Step {
  label: string;
  completed: boolean;
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface DraftingChatInterfaceProps {
  onDocumentGenerated: (content: string, changes?: any[], draftId?: string) => void;
  onGeneratingChange: (isGenerating: boolean) => void;
  selectedDraftId?: string;
  selectedConversationId?: string;
}

export const DraftingChatInterface = ({ 
  onDocumentGenerated,
  onGeneratingChange,
  selectedDraftId,
  selectedConversationId
}: DraftingChatInterfaceProps) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [currentDraftTitle, setCurrentDraftTitle] = useState("");
  const [steps, setSteps] = useState<Step[]>([]);
  const [showSteps, setShowSteps] = useState(true);
  const [uploadedFile, setUploadedFile] = useState<{ name: string; content: string } | null>(null);
  const [showFileDialog, setShowFileDialog] = useState(false);
  const [showPromptDialog, setShowPromptDialog] = useState(false);
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const [currentDraftId, setCurrentDraftId] = useState<string | null>(null);
  const [isDraggingFile, setIsDraggingFile] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const saveTimeoutRef = useRef<NodeJS.Timeout>();
  const scrollRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const { userRole, loading } = useOrganization();
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => setUser(user));
  }, []);

  useEffect(() => {
    if (selectedDraftId) {
      loadDraft(selectedDraftId);
    } else if (selectedConversationId) {
      setCurrentConversationId(selectedConversationId);
    }
    // Do not auto-create a conversation on mount; wait until first message
  }, [selectedDraftId, selectedConversationId, user, userRole]);

  useEffect(() => {
    if (currentConversationId && user) {
      // Load conversation messages
      loadConversationMessages();
    }
  }, [currentConversationId]);


  const createNewConversation = async (initialTitle?: string) => {
    if (!user || !userRole?.organization.id) return;
    
    try {
      const { data, error } = await supabase
        .from('conversations')
        .insert({
          user_id: user.id,
          organization_id: userRole.organization.id,
          title: initialTitle || 'New Document Draft',
          conversation_type: 'drafter'
        })
        .select()
        .single();

      if (error) throw error;
      if (data) {
        setCurrentConversationId(data.id);
      }
    } catch (error) {
      console.error('Error creating conversation:', error);
    }
  };

  const loadConversationMessages = async () => {
    if (!currentConversationId) return;

    try {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', currentConversationId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      
      if (data) {
        setMessages(data.map(msg => ({
          role: msg.role as 'user' | 'assistant',
          content: msg.content
        })));
      }
    } catch (error) {
      console.error('Error loading messages:', error);
    }
  };

  const loadDraft = async (draftId: string) => {
    try {
      const { data, error } = await supabase
        .from('document_drafts')
        .select('*, conversation_id')
        .eq('id', draftId)
        .single();

      if (error) throw error;

      if (data) {
        setCurrentDraftId(data.id);
        setCurrentDraftTitle(data.title);
        
        // Load the conversation if it exists
        if (data.conversation_id) {
          setCurrentConversationId(data.conversation_id);
        }

        // Load the document content
        const contentData = data.content as any;
        const content = typeof contentData === 'string' 
          ? contentData 
          : contentData?.text || '';
        
        onDocumentGenerated(content, contentData?.changes || [], data.id);
      }
    } catch (error) {
      console.error('Error loading draft:', error);
      toast({
        title: "Error",
        description: "Failed to load draft",
        variant: "destructive",
      });
    }
  };

  const autoSaveDraft = async () => {
    if (!user || !userRole?.organization.id || !currentConversationId) return;
    
    setIsSaving(true);
    try {
      // Find the last assistant message with document content
      const lastAssistantMsg = messages.filter(m => m.role === 'assistant').pop();
      if (!lastAssistantMsg) return;

      const content = lastAssistantMsg.content;

      if (currentDraftId) {
        // Update existing draft
        const { error } = await supabase
          .from('document_drafts')
          .update({
            content: { text: content, changes: [] },
            updated_at: new Date().toISOString(),
          })
          .eq('id', currentDraftId);

        if (error) throw error;

        // Save a version snapshot
        const { data: draftData } = await supabase
          .from('document_drafts')
          .select('current_version')
          .eq('id', currentDraftId)
          .single();

        if (draftData) {
          const nextVersion = (draftData.current_version || 0) + 1;
          
          // Save to draft_versions table
          await supabase
            .from('draft_versions')
            .insert({
              draft_id: currentDraftId,
              version_number: nextVersion,
              content: { text: content, changes: [] },
              changes_summary: `Auto-saved on ${new Date().toLocaleString()}`,
            });

          // Update current_version in document_drafts
          await supabase
            .from('document_drafts')
            .update({ current_version: nextVersion })
            .eq('id', currentDraftId);
        }
      } else {
        // Create new draft
        const { data, error } = await supabase
          .from('document_drafts')
          .insert({
            user_id: user.id,
            organization_id: userRole.organization.id,
            title: 'Untitled document',
            document_type: 'General',
            content: { text: content, changes: [] },
            conversation_id: currentConversationId,
            status: 'draft',
            current_version: 1,
          })
          .select()
          .single();

        if (error) throw error;
        
        if (data?.id) {
          setCurrentDraftId(data.id);
          onDocumentGenerated(content, [], data.id);

          // Save initial version
          await supabase
            .from('draft_versions')
            .insert({
              draft_id: data.id,
              version_number: 1,
              content: { text: content, changes: [] },
              changes_summary: 'Initial version',
            });
        }
      }
      
      setLastSaved(new Date());
    } catch (error) {
      console.error('Error auto-saving draft:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const saveMessage = async (role: 'user' | 'assistant', content: string) => {
    if (!currentConversationId) return;

    try {
      const { error } = await supabase
        .from('messages')
        .insert({
          conversation_id: currentConversationId,
          role,
          content
        });

      if (error) throw error;
    } catch (error) {
      console.error('Error saving message:', error);
    }
  };

  const sendMessage = async (messageText: string, retryCount = 0) => {
    if (!messageText.trim() || isLoading) return;
    
    // Include uploaded file context if available
    const fullMessage = uploadedFile 
      ? `${messageText}\n\n[Referencing uploaded document: ${uploadedFile.name}]\n\n${uploadedFile.content}`
      : messageText;
    
    // Input validation
    const wordCount = messageText.trim().split(/\s+/).filter(word => word.length > 0).length;
    
    if (wordCount < 9) {
      toast({
        title: "More context needed",
        description: "Please provide at least 9 words to help generate a better document.",
        variant: "destructive",
      });
      return;
    }
    
    if (messageText.length > 10000) {
      toast({
        title: "Message too long",
        description: "Please keep your message under 10,000 characters.",
        variant: "destructive",
      });
      return;
    }
    
    // Ensure a conversation exists; create it on first message with a sensible title
    if (!currentConversationId) {
      const derivedTitle = messageText.slice(0, 60) + (messageText.length > 60 ? '...' : '');
      await createNewConversation(derivedTitle);
    }

    const mode = 'generate';

    // Initialize steps
    const draftSteps: Step[] = [
      { label: "Assessing query", completed: false },
      { label: "Drafting document", completed: false },
      { label: "Finalizing", completed: false },
    ];
    setSteps(draftSteps);
    setShowSteps(true);

    const userMessage: Message = { role: 'user', content: messageText };
    setMessages(prev => [...prev, userMessage]);
    
    // Save user message to database
    await saveMessage('user', messageText);
    
    setInput("");
    setIsLoading(true);
    onGeneratingChange(true);

    try {
      // Get the user's session token
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('No active session');
      }

      // Use streaming for real-time updates
      const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/draft-document`;
      
      const response = await fetch(CHAT_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
          'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify({
          prompt: fullMessage,
          mode,
          documentType: 'legal document'
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        const errorMessage = errorData.error || 'Failed to generate document';
        
        // Show specific error messages for rate limits
        if (response.status === 429) {
          toast({
            title: "Rate Limit Exceeded",
            description: errorMessage,
            variant: "destructive",
          });
        } else if (response.status === 402) {
          toast({
            title: "Payment Required",
            description: errorMessage,
            variant: "destructive",
          });
        } else if (response.status === 403) {
          toast({
            title: "Access Denied",
            description: errorMessage,
            variant: "destructive",
          });
        } else if (response.status === 401) {
          toast({
            title: "Authentication Required",
            description: "Please log in to continue.",
            variant: "destructive",
          });
        } else {
          toast({
            title: "Error",
            description: errorMessage,
            variant: "destructive",
          });
        }
        
        throw new Error(errorMessage);
      }

      if (!response.body) {
        throw new Error('No response body');
      }

      // Mark first step complete
      setSteps(prev => prev.map((s, i) => i === 0 ? { ...s, completed: true } : s));

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let textBuffer = "";
      let streamDone = false;
      let accumulatedContent = "";
      let chunkCount = 0;

      // Mark second step complete when streaming starts
      setSteps(prev => prev.map((s, i) => i === 1 ? { ...s, completed: true } : s));

      while (!streamDone) {
        const { done, value } = await reader.read();
        if (done) break;
        textBuffer += decoder.decode(value, { stream: true });
        chunkCount++;

        let newlineIndex: number;
        while ((newlineIndex = textBuffer.indexOf("\n")) !== -1) {
          let line = textBuffer.slice(0, newlineIndex);
          textBuffer = textBuffer.slice(newlineIndex + 1);

          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (line.startsWith(":") || line.trim() === "") continue;
          if (!line.startsWith("data: ")) continue;

          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") {
            streamDone = true;
            break;
          }

          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content as string | undefined;
            if (content) {
              accumulatedContent += content;
              onDocumentGenerated(accumulatedContent);
            }
          } catch {
            textBuffer = line + "\n" + textBuffer;
            break;
          }
        }
      }

      // Mark final step complete
      setSteps(prev => prev.map(s => ({ ...s, completed: true })));

      const assistantMessage: Message = { 
        role: 'assistant', 
        content: 'Document generated successfully!' 
      };
      setMessages(prev => [...prev, assistantMessage]);
      
      // Save assistant message to database
      await saveMessage('assistant', 'Document generated successfully!');

      // Save draft to database
      if (user && userRole?.organization.id && accumulatedContent) {
        await saveDraft(messageText, accumulatedContent, mode);
      }
      
      // Update conversation title with first prompt
      if (currentConversationId && messages.length === 0) {
        const title = messageText.slice(0, 60) + (messageText.length > 60 ? '...' : '');
        await supabase
          .from('conversations')
          .update({ title })
          .eq('id', currentConversationId);
      }

      toast({
        title: "Document Generated",
        description: "Saved to your drafts.",
      });

    } catch (error: any) {
      console.error('Error generating document:', error);
      
      let errorMessage = 'Failed to generate document. Please try again.';
      let shouldRetry = false;
      
      if (error.message?.includes('Rate limit')) {
        errorMessage = 'Rate limit exceeded. Please try again in a moment.';
      } else if (error.message?.includes('Payment required')) {
        errorMessage = 'Please add credits to continue using AI features.';
      } else if (error.message?.includes('Authentication')) {
        errorMessage = 'Please log in to continue.';
        setTimeout(() => window.location.href = '/auth', 2000);
      } else if (error.message?.includes('network') || error.message?.includes('fetch')) {
        errorMessage = 'Network error. Retrying...';
        shouldRetry = retryCount < 2;
      }

      // Retry logic for network errors
      if (shouldRetry) {
        setTimeout(() => {
          sendMessage(messageText, retryCount + 1);
        }, 1000 * (retryCount + 1)); // Exponential backoff
        return;
      }

      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });

      const errorMsg = { 
        role: 'assistant' as const, 
        content: 'Sorry, I encountered an error. Please try again.' 
      };
      setMessages(prev => [...prev, errorMsg]);
      await saveMessage('assistant', errorMsg.content);
    } finally {
      setIsLoading(false);
      onGeneratingChange(false);
    }
  };

  const handleQuickPrompt = (prompt: string) => {
    setInput(prompt);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Check if the dragged items contain files
    if (e.dataTransfer.types.includes('Files')) {
      setIsDraggingFile(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Only set to false if leaving the main container
    if (e.currentTarget === e.target) {
      setIsDraggingFile(false);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingFile(false);

    const file = e.dataTransfer.files?.[0];
    if (!file) return;

    const validTypes = ['.pdf', '.docx', '.doc', '.csv', '.txt'];
    const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase();
    
    if (!validTypes.includes(fileExtension)) {
      toast({
        title: "Invalid file type",
        description: "Please upload a PDF, Word, CSV, or TXT file",
        variant: "destructive",
      });
      return;
    }

    try {
      // For CSV and TXT files, read directly
      if (fileExtension === '.csv' || fileExtension === '.txt') {
        const text = await file.text();
        setUploadedFile({ name: file.name, content: text });
        toast({
          title: "File uploaded",
          description: `${file.name} is ready to reference`,
        });
        return;
      }

      // For other files, use the parse-document edge function
      const formData = new FormData();
      formData.append('file', file);

      toast({
        title: "Processing file",
        description: `Parsing ${file.name}...`,
      });

      const { data, error } = await supabase.functions.invoke('parse-document', {
        body: formData,
      });

      if (error) throw error;

      if (data?.text) {
        setUploadedFile({ name: data.filename || file.name, content: data.text });
        toast({
          title: "File uploaded",
          description: `${file.name} is ready to reference`,
        });
      }
    } catch (error) {
      console.error('Upload error:', error);
      toast({
        title: "Upload failed",
        description: "Failed to process file. Please try again.",
        variant: "destructive",
      });
    }
  };

  const saveDraft = async (prompt: string, content: string, mode: string) => {
    setIsSaving(true);
    try {
      const title = currentDraftTitle || prompt.slice(0, 100);
      const documentType = mode === 'redline' ? 'Redlined Document' : 'General';

      if (currentDraftId) {
        // Update existing draft
        const { error } = await supabase
          .from('document_drafts')
          .update({
            title,
            document_type: documentType,
            content: { text: content, changes: [] },
            conversation_id: currentConversationId,
            updated_at: new Date().toISOString(),
          })
          .eq('id', currentDraftId);

        if (error) throw error;
        console.log('Draft updated successfully:', currentDraftId);
      } else {
        // Create new draft
        const { data, error } = await supabase
          .from('document_drafts')
          .insert({
            user_id: user.id,
            organization_id: userRole?.organization.id,
            title,
            document_type: documentType,
            content: { text: content, changes: [] },
            conversation_id: currentConversationId,
            status: 'draft',
          })
          .select()
          .single();

        if (error) throw error;
        
        console.log('Draft saved successfully:', data?.id);
        
        // Set the current draft ID and pass it back to parent
        if (data?.id) {
          setCurrentDraftId(data.id);
          onDocumentGenerated(content, [], data.id);
        }
      }
      
      setLastSaved(new Date());
    } catch (error) {
      console.error('Error saving draft:', error);
    } finally {
      setIsSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-6 text-center">
        <p className="text-sm text-muted-foreground mb-4">Please log in to use the document drafter</p>
        <Button onClick={() => window.location.href = '/auth'}>Log In</Button>
      </div>
    );
  }

  if (!userRole) {
    return <NoOrganizationWarning />;
  }

  return (
    <div 
      className="h-full flex flex-col bg-muted/20 relative"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Drag and Drop Overlay */}
      {isDraggingFile && (
        <div className="absolute inset-0 z-50 bg-white dark:bg-neutral-950 border-2 border-dashed border-primary rounded-lg flex items-center justify-center pointer-events-none">
            <div className="bg-white dark:bg-neutral-950 rounded-lg p-8 shadow-lg border-2 border-primary">
            <div className="flex flex-col items-center gap-3">
              <Upload className="h-12 w-12 text-primary" />
              <p className="text-lg font-semibold">Drop file to upload</p>
              <p className="text-sm text-muted-foreground">PDF, Word, CSV, or TXT</p>
            </div>
          </div>
        </div>
      )}
      {/* Enhanced Steps Header */}
      {steps.length > 0 && (
        <div className="border-b px-5 py-3.5 bg-background">
          <div className="flex items-center gap-2.5 mb-2">
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 hover:bg-accent"
              onClick={() => setShowSteps(!showSteps)}
            >
              {showSteps ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </Button>
            <span className="text-xs font-medium text-muted-foreground">
              Completed in {steps.length} steps
            </span>
          </div>
          
          {showSteps && (
            <div className="ml-8 space-y-2">
              {steps.map((step, index) => (
                <div key={index} className="flex items-center gap-2.5 text-xs">
                  <div className={`h-4 w-4 rounded-full flex items-center justify-center transition-colors ${
                    step.completed ? 'bg-primary/10' : 'bg-muted'
                  }`}>
                    <Check className={`h-3 w-3 transition-colors ${
                      step.completed ? 'text-primary' : 'text-muted-foreground'
                    }`} />
                  </div>
                  <span className={`transition-colors ${
                    step.completed ? 'text-foreground font-medium' : 'text-muted-foreground'
                  }`}>
                    {step.label}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Conversation History with Better Styling */}
      <div className="flex-1 overflow-hidden">
        <ScrollArea className="h-full">
          <div className="p-5 space-y-4">
            {messages.map((message, index) => (
              <div key={index} className="space-y-2">
                <div className="flex items-center gap-2.5">
                  <div className={`h-7 w-7 rounded-full flex items-center justify-center text-xs font-semibold transition-colors ${
                    message.role === 'user' 
                      ? 'bg-primary text-primary-foreground' 
                      : 'bg-accent text-accent-foreground'
                  }`}>
                    {message.role === 'user' ? 'U' : 'AI'}
                  </div>
                  <span className="text-xs font-medium text-muted-foreground">
                    {message.role === 'user' ? 'You' : 'Assistant'}
                  </span>
                </div>
                <div className={`ml-9.5 text-sm rounded-lg p-3 max-w-[85%] ${
                  message.role === 'user'
                    ? 'bg-primary/5 border border-primary/10'
                    : 'bg-accent/50 border border-accent'
                }`}>
                  {message.content}
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="space-y-2">
                <div className="flex items-center gap-2.5">
                  <div className="h-7 w-7 rounded-full bg-accent flex items-center justify-center text-xs font-semibold text-accent-foreground">
                    AI
                  </div>
                  <span className="text-xs font-medium text-muted-foreground">Assistant</span>
                </div>
                <div className="ml-9.5 bg-accent/50 border border-accent rounded-lg p-3 w-fit">
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                </div>
              </div>
            )}
            <div ref={scrollRef} />
          </div>
        </ScrollArea>
      </div>

      {/* Enhanced Input Area */}
      <div className="border-t p-4 bg-background space-y-3">
        {/* Document Name Input */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="text-xs font-medium text-muted-foreground">
              Document Name
            </label>
            {isSaving && (
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Loader2 className="h-3 w-3 animate-spin" />
                Saving...
              </span>
            )}
            {!isSaving && lastSaved && (
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Check className="h-3 w-3" />
                Saved {new Date(lastSaved).toLocaleTimeString()}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-9 w-9 hover:bg-accent"
            onClick={() => setShowFileDialog(true)}
            title="Upload document"
          >
            <FileText className="h-4 w-4" />
          </Button>
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-9 w-9 hover:bg-accent"
            onClick={() => setShowPromptDialog(true)}
            title="Choose prompt template"
          >
            <AlignLeft className="h-4 w-4" />
          </Button>
          {uploadedFile && (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-primary/10 border border-primary/20 rounded-md text-xs font-medium">
              <FileText className="h-3.5 w-3.5 text-primary" />
              <span className="truncate max-w-[150px]">{uploadedFile.name}</span>
              <button 
                onClick={() => setUploadedFile(null)}
                className="hover:text-destructive ml-1 text-muted-foreground"
              >
                ×
              </button>
            </div>
          )}
        </div>
        
        <div className="flex items-end gap-2 p-3 border rounded-lg bg-background focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 transition-all">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                sendMessage(input);
              }
            }}
            placeholder="Describe the document you want to create..."
            className="flex-1 px-0 py-1 text-sm bg-transparent border-0 outline-none placeholder:text-muted-foreground"
            disabled={isLoading}
          />
          <Button
            onClick={() => sendMessage(input)}
            disabled={!input.trim() || isLoading}
            size="icon"
            className="h-9 w-9 rounded-full flex-shrink-0"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>

      <FileUploadDialog 
        open={showFileDialog}
        onOpenChange={setShowFileDialog}
        onFileUploaded={(filename, content) => {
          setUploadedFile({ name: filename, content });
          toast({
            title: "File uploaded",
            description: `${filename} ready to reference`,
          });
        }}
      />

      <PromptLibraryDialog
        open={showPromptDialog}
        onOpenChange={setShowPromptDialog}
        onPromptSelected={(prompt) => {
          setInput(prompt);
        }}
        selectedDocuments={uploadedFile ? [{ filename: uploadedFile.name }] : []}
      />
    </div>
  );
};