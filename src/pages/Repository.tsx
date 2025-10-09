import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/contexts/OrganizationContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Plus, Search, FileText, Download, Trash2, Eye } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB limit
const MAX_FILES_PER_UPLOAD = 10;

interface Document {
  id: string;
  filename: string;
  file_type: string;
  file_size: number;
  created_at: string;
  content_text: string | null;
  user_id: string;
  is_vectorized?: boolean;
  vectorization_status?: string;
  chunk_count?: number;
}

export default function Repository() {
  const { userRole } = useOrganization();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [viewDocument, setViewDocument] = useState<Document | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadDocuments();
  }, [userRole]);

  const loadDocuments = async () => {
    if (!userRole?.organization?.id) return;

    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("documents")
        .select("*")
        .eq("organization_id", userRole.organization.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setDocuments(data || []);
    } catch (error: any) {
      console.error("Error loading documents:", error);
      toast.error("Failed to load documents");
    } finally {
      setIsLoading(false);
    }
  };

  // Helper function to extract text from documents
  const extractDocumentText = async (file: File): Promise<string | null> => {
    try {
      // For TXT files, read directly
      if (file.name.endsWith('.txt')) {
        return await file.text();
      }

      // For PDF/DOCX, use parse-document edge function
      if (file.name.endsWith('.pdf') || file.name.endsWith('.docx')) {
        const formData = new FormData();
        formData.append('file', file);

        const { data, error } = await supabase.functions.invoke('parse-document', {
          body: formData,
        });

        if (error) {
          console.error(`Error parsing ${file.name}:`, error);
          return null;
        }

        return data?.text || null;
      }

      return null;
    } catch (error) {
      console.error(`Error extracting text from ${file.name}:`, error);
      return null;
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    let validFiles = Array.from(files).filter(file => 
      file.name.endsWith('.pdf') || file.name.endsWith('.docx') || file.name.endsWith('.txt')
    );

    if (validFiles.length === 0) {
      toast.error("Please select PDF, DOCX, or TXT files only");
      return;
    }

    // File size validation
    const oversizedFiles = validFiles.filter(f => f.size > MAX_FILE_SIZE);
    if (oversizedFiles.length > 0) {
      toast.error(`${oversizedFiles.length} file(s) exceed 20MB limit: ${oversizedFiles.map(f => f.name).join(', ')}`);
      validFiles = validFiles.filter(f => f.size <= MAX_FILE_SIZE);
    }

    if (validFiles.length === 0) return;

    // Max files validation
    if (validFiles.length > MAX_FILES_PER_UPLOAD) {
      toast.error(`Maximum ${MAX_FILES_PER_UPLOAD} files per upload. Selected: ${validFiles.length}`);
      return;
    }

    if (!userRole?.organization?.id) {
      toast.error("You must be assigned to an organization to upload documents. Please contact your administrator.");
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Check upload rate limit (50 files per day)
      const { data: canUpload, error: rateLimitError } = await supabase
        .rpc('check_rate_limit', {
          _user_id: user.id,
          _action_type: 'upload',
          _limit: 50,
          _window_minutes: 1440 // 24 hours
        });

      if (rateLimitError || !canUpload) {
        toast.error('Daily upload limit reached (50 files/day). Please try again tomorrow or contact support.');
        return;
      }

      const uploadToast = toast.loading(`Uploading ${validFiles.length} document(s)...`);

      for (const file of validFiles) {
        const fileType = file.name.split('.').pop() || '';
        
        // Extract text content with parsing
        toast.loading(`Parsing ${file.name}...`, { id: uploadToast });
        const contentText = await extractDocumentText(file);

        const { error } = await supabase
          .from("documents")
          .insert({
            user_id: user.id,
            organization_id: userRole.organization.id,
            filename: file.name,
            file_type: fileType,
            file_size: file.size,
            content_text: contentText,
            metadata: { 
              uploadedAt: new Date().toISOString(),
              parsed: contentText ? true : false
            }
          });

        if (error) throw error;
      }

      toast.success(`Uploaded ${validFiles.length} document(s)`, { id: uploadToast });
      loadDocuments();
    } catch (error: any) {
      console.error("Error uploading documents:", error);
      toast.error("Failed to upload documents");
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase
        .from("documents")
        .delete()
        .eq("id", id);

      if (error) throw error;

      setDocuments(documents.filter(doc => doc.id !== id));
      toast.success("Document deleted");
    } catch (error: any) {
      console.error("Error deleting document:", error);
      toast.error("Failed to delete document");
    }
  };

  const handleVectorize = async (documentId: string) => {
    try {
      toast.info("Starting document vectorization...");
      
      const { error } = await supabase.functions.invoke('embed-document', {
        body: { documentId }
      });

      if (error) throw error;

      toast.success("Document vectorized successfully! Now you'll get instant responses.");
      loadDocuments();
    } catch (error: any) {
      console.error("Error vectorizing document:", error);
      toast.error("Failed to vectorize document");
    }
  };

  const filteredDocuments = documents.filter(doc =>
    doc.filename.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex flex-col h-full bg-background">
      <div className="px-6 pt-6 flex-shrink-0">
        <div className="max-w-7xl mx-auto glass-card rounded-2xl shadow-xl border p-6">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-semibold">Repository</h1>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search documents..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 w-64"
                />
              </div>
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileUpload}
                accept=".pdf,.docx,.txt"
                multiple
                className="hidden"
              />
              <Button onClick={() => fileInputRef.current?.click()}>
                <Plus className="w-4 h-4 mr-2" />
                Upload Documents
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto px-6 py-6">
        {isLoading ? (
          <div className="text-center py-12 text-muted-foreground">Loading...</div>
        ) : filteredDocuments.length === 0 ? (
          <div className="text-center py-12">
            <FileText className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
            <h2 className="text-xl font-semibold mb-2">
              {searchQuery ? "No documents found" : "No documents yet"}
            </h2>
            <p className="text-muted-foreground mb-6">
              {searchQuery ? "Try a different search term" : "Upload legal documents to get started"}
            </p>
            {!searchQuery && (
              <Button onClick={() => fileInputRef.current?.click()}>
                <Plus className="w-4 h-4 mr-2" />
                Upload Your First Document
              </Button>
            )}
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Size</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Uploaded</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredDocuments.map((doc) => (
                <TableRow key={doc.id}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-muted-foreground" />
                      {doc.filename}
                    </div>
                  </TableCell>
                  <TableCell>{doc.file_type.toUpperCase()}</TableCell>
                  <TableCell>{(doc.file_size / 1024).toFixed(1)} KB</TableCell>
                  <TableCell>
                    {doc.is_vectorized ? (
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        ✓ Vectorized ({doc.chunk_count} chunks)
                      </span>
                    ) : doc.vectorization_status === 'processing' ? (
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        🔄 Processing...
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                        ⏳ Not vectorized
                      </span>
                    )}
                  </TableCell>
                  <TableCell>{formatDistanceToNow(new Date(doc.created_at), { addSuffix: true })}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      {!doc.is_vectorized && doc.content_text && (
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => handleVectorize(doc.id)}
                          disabled={doc.vectorization_status === 'processing'}
                        >
                          Vectorize
                        </Button>
                      )}
                      {doc.content_text && (
                        <Button variant="ghost" size="icon" onClick={() => setViewDocument(doc)}>
                          <Eye className="w-4 h-4" />
                        </Button>
                      )}
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(doc.id)}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <Dialog open={!!viewDocument} onOpenChange={() => setViewDocument(null)}>
        <DialogContent className="max-w-3xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>{viewDocument?.filename}</DialogTitle>
          </DialogHeader>
          <ScrollArea className="h-[60vh]">
            <pre className="text-sm whitespace-pre-wrap p-4 bg-muted rounded-lg">
              {viewDocument?.content_text || "No preview available"}
            </pre>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
}
