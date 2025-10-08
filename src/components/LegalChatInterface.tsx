import { useState, useRef, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/contexts/OrganizationContext";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Send, Loader2, Paperclip, X, Sparkles, FileText, Save, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import * as XLSX from "xlsx";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface LegalChatInterfaceProps {
  conversationId: string | null;
  onConversationCreated: (id: string) => void;
  selectedDocuments?: any[];
  onRemoveDocument?: (docId: string) => void;
  initialPrompt?: string;
}

export const LegalChatInterface = ({ 
  conversationId,
  onConversationCreated,
  selectedDocuments = [],
  onRemoveDocument,
  initialPrompt = ""
}: LegalChatInterfaceProps) => {
  const { userRole } = useOrganization();
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content: "Hello! I'm Briefly AI Assistant, your legal AI companion. Upload documents (PDF, DOCX, TXT, CSV, Excel) or ask me legal questions to get started. 📄"
    }
  ]);
  const [input, setInput] = useState(initialPrompt);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadingFiles, setUploadingFiles] = useState<Set<string>>(new Set());
  const [abortController, setAbortController] = useState<AbortController | null>(null);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [conversationTitle, setConversationTitle] = useState("");
  const [showScrollButton, setShowScrollButton] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (conversationId) {
      loadConversation();
    } else {
      // Reset to initial message when starting a new chat
      setMessages([
        {
          role: "assistant",
          content: "Hello! I'm Briefly AI Assistant, your legal AI companion. Upload documents (PDF, DOCX, TXT, CSV, Excel) or ask me legal questions to get started. 📄"
        }
      ]);
    }
  }, [conversationId]);

  useEffect(() => {
    if (initialPrompt) {
      setInput(initialPrompt);
    }
  }, [initialPrompt]);

  const loadConversation = async () => {
    if (!conversationId) return;

    try {
      const { data: messagesData, error } = await supabase
        .from("messages")
        .select("*")
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: true });

      if (error) throw error;

      if (messagesData && messagesData.length > 0) {
        setMessages(messagesData.map(m => ({ role: m.role as "user" | "assistant", content: m.content })));
      }
    } catch (error: any) {
      console.error("Error loading conversation:", error);
      toast.error("Failed to load conversation");
    }
  };

  const saveMessage = async (convId: string, role: "user" | "assistant", content: string, retryOnRLS: boolean = true) => {
    try {
      const { error } = await supabase
        .from("messages")
        .insert({ conversation_id: convId, role, content });

      if (error) {
        // 42501 is the RLS violation error code
        if (error.code === '42501' && retryOnRLS) {
          console.log("RLS violation - conversation may not exist or is not owned by user");
          toast.error("Session expired. Creating new conversation...");
          
          // Create a new conversation and retry
          const newConvId = await createConversation(content.slice(0, 50));
          if (newConvId) {
            // Retry saving the message with the new conversation
            await saveMessage(newConvId, role, content, false);
          }
          return;
        }
        throw error;
      }
    } catch (error: any) {
      console.error("Error saving message:", error);
      toast.error("Failed to save message");
    }
  };

  const createConversation = async (title: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("No user");

      const { data: orgId } = await supabase.rpc('get_user_organization', { _user_id: user.id });

      const { data, error } = await supabase
        .from("conversations")
        .insert({ 
          user_id: user.id,
          title,
          organization_id: orgId,
          conversation_type: 'assistant'
        })
        .select()
        .single();

      if (error) throw error;
      
      // Update parent state and localStorage
      onConversationCreated(data.id);
      localStorage.setItem('lastConversationId', data.id);
      
      return data.id;
    } catch (error: any) {
      console.error("Error creating conversation:", error);
      toast.error("Failed to create conversation");
      return null;
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const MAX_FILES = 10;
    const MAX_SIZE = 20 * 1024 * 1024; // 20MB
    const incoming = Array.from(e.dataTransfer.files);

    const validByType = incoming.filter((file) =>
      /\.(pdf|docx|txt|csv|xlsx|xls)$/i.test(file.name)
    );
    if (validByType.length === 0) {
      toast.error("Please drop PDF, DOCX, TXT, CSV, or Excel files only");
      return;
    }

    const oversized = validByType.filter((f) => f.size > MAX_SIZE);
    if (oversized.length > 0) {
      toast.error("Some files exceed 20MB and were skipped");
    }

    const candidates = validByType.filter((f) => f.size <= MAX_SIZE);

    let merged = [...selectedFiles];
    let added = 0;
    for (const f of candidates) {
      const isDup = merged.some((g) => g.name === f.name && g.size === f.size);
      if (!isDup && merged.length < MAX_FILES) {
        merged.push(f);
        added++;
      }
    }

    if (added === 0) {
      toast.error("No new files added (duplicates or over limit).");
    } else {
      toast.success(`Added ${added} file(s). Total ${merged.length}/${MAX_FILES}`);
    }

    setSelectedFiles(merged);
  };
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const MAX_FILES = 10;
    const MAX_SIZE = 20 * 1024 * 1024; // 20MB

    const files = e.target.files ? Array.from(e.target.files) : [];
    const validByType = files.filter((file) => /\.(pdf|docx|txt|csv|xlsx|xls)$/i.test(file.name));

    if (validByType.length === 0) {
      toast.error("Please select PDF, DOCX, TXT, CSV, or Excel files only");
      e.currentTarget.value = "";
      return;
    }

    const oversized = validByType.filter((f) => f.size > MAX_SIZE);
    if (oversized.length > 0) {
      toast.error("Some files exceed 20MB and were skipped");
    }

    const candidates = validByType.filter((f) => f.size <= MAX_SIZE);

    let merged = [...selectedFiles];
    let added = 0;
    for (const f of candidates) {
      const isDup = merged.some((g) => g.name === f.name && g.size === f.size);
      if (!isDup && merged.length < MAX_FILES) {
        merged.push(f);
        added++;
      }
    }

    if (added === 0) {
      toast.error("No new files added (duplicates or over limit).");
    } else {
      toast.success(`Added ${added} file(s). Total ${merged.length}/${MAX_FILES}`);
    }

    setSelectedFiles(merged);

    // Allow selecting the same file again by resetting the input
    e.currentTarget.value = "";
  };
  const extractTextFromFile = async (file: File): Promise<string> => {
    try {
      // For TXT and CSV files, read directly
      if (file.name.toLowerCase().endsWith('.txt') || file.name.toLowerCase().endsWith('.csv')) {
        return await file.text();
      }

      // Excel: parse client-side to avoid backend limitations
      if (/\.(xlsx|xls)$/i.test(file.name)) {
        try {
          const arrayBuffer = await file.arrayBuffer();
          const workbook = XLSX.read(arrayBuffer, { type: 'array' });
          const sheets = workbook.SheetNames;
          let aggregated = '';
          for (const name of sheets) {
            const ws = workbook.Sheets[name];
            if (!ws) continue;
            const csv = XLSX.utils.sheet_to_csv(ws);
            if (csv.trim().length === 0) continue;
            aggregated += `Sheet: ${name}\n${csv}\n\n`;
          }
          if (!aggregated) {
            toast.warning(`${file.name} appears to contain no readable cells`);
            return `[Document: ${file.name} - No content extracted]`;
          }
          toast.success(`Converted ${file.name} from Excel`);
          return aggregated.trim();
        } catch (excelErr) {
          console.error('Excel parse error:', excelErr);
          toast.error(`Couldn't read ${file.name}. Try saving as CSV and re-uploading.`);
          return `[Document: ${file.name} - Error: Excel parsing failed]`;
        }
      }

      // For PDF and DOCX, use the parse-document edge function
      const formData = new FormData();
      formData.append('file', file);
      
      console.log(`Parsing ${file.name} (${(file.size / 1024).toFixed(2)} KB)...`);
      
      const { data, error } = await supabase.functions.invoke('parse-document', {
        body: formData,
      });
      
      if (error) {
        console.error('Error parsing document:', error);
        toast.error(`Failed to parse ${file.name}: ${error.message || 'Unknown error'}`);
        return `[Document: ${file.name} - Parsing failed: ${error.message || 'Unknown error'}]`;
      }
      
      if (!data || !data.text) {
        console.warn('No text extracted from document:', file.name);
        toast.warning(`${file.name} appears to be empty or unreadable`);
        return `[Document: ${file.name} - No content extracted]`;
      }
      
      console.log(`Successfully parsed ${file.name}: ${data.text.length} characters`);
      return data.text;
    } catch (error) {
      console.error('Error extracting text:', error);
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      toast.error(`Failed to extract text from ${file.name}: ${errorMsg}`);
      return `[Document: ${file.name} - Error: ${errorMsg}]`;
    }
  };

  const uploadFileToRepository = async (file: File): Promise<string | null> => {
    try {
      setUploadingFiles(prev => new Set(prev).add(file.name));
      
      // Extract text from file
      const contentText = await extractTextFromFile(file);
      
      if (contentText.startsWith('[Document:') && contentText.includes('Error')) {
        setUploadingFiles(prev => {
          const newSet = new Set(prev);
          newSet.delete(file.name);
          return newSet;
        });
        return null;
      }

      // Save to documents table
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("No user");

      const fileType = file.name.split('.').pop()?.toLowerCase() || 'unknown';
      
      const { data: doc, error: insertError } = await supabase
        .from('documents')
        .insert({
          user_id: user.id,
          organization_id: userRole?.organization?.id,
          filename: file.name,
          file_type: fileType,
          file_size: file.size,
          content_text: contentText,
          metadata: { uploadedAt: new Date().toISOString() }
        })
        .select()
        .single();

      if (insertError) throw insertError;

      setUploadingFiles(prev => {
        const newSet = new Set(prev);
        newSet.delete(file.name);
        return newSet;
      });

      toast.success(`${file.name} uploaded successfully`);
      return doc.id;
    } catch (error) {
      console.error('Error uploading file:', error);
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      toast.error(`Failed to upload ${file.name}: ${errorMsg}`);
      setUploadingFiles(prev => {
        const newSet = new Set(prev);
        newSet.delete(file.name);
        return newSet;
      });
      return null;
    }
  };

  const handleSend = async () => {
    if (!input.trim() && selectedFiles.length === 0) return;
    if (isLoading) return;

    let convId = conversationId;
    
    // Validate existing conversation or create new one
    if (convId) {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("No user");

        const { data, error } = await supabase
          .from('conversations')
          .select('id')
          .eq('id', convId)
          .eq('user_id', user.id)
          .single();

        if (error || !data) {
          console.log("Conversation not found or not owned - creating new one");
          localStorage.removeItem('lastConversationId');
          convId = null;
        }
      } catch (error) {
        console.error("Error validating conversation:", error);
        convId = null;
      }
    }
    
    // Create conversation if needed
    if (!convId) {
      const title = selectedFiles.length > 0 
        ? selectedFiles[0].name 
        : input.slice(0, 50);
      convId = await createConversation(title);
      if (!convId) return;
    }

    // Upload files and get document IDs
    let uploadedDocIds: string[] = [];
    if (selectedFiles.length > 0) {
      const docIdPromises = selectedFiles.map(file => uploadFileToRepository(file));
      const results = await Promise.all(docIdPromises);
      uploadedDocIds = results.filter((id): id is string => id !== null);
    }

    // Collect all document IDs (from repository selection + newly uploaded)
    const allDocumentIds = [
      ...selectedDocuments.map(d => d.id),
      ...uploadedDocIds
    ];

    const userMessage = input.trim() || `[Uploaded ${selectedFiles.length} file(s)]`;
    setInput("");
    setSelectedFiles([]);
    
    const newUserMessage = { role: "user" as const, content: userMessage };
    setMessages(prev => [...prev, newUserMessage]);
    if (convId) await saveMessage(convId, "user", userMessage);

    setIsLoading(true);

    try {
      const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/legal-chat`;
      
      // Create abort controller for this request
      const controller = new AbortController();
      setAbortController(controller);

      const response = await fetch(CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messages: [...messages, newUserMessage].map(m => ({ role: m.role, content: m.content })),
          organizationName: userRole?.organization?.name,
          selectedDocumentIds: allDocumentIds.length > 0 ? allDocumentIds : undefined
        }),
        signal: controller.signal
      });

      if (!response.ok || !response.body) {
        if (response.status === 429) {
          toast.error("Rate limits exceeded. Please try again later.");
        } else if (response.status === 402) {
          toast.error("Payment required. Please add credits to your workspace.");
        }
        throw new Error("Failed to get AI response");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let textBuffer = "";
      let streamDone = false;
      let assistantMessage = "";

      setMessages(prev => [...prev, { role: "assistant", content: "" }]);

      while (!streamDone) {
        const { done, value } = await reader.read();
        if (done) break;
        
        textBuffer += decoder.decode(value, { stream: true });

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
              assistantMessage += content;
              // Batch updates to reduce re-renders (update every ~50ms worth of tokens)
              setMessages(prev => {
                const newMessages = [...prev];
                newMessages[newMessages.length - 1] = {
                  role: "assistant",
                  content: assistantMessage
                };
                return newMessages;
              });
            }
          } catch {
            textBuffer = line + "\n" + textBuffer;
            break;
          }
        }
      }

      if (convId && assistantMessage) {
        await saveMessage(convId, "assistant", assistantMessage);
      }

      setIsLoading(false);
      setAbortController(null);
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        console.log("Request was cancelled by user");
        toast.info("Request cancelled");
      } else {
        console.error("Chat error:", error);
        toast.error("Failed to get response from AI");
      }
      setIsLoading(false);
      setAbortController(null);
    }
  };

  const handleCancelQuery = () => {
    if (abortController) {
      abortController.abort();
      setAbortController(null);
      setIsLoading(false);
    }
  };

  const handleSaveConversation = async () => {
    if (!conversationTitle.trim()) {
      toast.error("Please enter a title");
      return;
    }

    try {
      if (!conversationId) {
        const newId = await createConversation(conversationTitle.trim());
        if (!newId) return;
        toast.success("Conversation created and saved");
      } else {
        const { error } = await supabase
          .from("conversations")
          .update({ title: conversationTitle.trim() })
          .eq("id", conversationId);
        if (error) throw error;
        toast.success("Conversation saved successfully");
      }

      setShowSaveDialog(false);
      setConversationTitle("");
    } catch (error) {
      console.error("Error saving conversation:", error);
      toast.error("Failed to save conversation");
    }
  };

  const handleOpenSaveDialog = () => {
    setShowSaveDialog(true);
  };

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const target = e.target as HTMLDivElement;
    const isNearBottom = target.scrollHeight - target.scrollTop - target.clientHeight < 100;
    setShowScrollButton(!isNearBottom);
  };

  const scrollToBottom = () => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  };

  return (
    <div 
      className={`flex flex-col h-full transition-all ${
        isDragging ? "border-2 border-primary bg-primary/5 rounded-xl" : ""
      }`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <ScrollArea className="flex-1 px-4 py-6" ref={scrollAreaRef} onScrollCapture={handleScroll}>
        <div className="max-w-4xl mx-auto space-y-6">
          {messages.map((message, index) => (
            <div
              key={index}
              className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[85%] rounded-2xl p-4 ${
                  message.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted/50"
                }`}
              >
                {message.role === "assistant" && (
                  <div className="flex items-center gap-2 mb-3">
                    <Sparkles className="w-4 h-4 text-primary" />
                    <span className="text-xs font-medium text-muted-foreground">Briefly AI</span>
                  </div>
                )}
                <div className="prose prose-sm max-w-none dark:prose-invert">
                  {message.role === "assistant" ? (
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      components={{
                        h1: ({ children }) => <h1 className="text-lg font-bold mb-3 mt-4 first:mt-0">{children}</h1>,
                        h2: ({ children }) => <h2 className="text-base font-bold mb-2 mt-3 first:mt-0">{children}</h2>,
                        h3: ({ children }) => <h3 className="text-sm font-semibold mb-2 mt-2 first:mt-0">{children}</h3>,
                        p: ({ children }) => <p className="mb-3 last:mb-0 leading-relaxed">{children}</p>,
                        ul: ({ children }) => <ul className="mb-3 space-y-1 list-disc list-inside">{children}</ul>,
                        ol: ({ children }) => <ol className="mb-3 space-y-1 list-decimal list-inside">{children}</ol>,
                        li: ({ children }) => <li className="leading-relaxed">{children}</li>,
                        strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
                        em: ({ children }) => <em className="italic">{children}</em>,
                        code: ({ children }) => <code className="bg-muted px-1.5 py-0.5 rounded text-xs">{children}</code>,
                        pre: ({ children }) => <pre className="bg-muted p-3 rounded-lg overflow-x-auto mb-3">{children}</pre>,
                      }}
                    >
                      {message.content}
                    </ReactMarkdown>
                  ) : (
                    <p className="text-sm whitespace-pre-wrap leading-relaxed">{message.content}</p>
                  )}
                </div>
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-muted/50 rounded-2xl p-4">
                <div className="flex items-center gap-3">
                  <Loader2 className="w-4 h-4 animate-spin text-primary" />
                  <span className="text-sm text-muted-foreground">Analyzing...</span>
                  <Button 
                    variant="ghost" 
                    size="sm"
                    className="h-7 px-2 text-xs"
                    onClick={handleCancelQuery}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            </div>
          )}
          <div ref={scrollRef} />
        </div>
      </ScrollArea>

      {showScrollButton && (
        <div className="flex justify-center px-4 pt-2">
          <Button 
            variant="outline" 
            size="sm"
            onClick={scrollToBottom}
            className="shadow-lg"
          >
            <ChevronDown className="w-4 h-4 mr-1" />
            Scroll to bottom
          </Button>
        </div>
      )}

      <div className="border-t">
        <div className="max-w-4xl mx-auto px-4 py-4">
        <div>
          {/* Attached Repository Documents */}
          {selectedDocuments.length > 0 && (
            <div className="mb-3 space-y-2">
              {selectedDocuments.map((doc) => (
                <div key={doc.id} className="flex items-center gap-2 p-2 rounded-lg bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-900">
                  <FileText className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                  <span className="text-sm flex-1 text-purple-900 dark:text-purple-100">
                    {doc.filename}
                  </span>
                  {onRemoveDocument && (
                    <button
                      onClick={() => onRemoveDocument(doc.id)}
                      className="p-1 hover:bg-purple-200 dark:hover:bg-purple-900 rounded transition-colors"
                      title="Remove document"
                    >
                      <X className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
          {/* Upload Progress */}
          {uploadingFiles.size > 0 && (
            <div className="mb-3 space-y-2">
              {Array.from(uploadingFiles).map((filename) => (
                <div key={filename} className="flex items-center gap-2 p-2 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900">
                  <Loader2 className="w-4 h-4 animate-spin text-blue-600 dark:text-blue-400" />
                  <span className="text-sm text-blue-900 dark:text-blue-100">Uploading {filename}...</span>
                </div>
              ))}
            </div>
          )}
          {/* Uploaded Files */}
          {selectedFiles.length > 0 && (
            <div className="mb-3 space-y-2">
              {selectedFiles.map((file, index) => (
                <div key={index} className="flex items-center gap-2 p-2 rounded-lg bg-primary/10 border border-primary/20">
                  <FileText className="w-4 h-4 text-primary" />
                  <span className="text-sm flex-1">{file.name}</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => setSelectedFiles(selectedFiles.filter((_, i) => i !== index))}
                  >
                    <X className="w-3 h-3" />
                  </Button>
                </div>
              ))}
            </div>
          )}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            className="flex gap-2"
          >
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileSelect}
              accept=".pdf,.docx,.txt,.csv,.xlsx,.xls"
              multiple
              className="hidden"
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => fileInputRef.current?.click()}
              disabled={isLoading}
            >
              <Paperclip className="w-5 h-5" />
            </Button>
            <Input
              placeholder="Type your message..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={isLoading}
              className="flex-1"
            />
            <Button 
              type="button"
              variant="outline"
              size="icon"
              onClick={handleOpenSaveDialog}
              disabled={isLoading}
              title="Save conversation"
            >
              <Save className="w-5 h-5" />
            </Button>
            <Button type="submit" disabled={isLoading || (!input.trim() && selectedFiles.length === 0)}>
              {isLoading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Send className="w-5 h-5" />
              )}
            </Button>
          </form>
          <div className="flex items-center justify-center gap-2 mt-3 text-xs text-muted-foreground">
            <Sparkles className="w-3 h-3" />
            <span>Powered by Gemini 2.5 Flash</span>
          </div>
        </div>
      </div>
      </div>

      {/* Save Conversation Dialog */}
      <Dialog open={showSaveDialog} onOpenChange={setShowSaveDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Save Conversation</DialogTitle>
            <DialogDescription>Give your conversation a clear, memorable title.</DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Input
              placeholder="Enter conversation title..."
              value={conversationTitle}
              onChange={(e) => setConversationTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleSaveConversation();
                }
              }}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSaveDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveConversation}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
