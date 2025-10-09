import { useState, useEffect, Fragment } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search, MessageSquare, Trash2, ChevronDown, ChevronRight, FileText, Eye } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import ContractHistory from "@/components/contract-review/ContractHistory";

interface Message {
  id: string;
  role: string;
  content: string;
  created_at: string;
}

interface Conversation {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
  conversation_type?: string;
  messages?: Message[];
}

interface Draft {
  id: string;
  title: string;
  document_type: string;
  created_at: string;
  updated_at: string;
  current_version: number;
  conversation_id?: string;
}

interface ContractReview {
  id: string;
  document_id: string;
  status: string;
  created_at: string;
  analysis_results: any;
  documents: {
    filename: string;
    file_type: string;
    created_at: string;
  };
}

export default function HistoryPage() {
  const navigate = useNavigate();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [contractReviews, setContractReviews] = useState<ContractReview[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [expandedConvId, setExpandedConvId] = useState<string | null>(null);
  const [loadingMessages, setLoadingMessages] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'conversations' | 'drafts' | 'contracts'>('conversations');
  const [selectedContractId, setSelectedContractId] = useState<string | null>(null);

  useEffect(() => {
    loadConversations();
    loadDrafts();
    loadContractReviews();
  }, []);

  const loadConversations = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("conversations")
        .select("id, title, created_at, updated_at, conversation_type")
        .eq("conversation_type", "assistant")
        .order("updated_at", { ascending: false });

      if (error) throw error;
      setConversations(data || []);
    } catch (error: any) {
      console.error("Error loading conversations:", error);
      toast.error("Failed to load conversation history");
    } finally {
      setIsLoading(false);
    }
  };

  const loadDrafts = async () => {
    try {
      // Load document_drafts directly
      const { data: draftsData, error: draftsError } = await supabase
        .from("document_drafts")
        .select("id, title, document_type, created_at, updated_at, current_version, conversation_id")
        .order("updated_at", { ascending: false });

      if (draftsError) throw draftsError;

      // Also load drafter conversations
      const { data: convData, error: convError } = await supabase
        .from("conversations")
        .select("id, title, created_at, updated_at, conversation_type")
        .eq("conversation_type", "drafter")
        .order("updated_at", { ascending: false });

      if (convError) throw convError;

      // Combine both into a unified list (prioritize drafts)
      const allDrafts = [...(draftsData || [])];
      setDrafts(allDrafts);
    } catch (error: any) {
      console.error("Error loading drafts:", error);
      toast.error("Failed to load drafts");
    }
  };

  const loadContractReviews = async () => {
    try {
      const { data, error } = await supabase
        .from('contract_reviews')
        .select(`
          *,
          documents!inner(filename, file_type, created_at)
        `)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      setContractReviews(data || []);
    } catch (error: any) {
      console.error("Error loading contract reviews:", error);
      toast.error("Failed to load contract reviews");
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase
        .from("conversations")
        .delete()
        .eq("id", id);

      if (error) throw error;

      setConversations(conversations.filter(c => c.id !== id));
      toast.success("Conversation deleted");
    } catch (error: any) {
      console.error("Error deleting conversation:", error);
      toast.error("Failed to delete conversation");
    }
  };

  const handleDeleteDraft = async (id: string) => {
    try {
      const { error } = await supabase
        .from("document_drafts")
        .delete()
        .eq("id", id);

      if (error) throw error;

      setDrafts(drafts.filter(d => d.id !== id));
      toast.success("Draft deleted");
    } catch (error: any) {
      console.error("Error deleting draft:", error);
      toast.error("Failed to delete draft");
    }
  };

  const loadMessages = async (conversationId: string) => {
    setLoadingMessages(conversationId);
    try {
      const { data, error } = await supabase
        .from("messages")
        .select("*")
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: true });

      if (error) throw error;

      setConversations(prev => prev.map(conv => 
        conv.id === conversationId 
          ? { ...conv, messages: data || [] }
          : conv
      ));
    } catch (error: any) {
      console.error("Error loading messages:", error);
      toast.error("Failed to load messages");
    } finally {
      setLoadingMessages(null);
    }
  };

  const handleExpandConversation = async (conversationId: string) => {
    if (expandedConvId === conversationId) {
      setExpandedConvId(null);
    } else {
      setExpandedConvId(conversationId);
      const conv = conversations.find(c => c.id === conversationId);
      if (!conv?.messages) {
        await loadMessages(conversationId);
      }
    }
  };

  const handleOpenConversation = (conversation: Conversation) => {
    localStorage.setItem('lastConversationId', conversation.id);
    const route = conversation.conversation_type === 'drafter' ? '/drafter' : '/assistant';
    navigate(route);
  };

  const handleOpenDraft = (draft: Draft) => {
    localStorage.setItem('selectedDraftId', draft.id);
    if (draft.conversation_id) {
      localStorage.setItem('lastConversationId', draft.conversation_id);
    }
    navigate('/drafter');
  };

  const filteredConversations = conversations.filter(conv =>
    conv.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredDrafts = drafts.filter(draft =>
    draft.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredContracts = contractReviews.filter(review =>
    review.documents.filename.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex flex-col h-full bg-gradient-to-br from-background via-muted/30 to-background">
      <div className="px-6 pt-6 flex-shrink-0">
        <div className="max-w-7xl mx-auto glass-card rounded-2xl shadow-xl border p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-semibold">History</h1>
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={`Search ${activeTab}...`}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 w-64"
              />
            </div>
          </div>

          <div className="border-t" />

          <div className="flex gap-2">
            <Button
              variant={activeTab === 'conversations' ? 'default' : 'outline'}
              onClick={() => setActiveTab('conversations')}
            >
              Assistant Chats
            </Button>
            <Button
              variant={activeTab === 'drafts' ? 'default' : 'outline'}
              onClick={() => setActiveTab('drafts')}
            >
              Document Drafts
            </Button>
            <Button
              variant={activeTab === 'contracts' ? 'default' : 'outline'}
              onClick={() => setActiveTab('contracts')}
            >
              Contracts
            </Button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto px-6 py-6">
        {activeTab === 'contracts' ? (
          // Contracts tab
          isLoading ? (
            <div className="text-center py-12 text-muted-foreground">Loading...</div>
          ) : filteredContracts.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
              <h2 className="text-xl font-semibold mb-2">
                {searchQuery ? "No contracts found" : "No contracts yet"}
              </h2>
              <p className="text-muted-foreground mb-6">
                {searchQuery ? "Try a different search term" : "Review your first contract to see it here"}
              </p>
              {!searchQuery && (
                <Button onClick={() => navigate('/contract-review')}>
                  Review Contract
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {filteredContracts.map((review) => (
                <Card key={review.id} className="p-6">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-2">
                        <FileText className="w-5 h-5 text-primary flex-shrink-0" />
                        <h3 className="font-semibold text-lg truncate">
                          {review.documents.filename}
                        </h3>
                        <Badge variant={review.status === 'completed' ? 'default' : 'secondary'}>
                          {review.status}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground mb-3">
                        <span>Reviewed: {formatDistanceToNow(new Date(review.created_at), { addSuffix: true })}</span>
                        {review.analysis_results?.total_findings && (
                          <span>{review.analysis_results.total_findings} findings</span>
                        )}
                        {review.analysis_results?.high_risk > 0 && (
                          <Badge variant="destructive" className="text-xs">
                            {review.analysis_results.high_risk} high risk
                          </Badge>
                        )}
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSelectedContractId(
                          selectedContractId === review.document_id ? null : review.document_id
                        )}
                      >
                        <Eye className="w-4 h-4 mr-2" />
                        {selectedContractId === review.document_id ? 'Hide' : 'View'} Version History
                      </Button>
                    </div>
                  </div>
                  
                  {selectedContractId === review.document_id && (
                    <div className="mt-6 border-t pt-6">
                      <ContractHistory documentId={review.document_id} />
                    </div>
                  )}
                </Card>
              ))}
            </div>
          )
        ) : activeTab === 'conversations' ? (
          isLoading ? (
            <div className="text-center py-12 text-muted-foreground">Loading...</div>
          ) : filteredConversations.length === 0 ? (
          <div className="text-center py-12">
            <MessageSquare className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
            <h2 className="text-xl font-semibold mb-2">
              {searchQuery ? "No conversations found" : "No conversations yet"}
            </h2>
            <p className="text-muted-foreground mb-6">
              {searchQuery ? "Try a different search term" : "Start chatting with Briefly AI to create your first conversation"}
            </p>
            {!searchQuery && (
              <Button onClick={() => navigate('/')}>
                Start New Chat
              </Button>
            )}
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Last Updated</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredConversations.map((conv) => (
                <Fragment key={conv.id}>
                  <TableRow className="hover:bg-muted/50">
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <Button 
                          variant="ghost" 
                          size="sm"
                          className="p-0 h-auto"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleExpandConversation(conv.id);
                          }}
                          aria-expanded={expandedConvId === conv.id}
                          aria-controls={`conv-${conv.id}-messages`}
                        >
                          {expandedConvId === conv.id ? (
                            <ChevronDown className="w-4 h-4 text-muted-foreground" />
                          ) : (
                            <ChevronRight className="w-4 h-4 text-muted-foreground" />
                          )}
                        </Button>
                        <MessageSquare className="w-4 h-4 text-muted-foreground" />
                        <span 
                          className="cursor-pointer hover:underline"
                          onClick={() => handleOpenConversation(conv)}
                        >
                          {conv.title}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>{formatDistanceToNow(new Date(conv.created_at), { addSuffix: true })}</TableCell>
                    <TableCell>{formatDistanceToNow(new Date(conv.updated_at), { addSuffix: true })}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => handleOpenConversation(conv)}
                        >
                          Open Chat
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(conv.id);
                          }}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>

                  {expandedConvId === conv.id && (
                    <TableRow id={`conv-${conv.id}-messages`}>
                      <TableCell colSpan={4} className="bg-muted/30 p-0">
                        <div className="p-4 space-y-3 max-h-96 overflow-y-auto">
                          {loadingMessages === conv.id ? (
                            <div className="text-sm text-muted-foreground text-center py-4">
                              Loading messages...
                            </div>
                          ) : conv.messages && conv.messages.length > 0 ? (
                            conv.messages.map((msg) => (
                              <div
                                key={msg.id}
                                className={`p-3 rounded-lg ${
                                  msg.role === "user"
                                    ? "bg-primary/10 ml-12"
                                    : "bg-card border border-border/50 mr-12"
                                }`}
                              >
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="text-xs font-medium text-muted-foreground">
                                    {msg.role === "user" ? "You" : "Briefly AI"}
                                  </span>
                                  <span className="text-xs text-muted-foreground">
                                    {formatDistanceToNow(new Date(msg.created_at), { addSuffix: true })}
                                  </span>
                                </div>
                                <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                              </div>
                            ))
                          ) : (
                            <div className="text-sm text-muted-foreground text-center py-4">
                              No messages in this conversation
                            </div>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </Fragment>
              ))}
            </TableBody>
          </Table>
        )
      ) : (
        // Drafts tab
        isLoading ? (
          <div className="text-center py-12 text-muted-foreground">Loading...</div>
        ) : filteredDrafts.length === 0 ? (
          <div className="text-center py-12">
            <MessageSquare className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
            <h2 className="text-xl font-semibold mb-2">
              {searchQuery ? "No drafts found" : "No drafts yet"}
            </h2>
            <p className="text-muted-foreground mb-6">
              {searchQuery ? "Try a different search term" : "Start drafting documents to see them here"}
            </p>
            {!searchQuery && (
              <Button onClick={() => navigate('/drafter')}>
                Start Drafting
              </Button>
            )}
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Version</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Last Updated</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredDrafts.map((draft) => (
                <TableRow key={draft.id} className="hover:bg-muted/50">
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      <MessageSquare className="w-4 h-4 text-muted-foreground" />
                      <span 
                        className="cursor-pointer hover:underline"
                        onClick={() => handleOpenDraft(draft)}
                      >
                        {draft.title}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>{draft.document_type}</TableCell>
                  <TableCell>v{draft.current_version}</TableCell>
                  <TableCell>{formatDistanceToNow(new Date(draft.created_at), { addSuffix: true })}</TableCell>
                  <TableCell>{formatDistanceToNow(new Date(draft.updated_at), { addSuffix: true })}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => handleOpenDraft(draft)}
                      >
                        Open Draft
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteDraft(draft.id);
                        }}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )
      )}
      </div>
    </div>
  );
}
