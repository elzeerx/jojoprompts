
import { PDFDocument, rgb, StandardFonts, degrees } from "pdf-lib";
import { type Prompt } from "@/types";
import { cdnUrl } from "@/utils/image";
import { toast } from "@/hooks/use-toast";

// Layout constants
export const MARGIN = 32;
export const FONT_SIZE_TITLE = 20;
export const FONT_SIZE_BODY = 11;
export const LINE_HEIGHT = 14;  // ≈ 11 pt × 1.3
export const LOGO_HEIGHT = 24;
export const GAP = 12;  // vertical gap between blocks
const PPI = 72;  // Points per inch (pdf-lib uses points)

// Max widths for each quality option in pixels
export const QUALITY_WIDTH: Record<"thumb" | "medium" | "hq", number> = {
  thumb: 300,
  medium: 600,
  hq: 1200,
};

// Types for PDF options
export interface PdfOptions {
  cover: boolean;
  quality: "thumb" | "medium" | "hq";
  selected: Prompt[];
  logo: string;
  onProgress?: (current: number, total: number) => void;
}

function fitIntoPage(
  pageWidth: number,
  pageHeight: number,
  imgWidth: number,
  imgHeight: number,
  margin = MARGIN
) {
  const maxW = pageWidth - margin * 2;
  const maxH = pageHeight - margin * 2;
  const ratio = Math.min(maxW / imgWidth, maxH / imgHeight);
  return {
    width: imgWidth * ratio,
    height: imgHeight * ratio,
    x: (pageWidth - imgWidth * ratio) / 2,
    y: (pageHeight - imgHeight * ratio) / 2,
  };
}

async function tryEmbedImage(pdf: any, bytes: ArrayBuffer) {
  try {
    return await pdf.embedJpg(bytes);
  } catch {
    return await pdf.embedPng(bytes);
  }
}

