-- Add conversation_type column to conversations table
ALTER TABLE conversations 
ADD COLUMN conversation_type text NOT NULL DEFAULT 'assistant' 
CHECK (conversation_type IN ('assistant', 'drafter'));

-- Add index for better query performance
CREATE INDEX idx_conversations_type ON conversations(conversation_type);

-- Add comment for documentation
COMMENT ON COLUMN conversations.conversation_type IS 'Type of conversation: assistant for AI Assistant, drafter for Document Drafter';