import { useState, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Upload, FileText, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface FileUploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onFileUploaded: (filename: string, content: string) => void;
}

const ACCEPTED_FILE_TYPES = '.pdf,.docx,.doc,.csv,.txt';
const ACCEPTED_MIME_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/msword',
  'text/csv',
  'text/plain'
];

export const FileUploadDialog = ({ open, onOpenChange, onFileUploaded }: FileUploadDialogProps) => {
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processFile = async (file: File) => {
    const validTypes = ['.pdf', '.docx', '.doc', '.csv', '.txt'];
    const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase();
    
    if (!validTypes.includes(fileExtension)) {
      toast.error("Please upload a PDF, Word, CSV, or TXT file");
      return;
    }

    setIsUploading(true);

    try {
      // For CSV files, read directly
      if (fileExtension === '.csv' || fileExtension === '.txt') {
        const text = await file.text();
        onFileUploaded(file.name, text);
        toast.success(`${file.name} uploaded successfully`);
        onOpenChange(false);
        return;
      }

      // For other files, use the parse-document edge function
      const formData = new FormData();
      formData.append('file', file);

      const { data, error } = await supabase.functions.invoke('parse-document', {
        body: formData,
      });

      if (error) throw error;

      if (data?.text) {
        onFileUploaded(data.filename || file.name, data.text);
        toast.success(`${file.name} uploaded successfully`);
        onOpenChange(false);
      }
    } catch (error) {
      console.error('Upload error:', error);
      toast.error("Failed to upload file");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    await processFile(file);
  };

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

    await processFile(file);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Upload Document</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Upload a document to reference in your drafting prompt. Supported formats: PDF, Word, CSV, TXT
          </p>
          <div 
            className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
              isDragging ? 'border-primary bg-primary/5' : 'border-border'
            }`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept={ACCEPTED_FILE_TYPES}
              onChange={handleFileSelect}
              className="hidden"
              id="file-upload"
            />
            <label htmlFor="file-upload" className="cursor-pointer">
              <div className="flex flex-col items-center gap-2">
                {isUploading ? (
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                ) : (
                  <Upload className={`h-8 w-8 transition-colors ${
                    isDragging ? 'text-primary' : 'text-muted-foreground'
                  }`} />
                )}
                <p className="text-sm font-medium">
                  {isUploading ? 'Uploading...' : isDragging ? 'Drop file here' : 'Click to upload or drag and drop'}
                </p>
                <p className="text-xs text-muted-foreground">PDF, Word, CSV, or TXT</p>
              </div>
            </label>
          </div>
          <Button variant="outline" className="w-full" onClick={() => fileInputRef.current?.click()} disabled={isUploading}>
            <FileText className="h-4 w-4 mr-2" />
            Select File
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
