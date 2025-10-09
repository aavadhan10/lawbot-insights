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
  Edit3,
  Save,
  Palette,
  RotateCcw
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
import { formatDistanceToNow } from "date-fns";

interface Change {
  type: 'deletion' | 'insertion';
  text: string;
  start?: number;
  end?: number;
  position?: number;
}

interface DocumentEditorProps {
  content: string;
  title: string;
  changes?: Change[];
  isGenerating?: boolean;
  onExport?: (format: 'txt' | 'docx' | 'pdf') => void;
  draftId?: string;
  onTitleSaved?: (title: string) => void;
}

export const DocumentEditor = ({ 
  content, 
  title,
  changes = [],
  isGenerating = false,
  onExport,
  draftId,
  onTitleSaved
}: DocumentEditorProps) => {
  const [editorContent, setEditorContent] = useState(content);
  const [originalContent, setOriginalContent] = useState(content);
  const [currentVersion, setCurrentVersion] = useState(1);
  const [editableTitle, setEditableTitle] = useState(title);
  const [previousTitle, setPreviousTitle] = useState(title);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [textColor, setTextColor] = useState("#000000");
  const [isDragging, setIsDragging] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [lastVersionContent, setLastVersionContent] = useState(content);
  const editorRef = useRef<RichTextEditorRef>(null);

  useEffect(() => {
    const loadCurrentVersion = async () => {
      if (!draftId) return;
      const version = await getCurrentVersion();
      setCurrentVersion(version);
    };
    loadCurrentVersion();
  }, [draftId]);

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
    setLastVersionContent(content);
    setEditableTitle(title);
    setPreviousTitle(title);
  }, [content, draftId, title]);

  const getCurrentVersion = async () => {
    if (!draftId) return 1;
    
    const { data, error } = await supabase
      .from('document_drafts')
      .select('current_version')
      .eq('id', draftId)
      .single();

    if (!error && data) {
      return data.current_version || 1;
    }
    return 1;
  };

  const saveDraft = async (showToast = true) => {
    if (!draftId) return;

    setIsSaving(true);
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
        if (showToast) toast.success('Draft saved');
        setLastSaved(new Date());
      }
    } catch (error) {
      console.error('Save draft error:', error);
      if (showToast) toast.error('Failed to save draft');
    } finally {
      setIsSaving(false);
    }
  };

  // Auto-save with debouncing (30 seconds, no version creation)
  useEffect(() => {
    if (!draftId) return;

    const timer = setTimeout(async () => {
      await saveDraft(false);
    }, 30000); // 30 seconds

    return () => clearTimeout(timer);
  }, [editorContent, editableTitle, draftId]);

  const calculateChangesSummary = (oldContent: string, newContent: string, oldTitle: string, newTitle: string): string => {
    const parts = [];
    
    if (oldTitle !== newTitle) {
      parts.push(`Renamed to "${newTitle}"`);
    }
    
    const oldLength = oldContent.length;
    const newLength = newContent.length;
    const diff = newLength - oldLength;
    
    if (diff > 0) {
      parts.push(`Added ~${diff} characters`);
    } else if (diff < 0) {
      parts.push(`Removed ~${Math.abs(diff)} characters`);
    } else if (oldContent !== newContent) {
      parts.push('Content modified');
    }
    
    return parts.length > 0 ? parts.join('; ') : 'Manual save';
  };

  const handleManualSave = async () => {
    if (!draftId) return;

    setIsSaving(true);
    try {
      // Save draft with current content and title
      await saveDraft(false);
      
      // Get current version number from DB
      const nextVersion = await getCurrentVersion() + 1;
      const changesSummary = calculateChangesSummary(lastVersionContent, editorContent, previousTitle, editableTitle);
      
      // Create version snapshot
      const { error: versionError } = await supabase
        .from('draft_versions')
        .insert({
          draft_id: draftId,
          version_number: nextVersion,
          content: { text: editorContent, changes: [] },
          changes_summary: changesSummary
        });

      if (!versionError) {
        // Update current_version in document_drafts
        await supabase
          .from('document_drafts')
          .update({ current_version: nextVersion })
          .eq('id', draftId);
        
        setCurrentVersion(nextVersion);
        setLastVersionContent(editorContent);
        setOriginalContent(editorContent);
        setPreviousTitle(editableTitle);
        toast.success(`Saved as version ${nextVersion}`);
      }
    } catch (error) {
      console.error('Save version error:', error);
      toast.error('Failed to save version');
    } finally {
      setIsSaving(false);
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
        setIsEditingTitle(false);
        if (onTitleSaved) {
          onTitleSaved(editableTitle);
        }
      }
    } catch (error) {
      console.error('Save title error:', error);
      toast.error('Failed to save title');
    }
  };

  const handleTitleBlur = () => {
    if (editableTitle !== title) {
      handleSaveTitle();
    } else {
      setIsEditingTitle(false);
    }
  };

  const handleRevert = () => {
    setEditorContent(originalContent);
    toast.success('Reverted to last saved version');
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
        <div className="flex items-center gap-3 flex-1">
          <input
            type="text"
            value={editableTitle}
            onChange={(e) => setEditableTitle(e.target.value)}
            className="text-lg font-semibold tracking-tight bg-transparent border-b-2 border-transparent hover:border-muted focus:border-primary focus:outline-none transition-colors px-2 py-1 rounded"
            placeholder="Document title..."
            onBlur={handleTitleBlur}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                handleSaveTitle();
                e.currentTarget.blur();
              }
            }}
          />
          {editableTitle !== title && (
            <Button variant="ghost" size="sm" onClick={handleSaveTitle} className="h-8">
              <Save className="h-3.5 w-3.5 mr-1.5" />
              Save Title
            </Button>
          )}
        </div>
        <div className="flex items-center gap-2">
          {isSaving && (
            <span className="text-xs text-muted-foreground">Saving...</span>
          )}
          {!isSaving && lastSaved && (
            <span className="text-xs text-muted-foreground">
              Saved {formatDistanceToNow(lastSaved, { addSuffix: true })}
            </span>
          )}
          <Button 
            variant="default" 
            size="sm" 
            className="h-9 text-xs gap-1.5"
            onClick={handleManualSave}
            disabled={!draftId || isSaving}
          >
            <Save className="h-4 w-4" />
            <span className="hidden sm:inline">Save Version</span>
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button 
                variant="outline" 
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
                {/* Changes Banner - Always show when there are unsaved changes */}
                {editorContent !== originalContent && (
                  <div className="mb-6 p-4 bg-yellow-500/10 rounded-lg border border-yellow-500/30 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Edit3 className="h-4 w-4 text-yellow-600" />
                      <div>
                        <h3 className="text-sm font-semibold text-yellow-900 dark:text-yellow-100">
                          Unsaved changes
                        </h3>
                        <p className="text-xs text-yellow-700 dark:text-yellow-300">
                          Click "Save Version" to preserve your changes
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={handleRevert}
                        className="h-8 text-xs"
                      >
                        <RotateCcw className="h-3 w-3 mr-1" />
                        Revert
                      </Button>
                      <Button 
                        variant="default" 
                        size="sm"
                        onClick={handleManualSave}
                        disabled={isSaving}
                        className="h-8 text-xs"
                      >
                        <Save className="h-3 w-3 mr-1" />
                        Save Version
                      </Button>
                    </div>
                  </div>
                )}
                
                <RichTextEditor 
                  ref={editorRef}
                  content={editorContent}
                  onChange={setEditorContent}
                  editable={true}
                />
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