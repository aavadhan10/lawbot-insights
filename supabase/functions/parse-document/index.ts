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

  const startTime = Date.now();
  
  try {
    console.log('Parse document function invoked');
    
    const formData = await req.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      console.error('No file provided in request');
      return new Response(
        JSON.stringify({ error: 'No file provided' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Processing file: ${file.name}, size: ${file.size} bytes, type: ${file.type}`);

    const fileName = file.name.toLowerCase();
    let extractedText = '';

    // File size validation (20MB limit)
    const MAX_FILE_SIZE = 20 * 1024 * 1024;
    if (file.size > MAX_FILE_SIZE) {
      console.error(`File too large: ${file.size} bytes`);
      return new Response(
        JSON.stringify({ error: 'File size exceeds 20MB limit. Please upload a smaller file.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (fileName.endsWith('.txt')) {
      console.log('Processing TXT file');
      extractedText = await file.text();
    } else if (fileName.endsWith('.csv')) {
      console.log('Processing CSV file');
      extractedText = await file.text();
    } else if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
      console.log('Excel file detected - not supported');
      return new Response(
        JSON.stringify({ 
          error: 'Excel files are not currently supported. Please convert your Excel file to CSV format first:\n\n1. Open the file in Excel/Google Sheets\n2. Click File → Save As (or Download)\n3. Choose "CSV" as the file type\n4. Upload the CSV file here\n\nNote: CSV format preserves your data while being easier to process.' 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } else if (fileName.endsWith('.pdf')) {
      console.log('Processing PDF file');
      // Use unpdf - designed for edge/serverless environments
      try {
        const { extractText } = await import("https://esm.sh/unpdf@0.11.0");
        
        console.log('Converting PDF to array buffer...');
        const arrayBuffer = await file.arrayBuffer();
        console.log(`Array buffer size: ${arrayBuffer.byteLength} bytes`);
        
        console.log('Extracting text from PDF...');
        const { text, totalPages } = await extractText(new Uint8Array(arrayBuffer));
        console.log(`PDF has ${totalPages} pages`);
        
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
      console.log('Processing DOCX file');
      // For DOCX files, use proper ZIP extraction
      try {
        console.log('Converting DOCX to array buffer...');
        const arrayBuffer = await file.arrayBuffer();
        const uint8Array = new Uint8Array(arrayBuffer);
        console.log(`DOCX buffer size: ${uint8Array.length} bytes`);
        
        // Import JSZip for proper DOCX handling
        console.log('Loading JSZip library...');
        const JSZip = (await import("https://esm.sh/jszip@3.10.1")).default;
        console.log('Parsing DOCX as ZIP archive...');
        const zip = await JSZip.loadAsync(uint8Array);
        
        // Extract document.xml which contains the main content
        console.log('Extracting document.xml from DOCX...');
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
        JSON.stringify({ error: 'Unsupported file type. Please upload PDF, DOCX, CSV, or TXT files.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const processingTime = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`Successfully parsed ${file.name} in ${processingTime}s, extracted ${extractedText.length} characters`);

    return new Response(
      JSON.stringify({ 
        text: extractedText, 
        fileName: file.name,
        processingTime: processingTime,
        characterCount: extractedText.length
      }),
      { 
        status: 200,
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        } 
      }
    );
  } catch (error) {
    const processingTime = ((Date.now() - startTime) / 1000).toFixed(2);
    console.error(`Error parsing document after ${processingTime}s:`, error);
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Failed to parse document',
        details: error instanceof Error ? error.stack : undefined,
        processingTime: processingTime
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
