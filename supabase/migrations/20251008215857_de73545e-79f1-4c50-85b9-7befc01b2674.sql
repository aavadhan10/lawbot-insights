-- Add conversation_id column to document_drafts table
ALTER TABLE document_drafts 
ADD COLUMN conversation_id uuid REFERENCES conversations(id) ON DELETE SET NULL;

-- Create index for faster lookups
CREATE INDEX idx_document_drafts_conversation_id ON document_drafts(conversation_id);