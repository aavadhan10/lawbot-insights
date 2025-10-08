import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      return new Response(
        JSON.stringify({ error: 'No file provided' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const fileName = file.name.toLowerCase();
    let extractedText = '';

    if (fileName.endsWith('.txt')) {
      extractedText = await file.text();
    } else if (fileName.endsWith('.csv')) {
      extractedText = await file.text();
    } else if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
      // Handle Excel files
      try {
        const arrayBuffer = await file.arrayBuffer();
        const XLSX = (await import("https://cdn.sheetjs.com/xlsx-0.20.3/package/xlsx.mjs")).default;
        
        const workbook = XLSX.read(arrayBuffer, { type: 'array' });
        
        // Extract text from all sheets
        const sheetsText: string[] = [];
        workbook.SheetNames.forEach(sheetName => {
          const worksheet = workbook.Sheets[sheetName];
          // Convert to CSV format for plain text extraction
          const csvText = XLSX.utils.sheet_to_csv(worksheet);
          if (csvText.trim().length > 0) {
            sheetsText.push(`\n=== Sheet: ${sheetName} ===\n${csvText}`);
          }
        });
        
        extractedText = sheetsText.join('\n\n');
        
        if (!extractedText || extractedText.trim().length === 0) {
          extractedText = `Document: ${file.name}\n\nNote: This Excel file appears to be empty or contains no readable data.`;
        } else {
          console.log(`Successfully extracted ${extractedText.length} characters from ${workbook.SheetNames.length} sheet(s)`);
        }
      } catch (xlsxError) {
        console.error('Excel parsing error:', xlsxError);
        extractedText = `Document: ${file.name}\n\nError: Could not parse Excel file. ${xlsxError instanceof Error ? xlsxError.message : 'Unknown error'}`;
      }
    } else if (fileName.endsWith('.pdf')) {
      // Use unpdf - designed for edge/serverless environments
      try {
        const { extractText } = await import("https://esm.sh/unpdf@0.11.0");
        
        const arrayBuffer = await file.arrayBuffer();
        const { text, totalPages } = await extractText(new Uint8Array(arrayBuffer));
        
        extractedText = Array.isArray(text) ? text.join('\n\n') : text;
        
        if (!extractedText || extractedText.trim().length === 0) {
          extractedText = `Document: ${file.name}\nPages: ${totalPages}\n\nNote: This PDF may contain only images or be scanned. No text could be extracted.`;
        } else {
          console.log(`Successfully extracted ${extractedText.length} characters from ${totalPages} pages`);
        }
      } catch (pdfError) {
        console.error('PDF parsing error:', pdfError);
        extractedText = `Document: ${file.name}\n\nError: Could not parse PDF. ${pdfError instanceof Error ? pdfError.message : 'Unknown error'}`;
      }
    } else if (fileName.endsWith('.docx')) {
      // For DOCX files, use proper ZIP extraction
      try {
        const arrayBuffer = await file.arrayBuffer();
        const uint8Array = new Uint8Array(arrayBuffer);
        
        // Import JSZip for proper DOCX handling
        const JSZip = (await import("https://esm.sh/jszip@3.10.1")).default;
        const zip = await JSZip.loadAsync(uint8Array);
        
        // Extract document.xml which contains the main content
        const documentXml = await zip.file("word/document.xml")?.async("string");
        
        if (documentXml) {
          // Extract text from XML tags
          const textMatches = documentXml.match(/<w:t[^>]*>([^<]+)<\/w:t>/g);
          if (textMatches) {
            extractedText = textMatches
              .map(match => match.replace(/<[^>]+>/g, ''))
              .join(' ')
              .replace(/\s+/g, ' ')
              .trim();
          }
        }
        
        if (!extractedText || extractedText.trim().length === 0) {
          extractedText = `Document: ${file.name}\n\nNote: This DOCX document structure could not be parsed or contains no text.`;
        } else {
          console.log(`Successfully extracted ${extractedText.length} characters from DOCX`);
        }
      } catch (docxError) {
        console.error('DOCX parsing error:', docxError);
        extractedText = `Document: ${file.name}\n\nError: Could not parse DOCX. ${docxError instanceof Error ? docxError.message : 'Unknown error'}`;
      }
    } else {
      return new Response(
        JSON.stringify({ error: 'Unsupported file type. Please upload PDF, DOCX, XLSX, XLS, CSV, or TXT files.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Successfully parsed ${file.name}, extracted ${extractedText.length} characters`);

    return new Response(
      JSON.stringify({ text: extractedText, fileName: file.name }),
      { 
        status: 200,
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        } 
      }
    );
  } catch (error) {
    console.error('Error parsing document:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Failed to parse document' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