export async function buildPromptsPdf(opts: PdfOptions): Promise<Uint8Array> {
  const { PDFDocument, rgb, StandardFonts } = await import('pdf-lib');
  
  const doc = await PDFDocument.create();
  const boldFont = await doc.embedFont(StandardFonts.HelveticaBold);
  const regularFont = await doc.embedFont(StandardFonts.Helvetica);

  // Load the logo once
  let logoImage = null;
  try {
    const logoResponse = await fetch('/jojo-logo.png');
    const logoBytes = await logoResponse.arrayBuffer();
    logoImage = await doc.embedPng(logoBytes);
  } catch (error) {
    console.error("Failed to load logo:", error);
  }

  // ▸ 1 Cover
  if (opts.cover) {
    const page = doc.addPage([595, 842]);        // A4 portrait
    page.drawRectangle({ 
      x: 0, 
      y: 0, 
      width: 595, 
      height: 842, 
      color: rgb(0.46, 0.29, 0.71) 
    });
    
    if (logoImage) {
      const scale = Math.min(300 / logoImage.width, 100 / logoImage.height, 1);
      const imgW = logoImage.width * scale;
      const imgH = logoImage.height * scale;
      page.drawImage(logoImage, { 
        x: (page.getWidth() - imgW) / 2, 
        y: 600, 
        width: imgW, 
        height: imgH 
      });
    }
    
    page.drawText(`Generated: ${new Date().toLocaleDateString()}`, {
      x: MARGIN, 
      y: 520, 
      size: FONT_SIZE_TITLE, 
      font: boldFont, 
      color: rgb(1, 1, 1)
    });
    
    page.drawText(`Total prompts: ${opts.selected.length}`, {
      x: MARGIN, 
      y: 490, 
      size: FONT_SIZE_TITLE, 
      font: boldFont, 
      color: rgb(1, 1, 1)
    });
  }

  // Process each prompt
  let completedPrompts = 0;
  for (const prompt of opts.selected) {
    const page = doc.addPage([595, 842]); // A4
    let cursorY = page.getHeight() - MARGIN;

    // 1. Draw title
    page.drawText(prompt.title, {
      x: MARGIN,
      y: cursorY - FONT_SIZE_TITLE,
      size: FONT_SIZE_TITLE,
      font: boldFont,
      color: rgb(0, 0, 0)
    });
    cursorY -= (FONT_SIZE_TITLE + GAP);

    // 2. Draw image if available
    if (prompt.image_path) {
      try {
        const url = getCdnUrl(prompt.image_path, opts.quality);
        const response = await fetch(url);
        
        // Get image dimensions and embed in PDF
        let img;
        if (!response.ok || !response.headers.get("content-type")?.startsWith("image/")) {
          // Create placeholder for unavailable image
          const placeholderResponse = await fetch('/placeholder.svg');
          const placeholderBytes = await placeholderResponse.arrayBuffer();
          img = await tryEmbedImage(doc, placeholderBytes);
        } else {
          const imageBytes = await response.arrayBuffer();
          img = await tryEmbedImage(doc, imageBytes);
        }

        const imgDims = img.scale(1);  // Get real pixel size

        const maxImgPx = QUALITY_WIDTH[opts.quality];
        const maxImgPts = (maxImgPx / 96) * PPI;  // convert px → points (assumes 96 dpi)

        // Maintain aspect-ratio & never exceed page content width
        const availableW = page.getWidth() - MARGIN * 2;
        const targetW = Math.min(availableW, maxImgPts, imgDims.width);
        const scale = targetW / imgDims.width;
        const targetH = imgDims.height * scale;

        // Center horizontally
        const imgX = (page.getWidth() - targetW) / 2;
        const imgY = cursorY - targetH;

        // Draw scaled image
        page.drawImage(img, {
          x: imgX,
          y: imgY,
          width: targetW,
          height: targetH,
        });

        cursorY = imgY - GAP;  // Move cursor below image
      } catch (error) {
        console.error("Image processing error:", error);
        toast({
          title: "Image error",
          description: `${prompt.image_path} could not be processed`,
          variant: "destructive"
        });
        cursorY -= 100; // Add some space anyway
      }
    }

    // 3. Draw prompt text
    const textLines = splitText(prompt.prompt_text, 70);
    for (const line of textLines) {
      page.drawText(line, {
        x: MARGIN,
        y: cursorY - FONT_SIZE_BODY,
        size: FONT_SIZE_BODY,
        font: regularFont,
        color: rgb(0, 0, 0),
        lineHeight: LINE_HEIGHT
      });
      cursorY -= LINE_HEIGHT;
    }
    cursorY -= GAP;

    // 4. Draw category/style/tags section (if available)
    const meta = prompt.metadata || {};
    const category = meta.category || "";
    const style = meta.style || "";
    const tags = Array.isArray(meta.tags) ? meta.tags : [];

    if (category || style || tags.length > 0) {
      let categoryText = '';
      if (category) categoryText += `Category: ${category}`;
      if (style) {
        if (categoryText) categoryText += ' • ';
        categoryText += `Style: ${style}`;
      }
      
      if (categoryText) {
        page.drawText(categoryText, {
          x: MARGIN,
          y: cursorY - FONT_SIZE_BODY,
          size: FONT_SIZE_BODY,
          font: boldFont,
          color: rgb(0, 0, 0),
        });
        cursorY -= (FONT_SIZE_BODY + 8);
      }
      
      // Draw tags as pills
      if (tags.length > 0) {
        let xPos = MARGIN;
        const tagHeight = FONT_SIZE_BODY + 6;
        const pillPadding = 8;
        
        for (const tag of tags) {
          const tagWidth = tag.length * (FONT_SIZE_BODY * 0.6) + (pillPadding * 2);
          
          // Check if we need to wrap to next line
          if (xPos + tagWidth > page.getWidth() - MARGIN) {
            xPos = MARGIN;
            cursorY -= (tagHeight + 4);
          }
          
          // Draw pill background - removed borderRadius as it's not supported
          page.drawRectangle({
            x: xPos,
            y: cursorY - tagHeight,
            width: tagWidth,
            height: tagHeight,
            color: rgb(0.95, 0.95, 0.95),
            borderColor: rgb(0.9, 0.9, 0.9),
            borderWidth: 1,
          });
          
          // Draw tag text
          page.drawText(tag, {
            x: xPos + pillPadding,
            y: cursorY - tagHeight + pillPadding - 1,
            size: FONT_SIZE_BODY - 1,
            font: regularFont,
            color: rgb(0.33, 0.33, 0.33),
          });
          
          xPos += tagWidth + 6;
        }
        cursorY -= (tagHeight + GAP);
      }
    }

    // 5. Draw logo at bottom center
    if (logoImage) {
      const logoWidth = LOGO_HEIGHT * (logoImage.width / logoImage.height);
      page.drawImage(logoImage, {
        x: (page.getWidth() - logoWidth) / 2,
        y: MARGIN - (LOGO_HEIGHT / 2),
        width: logoWidth,
        height: LOGO_HEIGHT,
      });
    }

    // Update progress
    completedPrompts++;
    if (opts.onProgress) {
      opts.onProgress(completedPrompts, opts.selected.length);
    }
  }

  return await doc.save();
}

// Helper to get appropriate CDN URL based on quality setting
function getCdnUrl(path: string, quality: "thumb" | "medium" | "hq"): string {
  const qualityMap = {
    thumb: 400,
    medium: 800,
    hq: 1200
  };
  
  return cdnUrl(path, qualityMap[quality], 90) || '';
}

// Text wrapper to fit within page width
function splitText(text: string, maxCharsPerLine: number): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    if ((currentLine + word).length > maxCharsPerLine) {
      lines.push(currentLine.trim());
      currentLine = word + ' ';
    } else {
      currentLine += word + ' ';
    }
  }
  
  if (currentLine.trim().length > 0) {
    lines.push(currentLine.trim());
  }
  
  return lines;
}

export async function downloadPromptsPDF(prompts: Prompt[]): Promise<void> {
  // For backward compatibility - uses the new export function with default settings
  const logoUrl = '/jojo-logo.png';
  const logoData = await fetch(logoUrl).then(r => r.blob()).then(blob => {
    return new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.readAsDataURL(blob);
    });
  });
  
  const pdfBytes = await buildPromptsPdf({
    cover: true,
    quality: "medium",
    selected: prompts,
    logo: logoData
  });
  
  const blob = new Blob([pdfBytes], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  
  const a = document.createElement('a');
  const count = prompts.length;
  a.href = url;
  a.download = `jojoprompts_${new Date().toISOString().slice(0, 10)}_${count}.pdf`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
