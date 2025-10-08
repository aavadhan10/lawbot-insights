import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { PromptLibrary } from "@/components/PromptLibrary";
import { DocumentSelector } from "@/components/DocumentSelector";
import { FeedbackModal } from "@/components/FeedbackModal";
import { LegalChatInterface } from "@/components/LegalChatInterface";
import { supabase } from "@/integrations/supabase/client";
import {
  FileText,
  List,
  Sparkles,
  FolderOpen,
  MessageSquare,
} from "lucide-react";

const workflows = [
  {
    title: "Summarize Document",
    description: "Upload a legal document and get a concise summary of key issues, parties, and dates.",
    type: "Analysis",
    steps: 2,
  },
  {
    title: "Draft Memo",
    description: "Generate a legal memo based on your research and analysis.",
    type: "Draft",
    steps: 3,
  },
  {
    title: "Explain Clause",
    description: "Upload a contract and get plain-language explanations of specific clauses.",
    type: "Analysis",
    steps: 2,
  },
  {
    title: "Create Client Alert",
    description: "Transform legal opinions or regulations into client-friendly alerts.",
    type: "Draft",
    steps: 2,
  },
  {
    title: "Proofread & Polish",
    description: "Review documents for grammar, clarity, and legal terminology accuracy.",
    type: "Review",
    steps: 1,
  },
  {
    title: "Contract Review",
    description: "Analyze contracts for key terms, risks, and missing provisions.",
    type: "Analysis",
    steps: 3,
  },
  {
    title: "Due Diligence Summary",
    description: "Upload multiple documents and get a comprehensive due diligence summary.",
    type: "Analysis",
    steps: 3,
  },
  {
    title: "Legal Research",
    description: "Research legal questions across jurisdictions and practice areas.",
    type: "Research",
    steps: 2,
  },
];

