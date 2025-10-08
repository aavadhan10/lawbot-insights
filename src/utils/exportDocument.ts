import { Document, Paragraph, TextRun, HeadingLevel, AlignmentType, Packer } from 'docx';
import jsPDF from 'jspdf';

export const exportToTxt = (content: string, title: string) => {
  // Strip HTML tags for plain text
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = content;
  const plainText = tempDiv.textContent || tempDiv.innerText || '';
  
  const blob = new Blob([plainText], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${title}.txt`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

export const exportToDocx = async (content: string, title: string) => {
  // Parse HTML content to extract text and formatting
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = content;
  
  const children: Paragraph[] = [];
  
  // Process each element
  tempDiv.childNodes.forEach((node) => {
    if (node.nodeName === 'H1') {
      children.push(new Paragraph({
        text: node.textContent || '',
        heading: HeadingLevel.HEADING_1,
      }));
    } else if (node.nodeName === 'H2') {
      children.push(new Paragraph({
        text: node.textContent || '',
        heading: HeadingLevel.HEADING_2,
      }));
    } else if (node.nodeName === 'H3') {
      children.push(new Paragraph({
        text: node.textContent || '',
        heading: HeadingLevel.HEADING_3,
      }));
    } else if (node.nodeName === 'P') {
      const runs: TextRun[] = [];
      const processNode = (n: Node) => {
        if (n.nodeType === Node.TEXT_NODE) {
          runs.push(new TextRun(n.textContent || ''));
        } else if (n.nodeName === 'STRONG' || n.nodeName === 'B') {
          runs.push(new TextRun({ text: n.textContent || '', bold: true }));
        } else if (n.nodeName === 'EM' || n.nodeName === 'I') {
          runs.push(new TextRun({ text: n.textContent || '', italics: true }));
        } else if (n.nodeName === 'U') {
          runs.push(new TextRun({ text: n.textContent || '', underline: {} }));
        } else {
          n.childNodes.forEach(processNode);
        }
      };
      node.childNodes.forEach(processNode);
      children.push(new Paragraph({ children: runs }));
    } else if (node.nodeName === 'UL' || node.nodeName === 'OL') {
      node.childNodes.forEach((li) => {
        if (li.nodeName === 'LI') {
          children.push(new Paragraph({
            text: li.textContent || '',
            bullet: node.nodeName === 'UL' ? { level: 0 } : undefined,
            numbering: node.nodeName === 'OL' ? { reference: 'default-numbering', level: 0 } : undefined,
          }));
        }
      });
    }
  });

  const doc = new Document({
    sections: [{
      children: children.length > 0 ? children : [new Paragraph({ text: tempDiv.textContent || '' })],
    }],
  });

  const blob = await Packer.toBlob(doc);
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${title}.docx`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

export const exportToPdf = (content: string, title: string) => {
  const doc = new jsPDF();
  
  // Strip HTML and format for PDF
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = content;
  const text = tempDiv.textContent || tempDiv.innerText || '';
  
  // Split text into lines that fit the page width
  const lines = doc.splitTextToSize(text, 180);
  
  // Add title
  doc.setFontSize(16);
  doc.text(title, 15, 15);
  
  // Add content
  doc.setFontSize(12);
  doc.text(lines, 15, 30);
  
  doc.save(`${title}.pdf`);
};
