import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BookOpen, FileText, Workflow, MessageSquare, Mail } from "lucide-react";

export default function Help() {
  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-6 py-4 border-b">
        <h1 className="text-2xl font-semibold">Help & Support</h1>
      </div>

      <div className="flex-1 overflow-auto px-6 py-8">
        <div className="max-w-3xl mx-auto space-y-6">
          {/* Getting Started */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <BookOpen className="w-5 h-5" />
                <CardTitle>Getting Started</CardTitle>
              </div>
              <CardDescription>Learn the basics of Briefly AI Assistant</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <h3 className="font-medium flex items-center gap-2">
                  <FileText className="w-4 h-4" />
                  Uploading Documents
                </h3>
                <p className="text-sm text-muted-foreground">
                  Upload PDF, DOCX, or TXT files directly in the Assistant page. You can drag and drop files or click the attachment button. Documents are automatically parsed and made searchable within your organization.
                </p>
              </div>

              <div className="space-y-2">
                <h3 className="font-medium flex items-center gap-2">
                  <Workflow className="w-4 h-4" />
                  Using Workflows
                </h3>
                <p className="text-sm text-muted-foreground">
                  Workflows are pre-built templates for common legal tasks. Click any workflow card to automatically fill the chat with the appropriate prompt. You can then customize it before sending.
                </p>
              </div>

              <div className="space-y-2">
                <h3 className="font-medium flex items-center gap-2">
                  <MessageSquare className="w-4 h-4" />
                  Chat Interface
                </h3>
                <p className="text-sm text-muted-foreground">
                  The AI assistant understands legal terminology and context. Ask questions about your documents, request summaries, or get help drafting legal content. All conversations are saved to your history.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Features Guide */}
          <Card>
            <CardHeader>
              <CardTitle>Features Guide</CardTitle>
              <CardDescription>Detailed information about key features</CardDescription>
            </CardHeader>
            <CardContent>
              <Accordion type="single" collapsible className="w-full">
                <AccordionItem value="repository">
                  <AccordionTrigger>Repository Management</AccordionTrigger>
                  <AccordionContent className="text-sm text-muted-foreground">
                    The Repository allows you to store and organize legal documents. All documents are shared across your organization and can be referenced in chat conversations. Use the search feature to quickly find specific documents.
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="prompts">
                  <AccordionTrigger>Prompt Library</AccordionTrigger>
                  <AccordionContent className="text-sm text-muted-foreground">
                    Access pre-built prompts for common legal tasks. Prompts include placeholders that you can fill in with your specific information. Examples include document summarization, memo drafting, and risk analysis.
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="history">
                  <AccordionTrigger>Conversation History</AccordionTrigger>
                  <AccordionContent className="text-sm text-muted-foreground">
                    All your conversations are automatically saved and organized by date. You can search through past conversations, continue previous discussions, or delete conversations you no longer need.
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="sources">
                  <AccordionTrigger>Using Sources</AccordionTrigger>
                  <AccordionContent className="text-sm text-muted-foreground">
                    Connect documents from your Repository or enable web search to provide additional context to the AI. This helps generate more accurate and relevant responses based on your specific documents and current information.
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </CardContent>
          </Card>

          {/* FAQs */}
          <Card>
            <CardHeader>
              <CardTitle>Frequently Asked Questions</CardTitle>
            </CardHeader>
            <CardContent>
              <Accordion type="single" collapsible className="w-full">
                <AccordionItem value="security">
                  <AccordionTrigger>Is my data secure?</AccordionTrigger>
                  <AccordionContent className="text-sm text-muted-foreground">
                    Yes. All documents and conversations are encrypted and stored securely. Data is segregated by organization, and only members of your organization can access your documents and conversations.
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="formats">
                  <AccordionTrigger>What file formats are supported?</AccordionTrigger>
                  <AccordionContent className="text-sm text-muted-foreground">
                    Currently, we support PDF, DOCX (Microsoft Word), and TXT (plain text) files. More formats will be added in future updates.
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="limits">
                  <AccordionTrigger>Are there any usage limits?</AccordionTrigger>
                  <AccordionContent className="text-sm text-muted-foreground">
                    File size is limited to 20MB per document. There are no limits on the number of conversations or messages you can have.
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="sharing">
                  <AccordionTrigger>Can I share documents with other organizations?</AccordionTrigger>
                  <AccordionContent className="text-sm text-muted-foreground">
                    No. For security reasons, documents and conversations are isolated to your organization only. This ensures client confidentiality and data privacy.
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </CardContent>
          </Card>

          {/* Contact Support */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Mail className="w-5 h-5" />
                <CardTitle>Contact Support</CardTitle>
              </div>
              <CardDescription>Reach out to the Office of Legal Innovation</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground mb-4">
                For technical assistance, questions, or support, please contact:
              </p>
              
              <div className="space-y-3">
                <Button variant="outline" className="w-full justify-start" asChild>
                  <a href="mailto:officeofinnovation@brieflylegal.com">
                    <Mail className="w-4 h-4 mr-2" />
                    Office of Legal Innovation
                  </a>
                </Button>
                
                <Button variant="outline" className="w-full justify-start" asChild>
                  <a href="mailto:aavadhani@brieflylegal.com">
                    <Mail className="w-4 h-4 mr-2" />
                    Ankita Avadhani
                  </a>
                </Button>
                
                <Button variant="outline" className="w-full justify-start" asChild>
                  <a href="mailto:mgoyal@brieflylegal.com">
                    <Mail className="w-4 h-4 mr-2" />
                    Monica Goyal
                  </a>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
