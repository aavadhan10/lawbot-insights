export interface PromptTemplate {
  id: string;
  title: string;
  category: string;
  template: string;
  placeholders: string[];
}

export const promptLibrary: PromptTemplate[] = [
  {
    id: "summarize-counter",
    title: "Summarize & Counter-Arguments",
    category: "Analysis",
    template: "First, summarize this [[[DOCUMENT_TYPE]]] in a single detailed paragraph.\n\nSecond, generate [[[NUMBER]]] counter-arguments, weaknesses, contradictions, gaps, logical reasoning and other flaws, ranked in order from most serious to least serious.",
    placeholders: ["DOCUMENT_TYPE", "NUMBER"]
  },
  {
    id: "risk-factors",
    title: "Risk Factor Analysis",
    category: "Corporate",
    template: "First, create a list of ten risk factors that [[[COMPANY]]] ([[[COMPANY_TICKER]]]) has disclosed in their [[[YEARS]]] annual reports regarding [[[RISK]]].\n\nSecond, based on that list of examples, draft a new risk factor that can be disclosed in an annual filing for [[[COMPANY]]] regarding [[[RISK]]].",
    placeholders: ["COMPANY", "COMPANY_TICKER", "YEARS", "RISK"]
  },
  {
    id: "focused-summary",
    title: "Focused Summary",
    category: "Analysis",
    template: "Summarize this [[[DOCUMENT_TYPE]]] in [[[FORMAT / STYLE / LENGTH]]] focusing on [[[TOPIC(S)]]].",
    placeholders: ["DOCUMENT_TYPE", "FORMAT / STYLE / LENGTH", "TOPIC(S)"]
  },
  {
    id: "client-memo",
    title: "Client Memo",
    category: "Drafting",
    template: "Prepare a memo on behalf of a lawyer to their client summarizing this [[[DOCUMENT_TYPE]]]. Use subheadings to organize the memo's paragraphs. At the beginning of the memo, highlight the most critical information in an executive summary.",
    placeholders: ["DOCUMENT_TYPE"]
  },
  {
    id: "witness-statements",
    title: "Witness Statement Analysis",
    category: "Litigation",
    template: "Identify statements by [[[WITNESS]]] in [[[the / each]]] [[[DOCUMENT(S)]]] supporting the claim that [[[TOPIC]]].",
    placeholders: ["WITNESS", "the / each", "DOCUMENT(S)", "TOPIC"]
  },
  {
    id: "csv-analysis",
    title: "CSV/Data File Analysis",
    category: "Back Office",
    template: "Analyze this CSV or data file and provide key insights about [[[DATA_TYPE]]]. Include trends, patterns, anomalies, and a summary of the most important findings.",
    placeholders: ["DATA_TYPE"]
  },
  {
    id: "document-comparison",
    title: "Document Comparison",
    category: "Back Office",
    template: "Compare these two [[[DOCUMENT_TYPE]]] documents and highlight the key differences, additions, deletions, and modifications. Present the findings in a clear, organized format.",
    placeholders: ["DOCUMENT_TYPE"]
  },
  {
    id: "data-extraction",
    title: "Data Extraction & Table Creation",
    category: "Back Office",
    template: "Extract all [[[DATA_POINTS]]] from this document and format them as a structured table with clear headers. Include any relevant context or notes.",
    placeholders: ["DATA_POINTS"]
  },
  {
    id: "checklist-generation",
    title: "Task Checklist Generation",
    category: "Back Office",
    template: "Create a detailed checklist for [[[TASK_TYPE]]] based on this document. Include all necessary steps, deadlines (if mentioned), and requirements.",
    placeholders: ["TASK_TYPE"]
  },
  {
    id: "compliance-review",
    title: "Compliance Review",
    category: "Back Office",
    template: "Review this [[[DOCUMENT_TYPE]]] for compliance with [[[REGULATION/STANDARD]]]. Identify any areas of non-compliance, gaps, or recommendations for improvement.",
    placeholders: ["DOCUMENT_TYPE", "REGULATION/STANDARD"]
  },
  {
    id: "key-terms-extraction",
    title: "Legal Terms Glossary",
    category: "Back Office",
    template: "Identify and define all key legal terms, jargon, and technical language in this [[[DOCUMENT_TYPE]]]. Present them in alphabetical order with clear, plain-language definitions.",
    placeholders: ["DOCUMENT_TYPE"]
  },
  {
    id: "data-summary-table",
    title: "Summary Table Creation",
    category: "Back Office",
    template: "Create a comprehensive summary table of [[[DATA_TYPE]]] showing the following columns: [[[COLUMNS]]]. Organize the data logically and ensure all relevant information is captured.",
    placeholders: ["DATA_TYPE", "COLUMNS"]
  },
  {
    id: "deadline-tracker",
    title: "Deadline & Timeline Extraction",
    category: "Back Office",
    template: "Extract all deadlines, dates, and time-sensitive information from this [[[DOCUMENT_TYPE]]]. Create a chronological timeline or calendar of events with descriptions.",
    placeholders: ["DOCUMENT_TYPE"]
  }
];
