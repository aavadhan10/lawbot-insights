import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/contexts/OrganizationContext";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { FileText, Trash2, File, PlusCircle, History } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { DraftVersionHistory } from "./DraftVersionHistory";

interface Draft {
  id: string;
  title: string;
  document_type: string;
  created_at: string;
  updated_at: string;
  current_version: number;
  conversation_id?: string;
}

interface DraftsListProps {
  onSelectDraft: (draftId: string, conversationId?: string) => void;
  selectedDraftId?: string;
  onRestoreVersion?: (content: any) => void;
}

export const DraftsList = ({ onSelectDraft, selectedDraftId, onRestoreVersion }: DraftsListProps) => {
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [loading, setLoading] = useState(true);
  const { userRole } = useOrganization();

  useEffect(() => {
    loadDrafts();
  }, [userRole]);

  const loadDrafts = async () => {
    if (!userRole?.organization.id) return;

    try {
      const { data, error } = await supabase
        .from('document_drafts')
        .select('id, title, document_type, created_at, updated_at, current_version, conversation_id')
        .eq('organization_id', userRole.organization.id)
        .order('updated_at', { ascending: false });

      if (error) throw error;
      setDrafts(data || []);
    } catch (error) {
      console.error('Error loading drafts:', error);
      toast.error('Failed to load drafts');
    } finally {
      setLoading(false);
    }
  };

  const deleteDraft = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const { error } = await supabase
        .from('document_drafts')
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast.success('Draft deleted');
      loadDrafts();
    } catch (error) {
      console.error('Error deleting draft:', error);
      toast.error('Failed to delete draft');
    }
  };

  const createNewDocument = async () => {
    if (!userRole?.organization.id) return;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    try {
      const timestamp = new Date().toLocaleString();
      const { data, error } = await supabase
        .from('document_drafts')
        .insert({
          title: `Untitled Document - ${timestamp}`,
          document_type: 'General',
          content: { text: '', changes: [] },
          user_id: user.id,
          organization_id: userRole.organization.id,
          current_version: 1,
          status: 'draft'
        })
        .select()
        .single();

      if (error) throw error;
      
      toast.success('New document created');
      loadDrafts();
      onSelectDraft(data.id);
    } catch (error) {
      console.error('Error creating document:', error);
      toast.error('Failed to create document');
    }
  };

  const templateContent: { [key: string]: string } = {
    't1': `LEGAL AGREEMENT

This Agreement ("Agreement") is entered into as of [Date] ("Effective Date") by and between:

Party A: [Full Legal Name]
Address: [Complete Address]

AND

Party B: [Full Legal Name]
Address: [Complete Address]

WHEREAS, the parties wish to establish the terms and conditions governing [purpose];

NOW, THEREFORE, in consideration of the mutual covenants and agreements herein contained, the parties agree as follows:

1. DEFINITIONS
   1.1 "Agreement" means this legal agreement including all schedules and amendments.
   1.2 [Additional definitions as needed]

2. SCOPE OF AGREEMENT
   2.1 This Agreement shall govern the relationship between the parties with respect to [specify scope].

3. OBLIGATIONS OF PARTIES
   3.1 Party A shall: [List obligations]
   3.2 Party B shall: [List obligations]

4. TERM AND TERMINATION
   4.1 This Agreement shall commence on the Effective Date and continue for [duration].
   4.2 Either party may terminate this Agreement upon [notice period] written notice.

5. GOVERNING LAW
   This Agreement shall be governed by and construed in accordance with the laws of [Jurisdiction].

IN WITNESS WHEREOF, the parties have executed this Agreement as of the date first written above.

_______________________          _______________________
[Party A Name]                   [Party B Name]
[Title]                          [Title]
Date: _______________            Date: _______________`,

    't2': `BUSINESS CONTRACT

Contract Date: [Date]
Contract Number: [Number]

BETWEEN:
Company Name: [Legal Business Name]
Registered Address: [Complete Address]
Representative: [Name and Title]

AND:
Company Name: [Legal Business Name]
Registered Address: [Complete Address]
Representative: [Name and Title]

BACKGROUND:
The parties wish to enter into a business relationship for [describe purpose and objectives].

AGREED TERMS:

1. SERVICES/PRODUCTS
   1.1 [Company A] agrees to provide: [Detailed description]
   1.2 Specifications: [Technical or service specifications]

2. PAYMENT TERMS
   2.1 Total Contract Value: $[Amount]
   2.2 Payment Schedule: [Detailed payment terms]
   2.3 Late Payment: Interest at [rate]% per annum

3. DELIVERY/PERFORMANCE
   3.1 Delivery Date: [Date]
   3.2 Location: [Address]
   3.3 Performance Standards: [Specifications]

4. WARRANTIES
   4.1 [Company A] warrants that: [List warranties]
   4.2 Warranty Period: [Duration]

5. LIABILITY
   5.1 Limitation of Liability: [Terms]
   5.2 Indemnification: [Terms]

6. INTELLECTUAL PROPERTY
   6.1 Ownership: [Specify IP ownership terms]

7. CONFIDENTIALITY
   7.1 Both parties agree to maintain confidentiality of proprietary information.

8. DISPUTE RESOLUTION
   8.1 Disputes shall be resolved through [mediation/arbitration/litigation]

9. GENERAL PROVISIONS
   9.1 Entire Agreement
   9.2 Amendment Process
   9.3 Force Majeure

Executed by the authorized representatives:

For [Company A]:                 For [Company B]:
_______________________          _______________________
Signature                        Signature
Name: [Print Name]               Name: [Print Name]
Title: [Title]                   Title: [Title]
Date: _______________            Date: _______________`,

    't3': `NON-DISCLOSURE AGREEMENT (NDA)

This Non-Disclosure Agreement ("Agreement") is made effective as of [Date] ("Effective Date")

BETWEEN:
Disclosing Party: [Full Name/Company Name]
Address: [Complete Address]

AND:
Receiving Party: [Full Name/Company Name]
Address: [Complete Address]

RECITALS:
WHEREAS, the Disclosing Party possesses certain confidential and proprietary information;
WHEREAS, the Receiving Party desires to receive such information for the purpose of [state purpose];

NOW, THEREFORE, the parties agree as follows:

1. DEFINITION OF CONFIDENTIAL INFORMATION
   1.1 "Confidential Information" means any information disclosed by the Disclosing Party to the Receiving Party, including but not limited to:
       • Business plans and strategies
       • Financial information
       • Technical data and know-how
       • Customer lists and information
       • Marketing plans
       • Trade secrets
       • Proprietary software or technology

2. OBLIGATIONS OF RECEIVING PARTY
   2.1 The Receiving Party agrees to:
       a) Hold all Confidential Information in strict confidence
       b) Not disclose Confidential Information to any third party
       c) Use Confidential Information solely for [stated purpose]
       d) Protect Confidential Information with the same degree of care as its own confidential information

3. EXCLUSIONS
   Information shall not be considered Confidential if it:
   3.1 Was publicly known at the time of disclosure
   3.2 Becomes publicly known through no breach by Receiving Party
   3.3 Was rightfully in Receiving Party's possession prior to disclosure
   3.4 Is required to be disclosed by law or court order

4. TERM
   4.1 This Agreement shall commence on the Effective Date and continue for [duration] years.
   4.2 Obligations regarding Confidential Information shall survive termination for [duration] years.

5. RETURN OF MATERIALS
   5.1 Upon termination or request, Receiving Party shall return or destroy all Confidential Information.

6. REMEDIES
   6.1 The parties acknowledge that breach may cause irreparable harm and that injunctive relief may be appropriate.

7. GOVERNING LAW
   7.1 This Agreement shall be governed by the laws of [Jurisdiction].

AGREED AND ACCEPTED:

Disclosing Party:                Receiving Party:
_______________________          _______________________
Signature                        Signature
Name: [Print Name]               Name: [Print Name]
Title: [Title]                   Title: [Title]
Date: _______________            Date: _______________`,

    't4': `SERVICE AGREEMENT

Service Agreement Number: [Number]
Date: [Date]

This Service Agreement ("Agreement") is entered into between:

SERVICE PROVIDER:
Company/Individual Name: [Legal Name]
Address: [Complete Address]
Contact: [Phone/Email]

CLIENT:
Company/Individual Name: [Legal Name]
Address: [Complete Address]
Contact: [Phone/Email]

1. SERVICES TO BE PROVIDED
   1.1 The Service Provider agrees to provide the following services:
       • [Service 1]: [Detailed description]
       • [Service 2]: [Detailed description]
       • [Service 3]: [Detailed description]
   
   1.2 Scope of Work:
       [Detailed description of deliverables and expectations]

2. SERVICE PERIOD
   2.1 Commencement Date: [Date]
   2.2 Completion Date: [Date]
   2.3 Service Hours: [Specify hours or schedule]

3. COMPENSATION
   3.1 Service Fees:
       • Total Fee: $[Amount]
       • Payment Structure: [Hourly/Fixed/Milestone-based]
       • Rate: $[Amount] per [hour/project/month]
   
   3.2 Payment Schedule:
       • Initial Payment: $[Amount] due [when]
       • Progress Payments: [Details]
       • Final Payment: $[Amount] due [when]
   
   3.3 Additional Costs:
       • Expenses: [Policy on reimbursable expenses]

4. PERFORMANCE STANDARDS
   4.1 The Service Provider shall:
       • Perform services in a professional and workmanlike manner
       • Meet industry standards
       • Complete services according to agreed timeline
       • Provide regular progress updates

5. CLIENT RESPONSIBILITIES
   5.1 The Client shall:
       • Provide necessary information and access
       • Make timely decisions
       • Review and approve deliverables promptly
       • Make payments according to schedule

6. INTELLECTUAL PROPERTY
   6.1 Ownership: [Specify who owns work product]
   6.2 License: [Specify any licenses granted]

7. CONFIDENTIALITY
   7.1 Both parties agree to protect confidential information disclosed during the service period.

8. TERMINATION
   8.1 Either party may terminate this Agreement with [number] days written notice.
   8.2 Upon termination, Client shall pay for services rendered up to termination date.

9. WARRANTIES AND LIABILITY
   9.1 Service Provider warrants services will be performed professionally.
   9.2 Liability is limited to fees paid under this Agreement.

10. INDEPENDENT CONTRACTOR
    10.1 Service Provider is an independent contractor, not an employee.

11. DISPUTE RESOLUTION
    11.1 Disputes shall be resolved through [mediation/arbitration] in [location].

12. GENERAL PROVISIONS
    12.1 Entire Agreement: This represents the complete agreement.
    12.2 Amendments: Must be in writing and signed by both parties.
    12.3 Governing Law: [Jurisdiction]

SIGNATURES:

Service Provider:                Client:
_______________________          _______________________
Signature                        Signature
Name: [Print Name]               Name: [Print Name]
Title: [Title]                   Title: [Title]
Date: _______________            Date: _______________`
  };

  const loadTemplate = async (templateId: string, templateTitle: string, templateType: string) => {
    if (!userRole?.organization.id) return;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    try {
      const content = templateContent[templateId] || '';
      const { data, error } = await supabase
        .from('document_drafts')
        .insert({
          title: templateTitle,
          document_type: templateType,
          content: { text: content, changes: [] },
          user_id: user.id,
          organization_id: userRole.organization.id,
          current_version: 1,
          status: 'draft'
        })
        .select()
        .single();

      if (error) throw error;
      
      toast.success(`${templateTitle} loaded`);
      loadDrafts();
      onSelectDraft(data.id);
    } catch (error) {
      console.error('Error loading template:', error);
      toast.error('Failed to load template');
    }
  };

  if (loading) {
    return <div className="p-4 text-sm text-muted-foreground">Loading drafts...</div>;
  }

  return (
    <div className="h-full flex flex-col border-r bg-background">
      <div className="p-4 border-b space-y-3">
        <h2 className="text-lg font-semibold">Documents</h2>
        <Button 
          onClick={createNewDocument}
          className="w-full"
          variant="default"
        >
          <PlusCircle className="h-4 w-4 mr-2" />
          New Document
        </Button>
      </div>
      
      <Tabs defaultValue="drafts" className="flex-1 flex flex-col">
        <TabsList className="mx-4 mt-2 grid w-auto grid-cols-2">
          <TabsTrigger value="drafts" className="text-xs">
            <FileText className="h-3.5 w-3.5 mr-1.5" />
            Drafts
          </TabsTrigger>
          <TabsTrigger value="templates" className="text-xs">
            <File className="h-3.5 w-3.5 mr-1.5" />
            Templates
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="drafts" className="flex-1 mt-0 overflow-hidden">
          <ScrollArea className="h-full">
            <div className="p-4 space-y-2">
              {loading ? (
                <p className="text-sm text-muted-foreground">Loading drafts...</p>
              ) : drafts.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <FileText className="h-12 w-12 text-muted-foreground/40 mb-3" />
                  <p className="text-sm font-medium text-foreground mb-1">No drafts yet</p>
                  <p className="text-xs text-muted-foreground">Start a conversation to create your first draft</p>
                </div>
              ) : (
                drafts.map((draft) => (
                  <div
                    key={draft.id}
                    onClick={() => onSelectDraft(draft.id, draft.conversation_id)}
                    className={`
                      p-3 rounded-lg cursor-pointer transition-all
                      ${selectedDraftId === draft.id 
                        ? 'bg-primary/10 border-2 border-primary shadow-sm' 
                        : 'hover:bg-accent border-2 border-transparent'
                      }
                    `}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-start gap-2 flex-1 min-w-0">
                        <FileText className="h-4 w-4 mt-0.5 flex-shrink-0 text-primary" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{draft.title}</p>
                          <p className="text-xs text-muted-foreground">
                            {draft.document_type} • v{draft.current_version}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {formatDistanceToNow(new Date(draft.updated_at), { addSuffix: true })}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        {selectedDraftId === draft.id && onRestoreVersion && (
                          <Sheet>
                            <SheetTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 flex-shrink-0"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <History className="h-3 w-3" />
                              </Button>
                            </SheetTrigger>
                            <SheetContent className="w-96 bg-background/95 backdrop-blur-xl border-l shadow-2xl">
                              <SheetHeader>
                                <SheetTitle>Version History</SheetTitle>
                                <SheetDescription>
                                  View and restore previous versions of this document
                                </SheetDescription>
                              </SheetHeader>
                              <div className="mt-6">
                                <DraftVersionHistory 
                                  draftId={draft.id} 
                                  onRestoreVersion={onRestoreVersion}
                                />
                              </div>
                            </SheetContent>
                          </Sheet>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 flex-shrink-0 hover:bg-destructive/10 hover:text-destructive"
                          onClick={(e) => deleteDraft(draft.id, e)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        </TabsContent>
        
        <TabsContent value="templates" className="flex-1 mt-0 overflow-hidden">
          <ScrollArea className="h-full">
            <div className="p-4 space-y-2">
              {[
                {
                  id: 't1',
                  title: 'Legal Agreement',
                  description: 'Standard legal agreement template',
                  type: 'Legal'
                },
                {
                  id: 't2',
                  title: 'Business Contract',
                  description: 'General business contract template',
                  type: 'Business'
                },
                {
                  id: 't3',
                  title: 'Non-Disclosure Agreement',
                  description: 'Standard NDA template',
                  type: 'Legal'
                },
                {
                  id: 't4',
                  title: 'Service Agreement',
                  description: 'Service provider agreement template',
                  type: 'Business'
                },
              ].map((template) => (
                <div
                  key={template.id}
                  className="p-3 rounded-lg cursor-pointer transition-all hover:bg-accent border-2 border-transparent hover:border-primary/50"
                  onClick={() => loadTemplate(template.id, template.title, template.type)}
                >
                  <div className="flex items-start gap-2">
                    <File className="h-4 w-4 mt-0.5 flex-shrink-0 text-primary" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{template.title}</p>
                      <p className="text-xs text-muted-foreground">{template.type}</p>
                      <p className="text-xs text-muted-foreground mt-1">{template.description}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </TabsContent>
      </Tabs>
    </div>
  );
};
