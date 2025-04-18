import { type Prompt } from "@/types";
import { cdnUrl } from "@/utils/image";
import { toast } from "@/hooks/use-toast";

export type PdfOptions = {
  cover: boolean;
  quality: "thumb" | "medium" | "hq";
  selected: Prompt[];
  logo: string;
  onProgress?: (current: number, total: number) => void;
};

export async function buildPromptsPdf(opts: PdfOptions): Promise<Uint8Array> {
  // Import PDF-lib dynamically to reduce initial load
  const { PDFDocument, rgb, StandardFonts } = await import('pdf-lib');
  
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.HelveticaBold);
  const regularFont = await doc.embedFont(StandardFonts.Helvetica);

  const addImage = async (imagePath: string, width: number) => {
    try {
      // Get appropriate URL based on quality
      const url = getCdnUrl(imagePath, opts.quality);
      
      // Fetch the image
      const response = await fetch(url);
      
      // Check if response is successful and is an image
      if (!response.ok) {
        throw new Error(`Failed to fetch image: ${response.status}`);
      }
      
      const contentType = response.headers.get('content-type') || '';
      if (!contentType.startsWith('image/')) {
        throw new Error(`Not an image: ${contentType}`);
      }
      
      const imageBytes = new Uint8Array(await response.arrayBuffer());
      
      // Use appropriate embed method based on content type
      if (contentType.startsWith('image/png')) {
        const img = await doc.embedPng(imageBytes);
        const ratio = width / img.width;                 // keep aspect
        return { img, h: img.height * ratio };
      } else {
        // Default to JPG for other image types
        const img = await doc.embedJpg(imageBytes);
        const ratio = width / img.width;                 // keep aspect
        return { img, h: img.height * ratio };
      }
    } catch (error) {
      // Handle error but continue building PDF
      toast({
        title: "Image error",
        description: `${imagePath} not found`,
        variant: "destructive"
      });
      console.error(`Image embedding error: ${error}`);
      return null;
    }
  };

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

  // ▸ 2 Each prompt page
  let completedPrompts = 0;
  for (const p of opts.selected) {
    const page = doc.addPage([595, 842]);
    page.drawText(p.title, { x: 50, y: 780, size: 24, font });

    // image
    if (p.image_path) {
      const imageResult = await addImage(p.image_path, 400);
      if (imageResult) {
        const { img, h } = imageResult;
        page.drawImage(img, { x: 97, y: 540 - h, width: 400, height: h });
      }
    }

    // prompt text
    const wrapped = splitText(p.prompt_text, 80);
    wrapped.forEach((line, i) =>
      page.drawText(line, { x: 50, y: 480 - 14 * i, size: 12, font: regularFont })
    );

    // metadata
    page.drawText(`Category: ${p.metadata.category ?? "-"}`, { x: 50, y: 140, size: 10, font: regularFont });
    page.drawText(`Style:    ${p.metadata.style ?? "-"}`, { x: 50, y: 125, size: 10, font: regularFont });
    page.drawText(`Tags: ${p.metadata.tags?.join(", ") ?? "-"}`, { x: 50, y: 110, size: 10, font: regularFont });
    
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
