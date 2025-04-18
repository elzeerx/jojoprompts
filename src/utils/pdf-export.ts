
import { type Prompt } from "@/types";
import { cdnUrl } from "@/utils/image";

export type PdfOptions = {
  cover: boolean;
  quality: "thumb" | "medium" | "hq";
  selected: Prompt[];
  logo: string;
};

export async function buildPromptsPdf(opts: PdfOptions): Promise<Uint8Array> {
  // Import PDF-lib dynamically to reduce initial load
  const { PDFDocument, rgb, StandardFonts } = await import('pdf-lib');
  
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.HelveticaBold);
  const regularFont = await doc.embedFont(StandardFonts.Helvetica);

  const addImage = async (bytes: Uint8Array, w: number) => {
    const img = await doc.embedJpg(bytes);
    const ratio = w / img.width;                 // keep aspect
    return { img, h: img.height * ratio };
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
    
    const logoBytes = await fetch(opts.logo).then(r => r.arrayBuffer());
    const { img, h } = await addImage(new Uint8Array(logoBytes), 300);
    page.drawImage(img, { x: 147, y: 600, width: 300, height: h });
    
    page.drawText(`Generated: ${new Date().toLocaleDateString()}`, {
      x: 50, y: 520, size: 18, font, color: rgb(1, 1, 1)
    });
    
    page.drawText(`Total prompts: ${opts.selected.length}`, {
      x: 50, y: 490, size: 18, font, color: rgb(1, 1, 1)
    });
  }

  // ▸ 2 Each prompt page
  for (const p of opts.selected) {
    const page = doc.addPage([595, 842]);
    page.drawText(p.title, { x: 50, y: 780, size: 24, font });

    // image
    if (p.image_path) {
      const url = getCdnUrl(p.image_path, opts.quality);
      const bytes = await fetch(url).then(r => r.arrayBuffer());
      const { img, h } = await addImage(new Uint8Array(bytes), 400);
      page.drawImage(img, { x: 97, y: 540 - h, width: 400, height: h });
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