export default function Assistant() {
  const navigate = useNavigate();
  const location = useLocation();
  const [promptLibraryOpen, setPromptLibraryOpen] = useState(false);
  const [documentSelectorOpen, setDocumentSelectorOpen] = useState(false);
  const [feedbackModalOpen, setFeedbackModalOpen] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [selectedDocuments, setSelectedDocuments] = useState<any[]>([]);
  const [initialPrompt, setInitialPrompt] = useState("");

  // Validate and restore conversation on mount
  useEffect(() => {
    const validateConversation = async () => {
      const saved = localStorage.getItem('lastConversationId');
      if (!saved) return;

      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          localStorage.removeItem('lastConversationId');
          return;
        }

        const { data, error } = await supabase
          .from('conversations')
          .select('id')
          .eq('id', saved)
          .eq('user_id', user.id)
          .single();

        if (error || !data) {
          localStorage.removeItem('lastConversationId');
        } else {
          setConversationId(saved);
        }
      } catch (error) {
        console.error('Error validating conversation:', error);
        localStorage.removeItem('lastConversationId');
      }
    };

    validateConversation();
  }, []);

  useEffect(() => {
    if (location.state?.initialPrompt) {
      setInitialPrompt(location.state.initialPrompt);
      // Clear the state to prevent re-setting on navigation
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location.state, navigate, location.pathname]);

  // Save conversation to localStorage when it changes
  useEffect(() => {
    if (conversationId) {
      localStorage.setItem('lastConversationId', conversationId);
    }
  }, [conversationId]);
  

  const handleSelectPrompt = (prompt: string) => {
    setInitialPrompt(prompt);
  };

  const handleSelectDocuments = (documents: any[]) => {
    setSelectedDocuments(documents);
  };

  const handleRemoveDocument = (docId: string) => {
    setSelectedDocuments(prev => prev.filter(doc => doc.id !== docId));
  };

  const handleWorkflowClick = (workflowTitle: string) => {
    const prompts: Record<string, string> = {
      "Summarize Document": "Please summarize this document, focusing on key legal issues, parties involved, and critical dates.",
      "Draft Memo": "Help me draft a legal memo based on the provided research and analysis.",
      "Explain Clause": "Please explain the following contract clause in plain language:",
      "Create Client Alert": "Transform this legal opinion into a client-friendly alert.",
      "Proofread & Polish": "Review this document for grammar, clarity, and legal terminology accuracy.",
      "Contract Review": "Analyze this contract for key terms, risks, and missing provisions.",
      "Due Diligence Summary": "Provide a comprehensive due diligence summary based on these documents.",
      "Legal Research": "Research the following legal question:",
    };
    
    setInitialPrompt(prompts[workflowTitle] || "");
  };


  return (
    <div className="flex flex-col h-screen bg-gradient-to-br from-background via-background to-primary/5">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b flex-shrink-0">
        <h1 className="text-3xl font-semibold">Briefly AI Assistant</h1>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => navigate('/history')}>
            <MessageSquare className="w-4 h-4 mr-2" />
            History
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setFeedbackModalOpen(true)}>
            <Sparkles className="w-4 h-4 mr-2" />
            Feedback
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-hidden flex flex-col">
        {/* Quick Actions */}
        <div className="px-6 py-4 border-b flex-shrink-0">
          <div className="max-w-[1600px] mx-auto">
            <div className="flex items-center gap-2 flex-wrap">
              <Button onClick={() => { 
                setConversationId(null); 
                setInitialPrompt(""); 
                setSelectedDocuments([]);
                localStorage.removeItem('lastConversationId');
              }}>
                <MessageSquare className="w-4 h-4 mr-2" />
                New Chat
              </Button>
              <Button variant="outline" onClick={() => setPromptLibraryOpen(true)}>
                <List className="w-4 h-4 mr-2" />
                Browse Prompts
              </Button>
              <Button variant="outline" onClick={() => setDocumentSelectorOpen(true)}>
                <FolderOpen className="w-4 h-4 mr-2" />
                View Repository
              </Button>
            </div>
          </div>
        </div>

        {/* Two Column Layout */}
        <div className="flex-1 overflow-hidden px-6 py-6">
          <div className="max-w-[1600px] mx-auto h-full">
            <div className="grid grid-cols-1 xl:grid-cols-[1fr_400px] gap-8 h-full">
              {/* Left Column - Chat Interface */}
              <div className="min-w-0 flex flex-col overflow-hidden">
                <LegalChatInterface
                  conversationId={conversationId}
                  onConversationCreated={setConversationId}
                  selectedDocuments={selectedDocuments}
                  onRemoveDocument={handleRemoveDocument}
                  initialPrompt={initialPrompt}
                />
              </div>

              {/* Right Column - Recommended Workflows */}
              <div className="xl:border-l xl:pl-8 flex flex-col overflow-hidden">
                <div className="flex items-center justify-between mb-4 flex-shrink-0">
                  <h2 className="text-lg font-semibold">Recommended workflows</h2>
                </div>

                <ScrollArea className="flex-1">
                  <div className="space-y-4 pr-4">
                    {workflows.map((workflow, index) => (
                      <div
                        key={index}
                        onClick={() => handleWorkflowClick(workflow.title)}
                        className="border rounded-lg p-4 hover:border-primary transition-colors cursor-pointer hover:shadow-md"
                      >
                        <h3 className="font-semibold mb-2">{workflow.title}</h3>
                        <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                          {workflow.description}
                        </p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Badge variant="secondary" className="text-xs">
                            {workflow.type}
                          </Badge>
                          <span>· {workflow.steps} step{workflow.steps > 1 ? 's' : ''}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            </div>
          </div>
        </div>
      </div>


      <PromptLibrary
        open={promptLibraryOpen}
        onOpenChange={setPromptLibraryOpen}
        onSelectPrompt={handleSelectPrompt}
      />
      <DocumentSelector
        open={documentSelectorOpen}
        onOpenChange={setDocumentSelectorOpen}
        onSelectDocuments={handleSelectDocuments}
      />
      <FeedbackModal
        open={feedbackModalOpen}
        onOpenChange={setFeedbackModalOpen}
      />
    </div>
  );
}
