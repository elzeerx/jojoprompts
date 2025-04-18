import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { buildPromptsPdf, type PdfOptions } from "@/utils/pdf-export";
import { type Prompt } from "@/types";
import { Progress } from "@/components/ui/progress";
import { toast } from "@/hooks/use-toast";
import { FileDown } from "lucide-react";

interface ExportPromptsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  prompts: Prompt[];
}

export function ExportPromptsDialog({ open, onOpenChange, prompts }: ExportPromptsDialogProps) {
  const [options, setOptions] = useState<Omit<PdfOptions, "logo" | "selected">>({
    cover: true,
    quality: "medium"
  });
  const [isExporting, setIsExporting] = useState(false);
  const [progress, setProgress] = useState(0);

  const handleExport = async () => {
    if (prompts.length === 0) return;
    
    try {
      setIsExporting(true);
      setProgress(0);
      
      // Show initial toast
      const toastId = toast({
        title: "Preparing PDF...",
        description: "0%",
      });
      
      // Get logo as data URL
      const logoUrl = '/assets/jojoprompts-logo.png';
      const logoData = await fetch(logoUrl)
        .then(r => r.blob())
        .then(blob => {
          return new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.readAsDataURL(blob);
          });
        });
      
      // Create PDF with progress updates
      const pdfBytes = await buildPromptsPdf({
        ...options,
        selected: prompts,
        logo: logoData
      });
      
      // Update progress during generation
      const updateProgress = (current: number, total: number) => {
        const percentage = Math.round((current / total) * 100);
        setProgress(percentage);
        
        // Update toast on significant progress (every ~20%)
        if (percentage % 20 === 0 || percentage === 100) {
          toast.update(toastId, { description: `${percentage}%` });
        }
      };
      
      // Simulate progress for now (this would be replaced by actual progress from PDF generation)
      for (let i = 1; i <= prompts.length; i++) {
        updateProgress(i, prompts.length);
        if (i < prompts.length) {
          await new Promise(resolve => setTimeout(resolve, 100)); // Just for demo
        }
      }
      
      // Create and trigger download
      const blob = new Blob([pdfBytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      
      const a = document.createElement('a');
      const count = prompts.length;
      a.href = url;
      a.download = `jojoprompts_${new Date().toISOString().slice(0, 10)}_${count}.pdf`;
      
      toast.update(toastId, {
        title: "Ready!",
        description: "Download will start shortly",
      });
      
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      // Close dialog after successful export
      setTimeout(() => onOpenChange(false), 1000);
      
    } catch (e: any) {
      console.error("PDF export error:", e);
      toast.update(toastId, {
        title: "Error",
        description: e.message || "Failed to generate PDF",
        variant: "destructive",
      });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Export Prompts to PDF</DialogTitle>
        </DialogHeader>
        
        <div className="py-4 space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">Selected prompts:</p>
            <span className="font-bold">{prompts.length}</span>
          </div>
          
          <div className="space-y-3">
            <div className="flex items-center space-x-2">
              <Checkbox 
                id="cover-page"
                checked={options.cover}
                onCheckedChange={(checked) => 
                  setOptions(prev => ({ ...prev, cover: !!checked }))
                }
              />
              <Label htmlFor="cover-page">Include cover page</Label>
            </div>
          </div>
          
          <div className="space-y-2">
            <Label>Image Quality</Label>
            <RadioGroup 
              value={options.quality}
              onValueChange={(value: "thumb" | "medium" | "hq") => 
                setOptions(prev => ({ ...prev, quality: value }))
              }
              className="flex flex-col space-y-1"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="thumb" id="quality-thumb" />
                <Label htmlFor="quality-thumb">Thumbnail (faster)</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="medium" id="quality-medium" />
                <Label htmlFor="quality-medium">Medium</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="hq" id="quality-hq" />
                <Label htmlFor="quality-hq">High Quality (larger file)</Label>
              </div>
            </RadioGroup>
          </div>
          
          {isExporting && (
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">
                Generating PDF... {progress}%
              </Label>
              <Progress value={progress} />
            </div>
          )}
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isExporting}>
            Cancel
          </Button>
          <Button 
            onClick={handleExport} 
            disabled={isExporting || prompts.length === 0}
            className="gap-2"
          >
            <FileDown className="h-4 w-4" />
            Generate PDF
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
