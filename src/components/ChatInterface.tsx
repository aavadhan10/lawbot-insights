import { useState, useRef, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Send, Loader2, Paperclip, X, Sparkles, FileSpreadsheet } from "lucide-react";
import { toast } from "sonner";
import Papa from "papaparse";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface ChatInterfaceProps {
  data: any;
  onInsights: (insights: any) => void;
  onReset: () => void;
  onVisualization: (viz: any) => void;
  onForecast: (forecast: any) => void;
  onDataUpload: (data: any) => void;
  conversationId: string | null;
  onConversationCreated: (id: string) => void;
}

export const ChatInterface = ({ 
  data, 
  onInsights, 
  onReset, 
  onVisualization, 
  onForecast,
  onDataUpload,
  conversationId,
  onConversationCreated
}: ChatInterfaceProps) => {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content: "Hello! I'm BrieflyData CoPilot, your AI data analyst. Upload CSV files to get started, and I'll help you analyze your data, create visualizations, and generate insights. You can drag and drop multiple files! 📊"
    }
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropZoneRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (conversationId) {
      loadConversation();
    } else {
      setMessages([{
        role: "assistant",
        content: "Hello! I'm BrieflyData CoPilot, your AI data analyst. Upload CSV files to get started, and I'll help you analyze your data, create visualizations, and generate insights. You can drag and drop multiple files! 📊"
      }]);
    }
  }, [conversationId]);

  const loadConversation = async () => {
    if (!conversationId) return;

    try {
      const { data: messagesData, error: messagesError } = await supabase
        .from("messages")
        .select("*")
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: true });

      if (messagesError) throw messagesError;

      if (messagesData && messagesData.length > 0) {
        setMessages(messagesData.map(m => ({ role: m.role as "user" | "assistant", content: m.content })));
      }

      const { data: filesData, error: filesError } = await supabase
        .from("uploaded_files")
        .select("*")
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: false })
        .limit(1);

      if (filesError) throw filesError;

      if (filesData && filesData.length > 0) {
        const file = filesData[0];
        onDataUpload({
          filename: file.filename,
          data: file.data,
          headers: file.headers,
          rows: (file.data as any[]).slice(1),
        });
      }
    } catch (error: any) {
      console.error("Error loading conversation:", error);
      toast.error("Failed to load conversation");
    }
  };

  const saveMessage = async (role: "user" | "assistant", content: string, retryOnRLS: boolean = true) => {
    if (!conversationId) return;

    try {
      const { error } = await supabase
        .from("messages")
        .insert({ conversation_id: conversationId, role, content });

      if (error) {
        // 42501 is the RLS violation error code
        if (error.code === '42501' && retryOnRLS) {
          console.log("RLS violation - conversation may not exist or is not owned by user");
          toast.error("Session expired. Creating new conversation...");
          
          // Create a new conversation and retry
          const title = "New conversation";
          const newConvId = await createConversation(title);
          if (newConvId) {
            // The message will be saved with the new conversation ID on next send
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

      const { data, error } = await supabase
        .from("conversations")
        .insert({ 
          user_id: user.id, 
          title,
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

    const files = Array.from(e.dataTransfer.files).filter(file => file.name.endsWith('.csv'));
    if (files.length === 0) {
      toast.error("Please drop CSV files only");
      return;
    }

    setSelectedFiles(files);
    toast.success(`Selected ${files.length} file(s)`);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files ? Array.from(e.target.files) : [];
    const csvFiles = files.filter(file => file.name.endsWith('.csv'));
    
    if (csvFiles.length === 0) {
      toast.error("Please select CSV files only");
      return;
    }

    setSelectedFiles(csvFiles);
    toast.success(`Selected ${csvFiles.length} file(s)`);
  };

  const processFile = async (file: File) => {
    return new Promise((resolve, reject) => {
      Papa.parse(file, {
        complete: (results) => {
          const processedData = {
            filename: file.name,
            data: results.data,
            headers: results.data[0],
            rows: results.data.slice(1),
          };
          resolve(processedData);
        },
        error: (error) => {
          reject(error);
        },
        header: false,
      });
    });
  };

  const saveFileToDatabase = async (fileData: any, convId: string) => {
    try {
      const { error } = await supabase
        .from("uploaded_files")
        .insert({
          conversation_id: convId,
          filename: fileData.filename,
          row_count: fileData.rows.length,
          column_count: fileData.headers.length,
          headers: fileData.headers,
          data: fileData.data,
        });

      if (error) throw error;
    } catch (error: any) {
      console.error("Error saving file:", error);
    }
  };

  const handleSend = async () => {
    // Handle file upload if files are selected
    if (selectedFiles.length > 0 && !data) {
      try {
        setIsLoading(true);

        // Process all files
        const processedFiles = await Promise.all(
          selectedFiles.map(file => processFile(file))
        );

        // Validate existing conversation or create new one
        let convId = conversationId;
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
          const title = selectedFiles.length === 1 
            ? selectedFiles[0].name 
            : `${selectedFiles.length} files uploaded`;
          convId = await createConversation(title);
          if (!convId) {
            setIsLoading(false);
            return;
          }
        }

        // Save all files to database
        await Promise.all(
          processedFiles.map(fileData => saveFileToDatabase(fileData, convId!))
        );

        // Use the first file for the main data view
        const firstFile: any = processedFiles[0];
        onDataUpload(firstFile);

        // Add user message
        const fileMessage = selectedFiles.length === 1
          ? `[Uploaded file: ${selectedFiles[0].name}]`
          : `[Uploaded ${selectedFiles.length} files: ${selectedFiles.map(f => f.name).join(", ")}]`;
        
        setMessages(prev => [...prev, { role: "user", content: fileMessage }]);
        await saveMessage("user", fileMessage);

        setSelectedFiles([]);
        setIsLoading(false);
        return;
      } catch (error) {
        toast.error("Failed to process files");
        setIsLoading(false);
        return;
      }
    }

    if (!input.trim() || isLoading) return;

    if (!data) {
      toast.error("Please upload CSV files first");
      return;
    }

    const userMessage = input.trim();
    setInput("");
    
    const newUserMessage = { role: "user" as const, content: userMessage };
    setMessages(prev => [...prev, newUserMessage]);
    
    if (conversationId) {
      await saveMessage("user", userMessage);
    }

    setIsLoading(true);

    try {
      const dataContext = {
        filename: data.filename,
        rowCount: data.rows.length,
        headers: data.headers,
        sampleData: data.rows.slice(0, 5),
      };

      const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/analyze-data`;

      const response = await fetch(CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messages: messages.map(m => ({ role: m.role, content: m.content })).concat([
            { role: "user", content: userMessage }
          ]),
          dataContext,
        }),
      });

      if (!response.ok || !response.body) {
        throw new Error("Failed to get AI response");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let textBuffer = "";
      let streamDone = false;
      let assistantMessage = "";
      let toolCallBuffer = "";
      let currentToolCall: any = null;

      // Add empty assistant message
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
              setMessages(prev => {
                const newMessages = [...prev];
                newMessages[newMessages.length - 1] = {
                  role: "assistant",
                  content: assistantMessage
                };
                return newMessages;
              });
            }

            const toolCalls = parsed.choices?.[0]?.delta?.tool_calls;
            if (toolCalls && toolCalls.length > 0) {
              const toolCall = toolCalls[0];
              
              if (toolCall.function?.name) {
                currentToolCall = { name: toolCall.function.name, arguments: "" };
              }
              
              if (toolCall.function?.arguments) {
                toolCallBuffer += toolCall.function.arguments;
              }
            }

            if (parsed.choices?.[0]?.finish_reason === "tool_calls" && currentToolCall) {
              try {
                const args = JSON.parse(toolCallBuffer);
                if (currentToolCall.name === "create_visualization") {
                  onVisualization(args);
                  assistantMessage += `\n\n📊 I've created a ${args.type} chart: "${args.title}"`;
                  setMessages(prev => {
                    const newMessages = [...prev];
                    newMessages[newMessages.length - 1] = {
                      role: "assistant",
                      content: assistantMessage
                    };
                    return newMessages;
                  });
                } else if (currentToolCall.name === "create_forecast") {
                  onForecast(args);
                  assistantMessage += `\n\n🔮 I've created a forecast: "${args.title}"\nMethod: ${args.method}`;
                  setMessages(prev => {
                    const newMessages = [...prev];
                    newMessages[newMessages.length - 1] = {
                      role: "assistant",
                      content: assistantMessage
                    };
                    return newMessages;
                  });
                }
                toolCallBuffer = "";
                currentToolCall = null;
              } catch (e) {
                console.error("Error parsing tool call:", e);
              }
            }
          } catch {
            textBuffer = line + "\n" + textBuffer;
            break;
          }
        }
      }

      // Save assistant message
      if (conversationId && assistantMessage) {
        await saveMessage("assistant", assistantMessage);
      }

      setIsLoading(false);
    } catch (error) {
      console.error("Chat error:", error);
      toast.error("Failed to get response from AI");
      setIsLoading(false);
    }
  };

  return (
    <Card 
      ref={dropZoneRef}
      className={`flex flex-col h-full border-border/50 shadow-lg transition-all ${
        isDragging ? "border-primary border-2 bg-primary/5" : ""
      }`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Messages */}
      <ScrollArea className="flex-1 p-6">
        <div className="space-y-6 max-w-4xl mx-auto w-full px-4">
          {messages.map((message, index) => (
            <div
              key={index}
              className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-3xl rounded-2xl p-4 ${
                  message.role === "user"
                    ? "bg-primary text-primary-foreground ml-auto"
                    : "bg-card border border-border/50"
                }`}
              >
                {message.role === "assistant" && (
                  <div className="flex items-center gap-2 mb-2">
                    <Sparkles className="w-4 h-4 text-primary" />
                    <span className="text-xs font-medium text-muted-foreground">BrieflyData CoPilot</span>
                  </div>
                )}
                <p className="text-sm whitespace-pre-wrap leading-relaxed">{message.content}</p>
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-card border border-border/50 rounded-2xl p-4">
                <div className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-primary" />
                  <span className="text-sm text-muted-foreground">Analyzing...</span>
                </div>
              </div>
            </div>
          )}
          <div ref={scrollRef} />
        </div>
      </ScrollArea>

      {/* Input Area */}
      <div className="p-4 border-t border-border/50 bg-card/50 backdrop-blur-sm">
        <div className="max-w-4xl mx-auto w-full px-4">
          {selectedFiles.length > 0 && (
            <div className="mb-3 space-y-2">
              {selectedFiles.map((file, index) => (
                <div key={index} className="flex items-center gap-2 p-2 rounded-lg bg-primary/10 border border-primary/20">
                  <FileSpreadsheet className="w-4 h-4 text-primary" />
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
              ref={fileInputRef}
              type="file"
              accept=".csv"
              multiple
              className="hidden"
              onChange={handleFileSelect}
            />
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => fileInputRef.current?.click()}
              disabled={isLoading}
            >
              <Paperclip className="w-4 h-4" />
            </Button>
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={data ? "Ask about your data..." : "Upload CSV files to start or drag & drop"}
              disabled={isLoading}
              className="flex-1"
            />
            <Button type="submit" disabled={isLoading || (!input.trim() && selectedFiles.length === 0)} size="icon">
              <Send className="w-4 h-4" />
            </Button>
          </form>
          {data && (
            <div className="mt-2 flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                Current file: {data.filename} ({data.rows.length} rows)
              </p>
              <Button
                variant="ghost"
                size="sm"
                onClick={onReset}
                className="text-xs h-6"
              >
                Clear & Upload New
              </Button>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
};
