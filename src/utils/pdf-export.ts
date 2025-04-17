
import jsPDF from 'jspdf';
import { type Prompt } from '@/types';

/**
 * Generates a PDF containing selected prompts
 * @param prompts Array of prompts to include in the PDF
 * @returns Promise that resolves when PDF is ready to download
 */
export const generatePromptsPDF = async (prompts: Prompt[]): Promise<Blob> => {
  // Create a new PDF document
  const doc = new jsPDF();
  
  // Set up initial parameters
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 20;
  let y = 20;
  
  // Add title
  doc.setFontSize(16);
  doc.text('JojoPrompts Collection', pageWidth / 2, y, { align: 'center' });
  y += 10;
  
  doc.setFontSize(10);
  doc.text(`Exported on ${new Date().toLocaleDateString()}`, pageWidth / 2, y, { align: 'center' });
  y += 15;
  
  // For each prompt
  for (let i = 0; i < prompts.length; i++) {
    const prompt = prompts[i];
    
    // Check if we need a new page
    if (y > doc.internal.pageSize.getHeight() - 40) {
      doc.addPage();
      y = 20;
    }
    
    // Add prompt number
    doc.setFontSize(12);
    doc.setFont(undefined, 'bold');
    doc.text(`${i + 1}. ${prompt.title}`, margin, y);
    y += 8;
    
    // Add metadata
    doc.setFontSize(8);
    doc.setTextColor(100, 100, 100);
    const metaText = `Category: ${prompt.metadata.category || 'None'} | Style: ${prompt.metadata.style || 'None'}`;
    doc.text(metaText, margin, y);
    y += 5;
    
    // Add prompt text
    doc.setFontSize(10);
    doc.setTextColor(0, 0, 0);
    doc.setFont(undefined, 'normal');
    
    // Handle text wrapping for prompt text
    const textLines = doc.splitTextToSize(prompt.prompt_text, pageWidth - 2 * margin);
    doc.text(textLines, margin, y);
    
    // Update y position based on how many lines of text were added
    y += textLines.length * 5 + 10;
    
    // Add a separator line
    doc.setDrawColor(200, 200, 200);
    doc.line(margin, y, pageWidth - margin, y);
    y += 10;
  }
  
  // Return the PDF as a blob
  return doc.output('blob');
};

/**
 * Downloads a PDF of selected prompts
 * @param prompts Array of prompts to include in the PDF
 */
export const downloadPromptsPDF = async (prompts: Prompt[]): Promise<void> => {
  try {
    // Generate the PDF
    const pdfBlob = await generatePromptsPDF(prompts);
    
    // Create a URL for the Blob
    const url = URL.createObjectURL(pdfBlob);
    
    // Create a temporary link and trigger download
    const link = document.createElement('a');
    link.href = url;
    link.download = `jojoprompts-export-${new Date().toISOString().split('T')[0]}.pdf`;
    document.body.appendChild(link);
    link.click();
    
    // Clean up
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  } catch (error) {
    console.error('Error generating PDF:', error);
    throw error;
  }
};
