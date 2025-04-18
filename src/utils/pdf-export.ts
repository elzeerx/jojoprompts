import { type Prompt } from "@/types";
import { cdnUrl } from "@/utils/image";
import { toast } from "@/hooks/use-toast";

// Layout constants
const MARGIN = 40;
const IMAGE_MAX_W = 400;          // px on page
const IMAGE_MAX_H = 380;
const FONT_SIZE_TITLE = 18;
const FONT_SIZE_BODY = 12;

export type PdfOptions = {
  cover: boolean;
  quality: "thumb" | "medium" | "hq";
  selected: Prompt[];
  logo: string;
  onProgress?: (current: number, total: number) => void;
};

async function tryEmbedImage(pdf: PDFDocument, bytes: ArrayBuffer) {
  try {
    return await pdf.embedJpg(bytes);
  } catch {
    return await pdf.embedPng(bytes);
  }
}

export async function buildPromptsPdf(opts: PdfOptions): Promise<Uint8Array> {
  const { PDFDocument, rgb, StandardFonts } = await import('pdf-lib');
  
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.HelveticaBold);
  const regularFont = await doc.embedFont(StandardFonts.Helvetica);

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
    
    try {
      const logoBytes = await fetch(opts.logo).then(r => r.arrayBuffer());
      const { img, h } = await addImage(opts.logo, 300) || { img: null, h: 0 };
      if (img) {
        page.drawImage(img, { x: 147, y: 600, width: 300, height: h });
      }
    } catch (error) {
      console.error("Error adding logo to cover:", error);
    }
    
    page.drawText(`Generated: ${new Date().toLocaleDateString()}`, {
      x: 50, y: 520, size: 18, font, color: rgb(1, 1, 1)
    });
    
    page.drawText(`Total prompts: ${opts.selected.length}`, {
      x: 50, y: 490, size: 18, font, color: rgb(1, 1, 1)
    });
  }

  // Process each prompt
  let completedPrompts = 0;
  for (const p of opts.selected) {
    const page = doc.addPage([595, 842]); // A4

    // 1. Draw title
    page.drawText(p.title, {
      x: MARGIN,
      y: page.getHeight() - MARGIN - FONT_SIZE_TITLE,
      size: FONT_SIZE_TITLE,
      font
    });

    // 2. Draw image if available
    if (p.image_path) {
      try {
        const url = getCdnUrl(p.image_path, opts.quality);
        const response = await fetch(url);
        
        if (!response.ok || !response.headers.get("content-type")?.startsWith("image/")) {
          console.warn("Skip image", url);
          toast({
            title: "Image error",
            description: `${p.image_path} not found`,
            variant: "destructive"
          });
          continue;
        }

        const imageBytes = await response.arrayBuffer();
        const img = await tryEmbedImage(doc, imageBytes);
        
        const scale = Math.min(IMAGE_MAX_W / img.width, IMAGE_MAX_H / img.height, 1);
        const imgW = img.width * scale;
        const imgH = img.height * scale;
        
        page.drawImage(img, {
          x: MARGIN,
          y: page.getHeight() - MARGIN - imgH - FONT_SIZE_TITLE - 10,
          width: imgW,
          height: imgH
        });

        // 3. Draw text block below image
        const startY = page.getHeight() - MARGIN - imgH - FONT_SIZE_TITLE - 30;
        page.drawText(p.prompt_text, {
          x: MARGIN,
          y: startY,
          size: FONT_SIZE_BODY,
          font: regularFont,
          maxWidth: page.getWidth() - 2 * MARGIN,
          lineHeight: FONT_SIZE_BODY + 2
        });
      } catch (error) {
        console.error("Image processing error:", error);
        toast({
          title: "Image error",
          description: `${p.image_path} could not be processed`,
          variant: "destructive"
        });
      }
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
  const logoUrl = '/assets/jojoprompts-logo.png';
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
