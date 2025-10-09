import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  Check,
  X,
  Pencil,
  FileDown
} from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { RichTextEditor, RichTextEditorRef } from "./RichTextEditor";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { DraftVersionHistory } from "./DraftVersionHistory";
import { exportToTxt, exportToDocx, exportToPdf } from "@/utils/exportDocument";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { TemplatePreviewDialog } from "./TemplatePreviewDialog";
import { templates, Template } from "@/utils/templates";

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
  const [tempTitle, setTempTitle] = useState(title);
  const [previousTitle, setPreviousTitle] = useState(title);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [textColor, setTextColor] = useState("#000000");
  const [isDragging, setIsDragging] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving'>('saved');
  const [lastVersionContent, setLastVersionContent] = useState(content);
  const [lastVersionTitle, setLastVersionTitle] = useState(title);
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [showTemplatePreview, setShowTemplatePreview] = useState(false);
  const [showTemplateSelector, setShowTemplateSelector] = useState(false);
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
    setTempTitle(title);
    setPreviousTitle(title);
    setLastVersionTitle(title);
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
      }
    } catch (error) {
      console.error('Save draft error:', error);
      if (showToast) toast.error('Failed to save draft');
    } finally {
      setIsSaving(false);
    }
  };

  // Auto-save draft every 3 seconds
  useEffect(() => {
    if (!draftId) return;

    const timer = setTimeout(async () => {
      const hasContentChange = editorContent !== originalContent;
      const hasTitleChange = editableTitle !== previousTitle;
      
      if (hasContentChange || hasTitleChange) {
        setSaveStatus('saving');
        await saveDraft(false);
        setOriginalContent(editorContent);
        setPreviousTitle(editableTitle);
        setSaveStatus('saved');
      }
    }, 3000); // 3 seconds

    return () => clearTimeout(timer);
  }, [editorContent, editableTitle, draftId]);

  // Auto-save version every 30 seconds if there are significant changes
  useEffect(() => {
    if (!draftId) return;

    const timer = setTimeout(async () => {
      const hasSignificantChange = 
        editorContent !== lastVersionContent || 
        editableTitle !== lastVersionTitle;
      
      if (hasSignificantChange) {
        await createAutoVersion();
      }
    }, 30000); // 30 seconds

    return () => clearTimeout(timer);
  }, [editorContent, editableTitle, draftId, lastVersionContent, lastVersionTitle]);

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

  const createAutoVersion = async () => {
    if (!draftId) return;

    try {
      // Get current version number
      const nextVersion = await getCurrentVersion() + 1;

      // Create change summary
      const titleChanged = editableTitle !== lastVersionTitle;
      const charDelta = editorContent.length - lastVersionContent.length;
      const changesParts = [];
      
      if (titleChanged) changesParts.push('Title changed');
      if (charDelta > 0) changesParts.push(`${charDelta} chars added`);
      if (charDelta < 0) changesParts.push(`${Math.abs(charDelta)} chars removed`);
      
      const changesSummary = changesParts.length > 0 ? changesParts.join(', ') : 'Auto-saved';

      // Create a new version entry
      const { error: versionError } = await supabase
        .from('draft_versions')
        .insert({
          draft_id: draftId,
          version_number: nextVersion,
          content: { text: editorContent, changes: [] },
          changes_summary: changesSummary,
          version_name: null,
        });

      if (versionError) throw versionError;

      // Update the draft's current version
      await supabase
        .from('document_drafts')
        .update({ current_version: nextVersion })
        .eq('id', draftId);

      setCurrentVersion(nextVersion);
      setLastVersionContent(editorContent);
      setLastVersionTitle(editableTitle);
    } catch (error) {
      console.error('Error creating auto version:', error);
    }
  };

  const handleStartEditTitle = () => {
    setTempTitle(editableTitle);
    setIsEditingTitle(true);
  };

  const handleSaveTitle = async () => {
    if (!draftId || tempTitle.trim() === "") {
      toast.error("Title cannot be empty");
      return;
    }

    try {
      const { error } = await supabase
        .from('document_drafts')
        .update({ title: tempTitle })
        .eq('id', draftId);

      if (error) throw error;

      setEditableTitle(tempTitle);
      setIsEditingTitle(false);
      setPreviousTitle(tempTitle);
      toast.success("Title updated");
      if (onTitleSaved) {
        onTitleSaved(tempTitle);
      }
    } catch (error) {
      console.error('Error updating title:', error);
      toast.error("Failed to update title");
    }
  };

  const handleCancelEditTitle = () => {
    setTempTitle(editableTitle);
    setIsEditingTitle(false);
  };

  const handleTitleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSaveTitle();
    } else if (e.key === 'Escape') {
      handleCancelEditTitle();
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

  const handleInsertTemplate = (template: Template) => {
    const editor = editorRef.current?.editor;
    if (!editor) return;
    editor.chain().focus().insertContentAt(editor.state.doc.content.size, template.content).run();
    toast.success(`${template.title} inserted`);
  };

  const handleTemplateClick = (template: Template) => {
    setSelectedTemplate(template);
    setShowTemplatePreview(true);
    setShowTemplateSelector(false);
  };

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Unified Header with Title and Controls */}
      <div className="border-b px-6 py-3 flex items-center justify-between flex-shrink-0 bg-background">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <FileText className="h-5 w-5 text-primary flex-shrink-0" />
          {isEditingTitle ? (
            <>
              <Input
                type="text"
                value={tempTitle}
                onChange={(e) => setTempTitle(e.target.value)}
                onKeyDown={handleTitleKeyDown}
                className="text-lg font-semibold flex-1 min-w-0 h-9"
                placeholder="Untitled Document"
                autoFocus
              />
              <Button 
                onClick={handleSaveTitle}
                size="sm"
                className="flex-shrink-0 h-9"
              >
                <Check className="h-4 w-4" />
              </Button>
              <Button 
                onClick={handleCancelEditTitle}
                variant="ghost"
                size="sm"
                className="flex-shrink-0 h-9"
              >
                <X className="h-4 w-4" />
              </Button>
            </>
          ) : (
            <>
              <span className="text-lg font-semibold flex-1 min-w-0 truncate">
                {editableTitle}
              </span>
              <Button 
                onClick={handleStartEditTitle}
                variant="ghost"
                size="sm"
                className="flex-shrink-0 h-9"
                title="Rename document"
              >
                <Pencil className="h-4 w-4" />
              </Button>
            </>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground mr-2">
            {saveStatus === 'saving' ? 'Saving...' : 'All changes saved'}
          </span>
          {draftId && (
            <Sheet>
              <SheetTrigger asChild>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="h-9 text-xs gap-1.5"
                >
                  <History className="h-4 w-4" />
                  <span className="hidden sm:inline">Version History</span>
                </Button>
              </SheetTrigger>
              <SheetContent className="w-96 bg-white dark:bg-neutral-950 border-l shadow-2xl">
                <SheetHeader>
                  <SheetTitle>Version History</SheetTitle>
                </SheetHeader>
                <div className="mt-6">
                  <DraftVersionHistory draftId={draftId} onRestoreVersion={(c) => setEditorContent(c?.text ?? '')} />
                </div>
              </SheetContent>
            </Sheet>
          )}
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
      <div className="border-b px-6 py-2 flex items-center gap-1 flex-shrink-0 bg-muted">
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

        <div className="h-5 w-px bg-border mx-1" />

        <DropdownMenu open={showTemplateSelector} onOpenChange={setShowTemplateSelector}>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-8 text-xs px-3">
              <FileDown className="h-4 w-4 mr-2" />
              Insert Template
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-64">
            {templates.map((template) => (
              <DropdownMenuItem 
                key={template.id}
                onClick={() => handleTemplateClick(template)}
              >
                <div>
                  <div className="font-medium">{template.title}</div>
                  <div className="text-xs text-muted-foreground">{template.type}</div>
                </div>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

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