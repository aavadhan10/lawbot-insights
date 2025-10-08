/**
 * Intelligently replaces placeholders in prompt templates with contextual values
 */

interface Document {
  filename?: string;
  file_type?: string;
  metadata?: any;
}

export const replacePlaceholders = (template: string, documents: Document[] = []): string => {
  let result = template;

  // Extract document type from first document
  const getDocumentType = (): string => {
    if (documents.length === 0) return "document";
    
    const firstDoc = documents[0];
    const filename = firstDoc.filename || "";
    
    // Try to infer from filename
    if (/contract/i.test(filename)) return "contract";
    if (/agreement/i.test(filename)) return "agreement";
    if (/memo/i.test(filename)) return "memo";
    if (/report/i.test(filename)) return "report";
    if (/brief/i.test(filename)) return "brief";
    if (/filing/i.test(filename)) return "filing";
    if (/statement/i.test(filename)) return "statement";
    if (/disclosure/i.test(filename)) return "disclosure";
    if (/amendment/i.test(filename)) return "amendment";
    
    // Fallback to file type or generic
    return firstDoc.file_type === "pdf" ? "PDF document" : "document";
  };

  // Get company name from filename or use generic
  const getCompanyName = (): string => {
    if (documents.length === 0) return "the company";
    
    const filename = documents[0].filename || "";
    // Extract potential company name (usually at start before underscore or space)
    const match = filename.match(/^([A-Z][a-zA-Z\s&\.]+?)(?:_|\d|\.)/);
    return match ? match[1].trim() : "the company";
  };

  // Get ticker if present
  const getTicker = (): string => {
    if (documents.length === 0) return "TICKER";
    
    const filename = documents[0].filename || "";
    const match = filename.match(/\b([A-Z]{2,5})\b/);
    return match ? match[1] : "TICKER";
  };

  // Get year range
  const getYears = (): string => {
    const currentYear = new Date().getFullYear();
    return `${currentYear - 2}-${currentYear}`;
  };

  // Replace all placeholders
  result = result.replace(/\[\[\[DOCUMENT_TYPE\]\]\]/g, getDocumentType());
  result = result.replace(/\[\[\[DOCUMENT\(S\)\]\]\]/g, documents.length > 1 ? "documents" : "document");
  result = result.replace(/\[\[\[NUMBER\]\]\]/g, "5");
  result = result.replace(/\[\[\[COMPANY\]\]\]/g, getCompanyName());
  result = result.replace(/\[\[\[COMPANY_TICKER\]\]\]/g, getTicker());
  result = result.replace(/\[\[\[YEARS\]\]\]/g, getYears());
  result = result.replace(/\[\[\[RISK\]\]\]/g, "market volatility");
  result = result.replace(/\[\[\[FORMAT \/ STYLE \/ LENGTH\]\]\]/g, "a clear, concise summary");
  result = result.replace(/\[\[\[TOPIC\(S\)\]\]\]/g, "key provisions and obligations");
  result = result.replace(/\[\[\[WITNESS\]\]\]/g, "the witness");
  result = result.replace(/\[\[\[the \/ each\]\]\]/g, documents.length > 1 ? "each" : "the");
  result = result.replace(/\[\[\[TOPIC\]\]\]/g, "liability");
  result = result.replace(/\[\[\[DATA_TYPE\]\]\]/g, "financial transactions");
  result = result.replace(/\[\[\[DATA_POINTS\]\]\]/g, "dates, parties, and amounts");
  result = result.replace(/\[\[\[TASK_TYPE\]\]\]/g, "due diligence review");
  result = result.replace(/\[\[\[REGULATION\/STANDARD\]\]\]/g, "applicable regulations");
  result = result.replace(/\[\[\[COLUMNS\]\]\]/g, "Date, Description, Amount, Status");

  return result;
};
