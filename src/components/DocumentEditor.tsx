import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { 
  Download, 
  FileText, 
  Loader2, 
  Bold, 
  Italic, 
  Underline, 
  Strikethrough,
  AlignLeft,
  History,
  Edit3,
  Save,
  Palette
} from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { RichTextEditor, RichTextEditorRef } from "./RichTextEditor";
import { exportToTxt, exportToDocx, exportToPdf } from "@/utils/exportDocument";
import { toast } from "sonner";

interface Change {
  type: 'deletion' | 'insertion';
  text: string;
  start?: number;
  end?: number;
  position?: number;
}

interface Version {
  id: string;
  version_number: number;
  content: string;
  created_at: string;
}

interface DocumentEditorProps {
  content: string;
  title: string;
  changes?: Change[];
  isGenerating?: boolean;
  onExport?: (format: 'txt' | 'docx' | 'pdf') => void;
  draftId?: string;
}

export const DocumentEditor = ({ 
  content, 
  title,
  changes = [],
  isGenerating = false,
  onExport,
  draftId
}: DocumentEditorProps) => {
  const [editorContent, setEditorContent] = useState(content);
  const [originalContent, setOriginalContent] = useState(content);
  const [showEdits, setShowEdits] = useState(false);
  const [versions, setVersions] = useState<Version[]>([]);
  const [currentVersion, setCurrentVersion] = useState(1);
  const [showVersions, setShowVersions] = useState(false);
  const [editableTitle, setEditableTitle] = useState(title);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [textColor, setTextColor] = useState("#000000");
  const [isDragging, setIsDragging] = useState(false);
  const editorRef = useRef<RichTextEditorRef>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const file = e.dataTransfer.files?.[0];
    if (!file) return;

    const validTypes = ['.pdf', '.docx', '.doc', '.txt'];
    const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase();
    
    if (!validTypes.includes(fileExtension)) {
      toast.error("Please upload a PDF, Word, or TXT file");
      return;
    }

    try {
      const formData = new FormData();
      formData.append('file', file);

      const { data, error } = await supabase.functions.invoke('parse-document', {
        body: formData,
      });

      if (error) throw error;

      if (data?.text) {
        setEditorContent(data.text);
        toast.success(`${file.name} loaded successfully`);
      }
    } catch (error) {
      console.error('Upload error:', error);
      toast.error("Failed to load file");
    }
  };

  useEffect(() => {
    setEditorContent(content);
    setOriginalContent(content);
    setEditableTitle(title);
    if (draftId) {
      loadVersions();
    }
  }, [content, draftId, title]);

  const loadVersions = async () => {
    if (!draftId) return;
    
    const { data, error } = await supabase
      .from('document_versions')
      .select('*')
      .eq('draft_id', draftId)
      .order('version_number', { ascending: false });

    if (!error && data) {
      setVersions(data);
      if (data.length > 0) {
        setCurrentVersion(data[0].version_number);
      }
    }
  };

  const saveDraft = async () => {
    if (!draftId || !editorContent) return;

    try {
      const { error } = await supabase
        .from('document_drafts')
        .update({
          content: { text: editorContent, changes: [] },
          title: editableTitle,
          updated_at: new Date().toISOString()
        })
        .eq('id', draftId);

      if (!error) {
        toast.success('Draft saved');
        setOriginalContent(editorContent);
      }
    } catch (error) {
      console.error('Save draft error:', error);
      toast.error('Failed to save draft');
    }
  };

  const saveVersion = async () => {
    if (!draftId || !editorContent) return;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const nextVersion = currentVersion + 1;
    
    const { error } = await supabase
      .from('document_versions')
      .insert({
        draft_id: draftId,
        version_number: nextVersion,
        content: editorContent,
        created_by: user.id
      });

    if (!error) {
      setCurrentVersion(nextVersion);
      setOriginalContent(editorContent);
      toast.success('New version saved');
      loadVersions();
    }
  };

  const handleSaveTitle = async () => {
    if (!draftId || !editableTitle) return;

    try {
      const { error } = await supabase
        .from('document_drafts')
        .update({ title: editableTitle })
        .eq('id', draftId);

      if (!error) {
        toast.success('Title saved');
        setIsEditingTitle(false);
      }
    } catch (error) {
      console.error('Save title error:', error);
      toast.error('Failed to save title');
    }
  };

  const loadVersion = async (versionId: string) => {
    const version = versions.find(v => v.id === versionId);
    if (version) {
      setEditorContent(version.content);
      setCurrentVersion(version.version_number);
      toast.success(`Loaded version ${version.version_number}`);
      setShowVersions(false);
    }
  };

  const handleExport = async (format: 'txt' | 'docx' | 'pdf') => {
    try {
      const contentToExport = editorContent || content;
      const docTitle = title || 'Draft';
      
      if (format === 'txt') {
        exportToTxt(contentToExport, docTitle);
      } else if (format === 'docx') {
        await exportToDocx(contentToExport, docTitle);
      } else if (format === 'pdf') {
        exportToPdf(contentToExport, docTitle);
      }
      
      toast.success(`Exported as ${format.toUpperCase()}`);
      
      if (onExport) {
        onExport(format);
      }
    } catch (error) {
      console.error('Export error:', error);
      toast.error('Failed to export document');
    }
  };

  const applyFormatting = (command: string, value?: string) => {
    const editor = editorRef.current?.editor;
    if (!editor) return;

    switch (command) {
      case 'bold':
        editor.chain().focus().toggleBold().run();
        break;
      case 'italic':
        editor.chain().focus().toggleItalic().run();
        break;
      case 'underline':
        editor.chain().focus().toggleUnderline().run();
        break;
      case 'strike':
        editor.chain().focus().toggleStrike().run();
        break;
      case 'heading1':
        editor.chain().focus().toggleHeading({ level: 1 }).run();
        break;
      case 'heading2':
        editor.chain().focus().toggleHeading({ level: 2 }).run();
        break;
      case 'heading3':
        editor.chain().focus().toggleHeading({ level: 3 }).run();
        break;
      case 'paragraph':
        editor.chain().focus().setParagraph().run();
        break;
      case 'color':
        if (value) {
          editor.chain().focus().setColor(value).run();
        }
        break;
    }
  };

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Unified Header with Title and Controls */}
      <div className="border-b px-6 py-3 flex items-center justify-between flex-shrink-0 bg-background">
        <div className="flex items-center gap-2 flex-1">
          {isEditingTitle ? (
            <>
              <input
                type="text"
                value={editableTitle}
                onChange={(e) => setEditableTitle(e.target.value)}
                className="text-lg font-semibold tracking-tight bg-transparent border-b border-primary focus:outline-none"
                autoFocus
                onBlur={() => setIsEditingTitle(false)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleSaveTitle();
                  } else if (e.key === 'Escape') {
                    setIsEditingTitle(false);
                    setEditableTitle(title);
                  }
                }}
              />
              <Button variant="ghost" size="sm" onClick={handleSaveTitle}>
                <Save className="h-4 w-4" />
              </Button>
            </>
          ) : (
            <h1 
              className="text-lg font-semibold tracking-tight cursor-pointer hover:text-primary"
              onClick={() => setIsEditingTitle(true)}
            >
              {editableTitle || "Draft"}
            </h1>
          )}
        </div>
        <div className="flex items-center gap-2">
          <DropdownMenu open={showVersions} onOpenChange={setShowVersions}>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-9 text-xs gap-1.5">
                <History className="h-4 w-4" />
                <span className="hidden sm:inline">Version {currentVersion}</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64">
              {versions.length > 0 ? (
                versions.map((version) => (
                  <DropdownMenuItem 
                    key={version.id}
                    onClick={() => loadVersion(version.id)}
                    className="flex flex-col items-start py-3"
                  >
                    <span className="font-medium">Version {version.version_number}</span>
                    <span className="text-xs text-muted-foreground">
                      {new Date(version.created_at).toLocaleString()}
                    </span>
                  </DropdownMenuItem>
                ))
              ) : (
                <DropdownMenuItem disabled>No versions saved yet</DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
          <Button 
            variant="outline" 
            size="sm" 
            className="h-9 text-xs"
            onClick={saveDraft}
            disabled={!draftId || isGenerating}
          >
            <Save className="h-3.5 w-3.5 mr-1" />
            <span className="hidden sm:inline">Save Draft</span>
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            className="h-9 text-xs"
            onClick={saveVersion}
            disabled={!draftId || isGenerating || editorContent === originalContent}
          >
            <History className="h-3.5 w-3.5 mr-1" />
            <span className="hidden sm:inline">Save Version</span>
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button 
                variant="default" 
                size="sm" 
                className="h-9 text-xs gap-1.5"
                disabled={!content || isGenerating}
              >
                <Download className="h-4 w-4" />
                <span className="hidden sm:inline">Export</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => handleExport('txt')}>Export as TXT</DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleExport('docx')}>Export as DOCX</DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleExport('pdf')}>Export as PDF</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Enhanced Formatting Toolbar */}
      <div className="border-b px-6 py-2 flex items-center gap-1 flex-shrink-0 bg-muted/30">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-8 text-xs font-normal px-3">
              Paragraph
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-40">
            <DropdownMenuItem onClick={() => applyFormatting('paragraph')}>
              <AlignLeft className="h-4 w-4 mr-2" />
              Paragraph
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => applyFormatting('heading1')}>
              <span className="font-bold mr-2">H1</span>
              Heading 1
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => applyFormatting('heading2')}>
              <span className="font-bold mr-2 text-sm">H2</span>
              Heading 2
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => applyFormatting('heading3')}>
              <span className="font-bold mr-2 text-xs">H3</span>
              Heading 3
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <div className="h-5 w-px bg-border mx-1" />

        <div className="flex items-center">
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-8 w-8 hover:bg-accent" 
            onClick={() => applyFormatting('bold')}
            title="Bold"
          >
            <Bold className="h-4 w-4" />
          </Button>
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-8 w-8 hover:bg-accent" 
            onClick={() => applyFormatting('italic')}
            title="Italic"
          >
            <Italic className="h-4 w-4" />
          </Button>
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-8 w-8 hover:bg-accent" 
            onClick={() => applyFormatting('underline')}
            title="Underline"
          >
            <Underline className="h-4 w-4" />
          </Button>
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-8 w-8 hover:bg-accent" 
            onClick={() => applyFormatting('strike')}
            title="Strikethrough"
          >
            <Strikethrough className="h-4 w-4" />
          </Button>
        </div>

        <div className="h-5 w-px bg-border mx-1" />

        <div className="flex items-center">
          <input
            type="color"
            value={textColor}
            onChange={(e) => {
              setTextColor(e.target.value);
              applyFormatting('color', e.target.value);
            }}
            className="h-8 w-8 cursor-pointer rounded border border-border"
            title="Text Color"
          />
        </div>

        <div className="flex-1" />

        <Button 
          variant="ghost" 
          size="sm" 
          className="h-8 text-xs text-muted-foreground gap-1.5 hover:text-foreground" 
          onClick={() => setShowEdits(!showEdits)}
        >
          <Edit3 className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">{showEdits ? 'Hide edits' : 'Show edits'}</span>
        </Button>
      </div>
      
      {/* Document Content with Paper-like Feel */}
      <div className="flex-1 overflow-hidden bg-muted/20">
        <ScrollArea className="h-full">
          <div className="p-8 sm:p-12 max-w-5xl mx-auto">
            {isGenerating ? (
              <div className="flex flex-col items-center justify-center h-96 text-muted-foreground">
                <Loader2 className="h-8 w-8 animate-spin mb-4" />
                <p className="text-sm font-medium">Generating document...</p>
                <p className="text-xs text-muted-foreground mt-1">This may take a moment</p>
              </div>
            ) : content ? (
              <div className="bg-background rounded-xl shadow-lg border p-10 sm:p-16 min-h-[calc(100vh-16rem)]">
                <div className={showEdits ? 'relative' : ''}>
                  <RichTextEditor 
                    ref={editorRef}
                    content={showEdits ? editorContent : content}
                    onChange={setEditorContent}
                    editable={true}
                  />
                  {showEdits && editorContent !== originalContent && (
                    <div className="mt-6 p-4 bg-accent/50 rounded-lg border border-accent">
                      <h3 className="text-sm font-semibold mb-1 flex items-center gap-2">
                        <Edit3 className="h-4 w-4" />
                        Changes Made
                      </h3>
                      <p className="text-xs text-muted-foreground">
                        Document has been modified. Save as a new version to preserve changes.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div 
                className={`flex flex-col items-center justify-center h-96 bg-background rounded-xl shadow-lg border-2 border-dashed transition-all ${
                  isDragging ? 'border-primary bg-primary/5 scale-[1.02]' : 'border-border'
                }`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
              >
                <FileText className={`h-16 w-16 mb-4 transition-colors ${
                  isDragging ? 'text-primary' : 'text-muted-foreground/40'
                }`} />
                <h2 className="text-2xl font-semibold text-foreground mb-2">
                  {isDragging ? 'Drop document here' : 'Start Your Document'}
                </h2>
                <p className="text-sm text-muted-foreground mb-6 text-center max-w-md">
                  {isDragging 
                    ? 'Release to load the document' 
                    : 'Use the chat to generate a new document, upload an existing one, or drag & drop a file here'}
                </p>
              </div>
            )}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
};