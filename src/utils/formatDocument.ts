/**
 * Converts plain text or markdown-style content to properly formatted HTML
 */
export const formatDocumentContent = (content: string): string => {
  if (!content) return '';
  
  // If content already looks like HTML, return as is
  if (content.trim().startsWith('<') && content.includes('</')) {
    return content;
  }

  let formatted = content;

  // Convert markdown-style headings first (before bold conversion)
  formatted = formatted.replace(/^### (.+)$/gm, '<h3>$1</h3>');
  formatted = formatted.replace(/^## (.+)$/gm, '<h2>$1</h2>');
  formatted = formatted.replace(/^# (.+)$/gm, '<h1>$1</h1>');

  // Convert markdown-style bold (**text**)
  formatted = formatted.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  
  // Convert markdown-style italic (*text*)
  formatted = formatted.replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g, '<em>$1</em>');

  // Split into lines for list processing
  const lines = formatted.split('\n');
  const processedLines: string[] = [];
  let inBulletList = false;
  let inNumberedList = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    // Skip empty lines
    if (!line) {
      if (inBulletList) {
        processedLines.push('</ul>');
        inBulletList = false;
      }
      if (inNumberedList) {
        processedLines.push('</ol>');
        inNumberedList = false;
      }
      processedLines.push('');
      continue;
    }

    // Check for bullet points
    const bulletMatch = line.match(/^[•\-\*]\s+(.+)$/);
    if (bulletMatch) {
      if (!inBulletList) {
        if (inNumberedList) {
          processedLines.push('</ol>');
          inNumberedList = false;
        }
        processedLines.push('<ul>');
        inBulletList = true;
      }
      processedLines.push(`<li>${bulletMatch[1]}</li>`);
      continue;
    }

    // Check for numbered lists
    const numberedMatch = line.match(/^\d+\.\s+(.+)$/);
    if (numberedMatch) {
      if (!inNumberedList) {
        if (inBulletList) {
          processedLines.push('</ul>');
          inBulletList = false;
        }
        processedLines.push('<ol>');
        inNumberedList = true;
      }
      processedLines.push(`<li>${numberedMatch[1]}</li>`);
      continue;
    }

    // Close any open lists
    if (inBulletList) {
      processedLines.push('</ul>');
      inBulletList = false;
    }
    if (inNumberedList) {
      processedLines.push('</ol>');
      inNumberedList = false;
    }

    // If line is already tagged, keep it
    if (line.startsWith('<')) {
      processedLines.push(line);
    } else {
      // Wrap in paragraph
      processedLines.push(`<p>${line}</p>`);
    }
  }

  // Close any remaining lists
  if (inBulletList) {
    processedLines.push('</ul>');
  }
  if (inNumberedList) {
    processedLines.push('</ol>');
  }

  formatted = processedLines.join('\n');

  // Clean up extra whitespace
  formatted = formatted.replace(/\n\s*\n\s*\n/g, '\n\n');
  
  return formatted;
};
