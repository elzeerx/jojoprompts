import { PDFDocument, rgb, StandardFonts, degrees } from "pdf-lib";
import fontkit from '@pdf-lib/fontkit';
import { type Prompt } from "@/types";
import { cdnUrl } from "@/utils/image";
import { toast } from "@/hooks/use-toast";

// Layout constants
const PAGE_MARGIN = 40;
const IMAGE_RATIO = 4 / 5;          // width / height (portrait 4:5)
const IMAGE_MAX_WIDTH_PX = 400;     // fallback if page width is huge
const FONT_SIZE_TITLE = 20;
const FONT_SIZE_BODY = 11;
const LINE_HEIGHT = 14;  // ≈ 11 pt × 1.3
const LOGO_HEIGHT = 24;
const GAP = 12;  // vertical gap between blocks
const PPI = 72;  // Points per inch (pdf-lib uses points)

// Max widths for each quality option in pixels
const QUALITY_WIDTH: Record<"thumb" | "medium" | "hq", number> = {
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

// Helper - returns scaled w/h that fit page and keep 4:5
const getImageBox = (pageWidth: number) => {
  const maxW = Math.min(pageWidth - PAGE_MARGIN * 2, IMAGE_MAX_WIDTH_PX);
  return { w: maxW, h: maxW / IMAGE_RATIO };
};

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
  doc.registerFontkit(fontkit);
  
  // Load custom fonts with Unicode support
  let fontRegular, fontBold;
  
  try {
    const notoRegular = await fetch('/fonts/NotoSans-Regular.ttf').then(r => r.arrayBuffer());
    const notoBold = await fetch('/fonts/NotoSans-Bold.ttf').then(r => r.arrayBuffer());
    
    fontRegular = await doc.embedFont(notoRegular);
    fontBold = await doc.embedFont(notoBold);
  } catch (error) {
    console.error("Failed to load custom fonts:", error);
    // Fallback to standard fonts if custom fonts fail to load
    fontRegular = await doc.embedFont(StandardFonts.Helvetica);
    fontBold = await doc.embedFont(StandardFonts.HelveticaBold);
  }

  // Load the logo once
  let logoImage = null;
  try {
    const logoResponse = await fetch('/jojo-logo.png');
    const logoBytes = await logoResponse.arrayBuffer();
    logoImage = await doc.embedPng(logoBytes);
  } catch (error) {
    console.error("Failed to load logo:", error);
  }

  // Cover page
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
    
    const titleText = `Generated: ${new Date().toLocaleDateString()}`;
    page.drawText(titleText, {
      x: PAGE_MARGIN, 
      y: 520, 
      size: FONT_SIZE_TITLE, 
      font: fontBold, 
      color: rgb(1, 1, 1)
    });
    
    const promptsText = `Total prompts: ${opts.selected.length}`;
    page.drawText(promptsText, {
      x: PAGE_MARGIN, 
      y: 490, 
      size: FONT_SIZE_TITLE, 
      font: fontBold, 
      color: rgb(1, 1, 1)
    });
  }

  // Process each prompt
  let completedPrompts = 0;
  for (const prompt of opts.selected) {
    const page = doc.addPage([595, 842]); // A4
    const { width: pw, height: ph } = page.getSize();
    
    // Calculate image dimensions using 4:5 ratio
    const { w: imgW, h: imgH } = getImageBox(pw);
    
    // Start drawing from top
    let cursorY = ph - PAGE_MARGIN;

    // Draw title
    page.drawText(prompt.title, {
      x: PAGE_MARGIN,
      y: cursorY - FONT_SIZE_TITLE,
      size: FONT_SIZE_TITLE,
      font: fontBold,
      color: rgb(0, 0, 0)
    });
    cursorY -= FONT_SIZE_TITLE + 24;

    // Draw image in 4:5 box
    if (prompt.image_path) {
      try {
        const url = getCdnUrl(prompt.image_path, opts.quality);
        const response = await fetch(url);
        
        let img;
        if (!response.ok || !response.headers.get("content-type")?.startsWith("image/")) {
          const placeholderResponse = await fetch('/placeholder.svg');
          const placeholderBytes = await placeholderResponse.arrayBuffer();
          img = await tryEmbedImage(doc, placeholderBytes);
        } else {
          const imageBytes = await response.arrayBuffer();
          img = await tryEmbedImage(doc, imageBytes);
        }

        page.drawImage(img, {
          x: (pw - imgW) / 2,
          y: cursorY - imgH,
          width: imgW,
          height: imgH,
        });

        cursorY -= imgH + 24;  // Move cursor below image with gap
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

    // Draw prompt text
    const textLines = splitText(prompt.prompt_text, 70);
    for (const line of textLines) {
      page.drawText(line, {
        x: PAGE_MARGIN,
        y: cursorY - FONT_SIZE_BODY,
        size: FONT_SIZE_BODY,
        font: fontRegular,
        color: rgb(0, 0, 0),
        lineHeight: LINE_HEIGHT
      });
      cursorY -= LINE_HEIGHT;
    }
    cursorY -= GAP;

    // Draw category/style/tags section (if available)
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
          x: PAGE_MARGIN,
          y: cursorY - FONT_SIZE_BODY,
          size: FONT_SIZE_BODY,
          font: fontBold,
          color: rgb(0, 0, 0),
        });
        cursorY -= (FONT_SIZE_BODY + 8);
      }
      
      // Draw tags as pills
      if (tags.length > 0) {
        let xPos = PAGE_MARGIN;
        const tagHeight = FONT_SIZE_BODY + 6;
        const pillPadding = 8;
        
        for (const tag of tags) {
          const tagWidth = fontRegular.widthOfTextAtSize(tag, FONT_SIZE_BODY - 1) + (pillPadding * 2);
          
          // Check if we need to wrap to next line
          if (xPos + tagWidth > page.getWidth() - PAGE_MARGIN) {
            xPos = PAGE_MARGIN;
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
            font: fontRegular,
            color: rgb(0.33, 0.33, 0.33),
          });
          
          xPos += tagWidth + 6;
        }
        cursorY -= (tagHeight + GAP);
      }
    }

    // Draw logo at bottom
    if (logoImage) {
      const logoWidth = LOGO_HEIGHT * (logoImage.width / logoImage.height);
      page.drawImage(logoImage, {
        x: (page.getWidth() - logoWidth) / 2,
        y: PAGE_MARGIN - (LOGO_HEIGHT / 2),
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
