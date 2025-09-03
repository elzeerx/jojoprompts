import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Copy, RefreshCw, Palette } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export function MidjourneySrefTab() {
  const { toast } = useToast();
  const [srefCount, setSrefCount] = useState(4);
  const [lockSrefs, setLockSrefs] = useState(false);
  const [generatedSrefs, setGeneratedSrefs] = useState<number[]>([]);

  // Generate random SREF values in the valid range (0 to 4,294,967,295)
  const generateSrefs = () => {
    if (lockSrefs && generatedSrefs.length > 0) {
      return; // Don't regenerate if locked
    }

    const newSrefs: number[] = [];
    for (let i = 0; i < srefCount; i++) {
      // Generate random uint32 (0 to 4294967295)
      const randomSref = Math.floor(Math.random() * 4294967296);
      newSrefs.push(randomSref);
    }
    setGeneratedSrefs(newSrefs);
  };

  // Force regenerate even if locked
  const forceRegenerate = () => {
    const newSrefs: number[] = [];
    for (let i = 0; i < srefCount; i++) {
      const randomSref = Math.floor(Math.random() * 4294967296);
      newSrefs.push(randomSref);
    }
    setGeneratedSrefs(newSrefs);
  };

  // Copy SREF string to clipboard
  const copyToClipboard = async (text: string, description: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({
        title: "Copied!",
        description: `${description} copied to clipboard.`
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Copy failed",
        description: "Failed to copy to clipboard."
      });
    }
  };

  // Format SREF for Midjourney
  const formatSrefForMidjourney = () => {
    if (generatedSrefs.length === 0) return "";
    return generatedSrefs.map(sref => `--sref ${sref}`).join(' ');
  };

  return (
    <div className="space-y-6">
      {/* Controls */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Palette className="h-5 w-5 text-warm-gold" />
            Midjourney Style Reference Generator
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* SREF Count */}
            <div className="space-y-2">
              <Label htmlFor="sref-count">Number of SREFs</Label>
              <Select 
                value={srefCount.toString()} 
                onValueChange={(value) => setSrefCount(parseInt(value))}
              >
                <SelectTrigger id="sref-count">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="3">3</SelectItem>
                  <SelectItem value="4">4</SelectItem>
                  <SelectItem value="5">5</SelectItem>
                  <SelectItem value="6">6</SelectItem>
                  <SelectItem value="7">7</SelectItem>
                  <SelectItem value="8">8</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Lock Toggle */}
            <div className="space-y-2">
              <Label htmlFor="lock-srefs">Lock SREFs</Label>
              <div className="flex items-center space-x-2 h-10">
                <Switch
                  id="lock-srefs"
                  checked={lockSrefs}
                  onCheckedChange={setLockSrefs}
                />
                <Label htmlFor="lock-srefs" className="text-sm text-muted-foreground">
                  {lockSrefs ? "Locked" : "Unlocked"}
                </Label>
              </div>
            </div>

            {/* Generate Button */}
            <div className="space-y-2">
              <Label>&nbsp;</Label>
              <Button 
                onClick={generateSrefs}
                className="w-full mobile-button-primary"
                disabled={lockSrefs && generatedSrefs.length > 0}
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Generate SREFs
              </Button>
            </div>
          </div>

          <div className="text-xs text-muted-foreground">
            Style references help Midjourney generate images with consistent artistic styles. 
            Lock SREFs to maintain the same style across multiple generations.
          </div>
        </CardContent>
      </Card>

      {/* Generated SREFs */}
      {generatedSrefs.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              Generated Style References
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={forceRegenerate}
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Regenerate
                </Button>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => copyToClipboard(formatSrefForMidjourney(), "SREF command")}
                >
                  <Copy className="h-4 w-4 mr-2" />
                  Copy
                </Button>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Individual SREF values */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {generatedSrefs.map((sref, index) => (
                <div 
                  key={index}
                  className="p-3 rounded-lg bg-muted border text-center font-mono text-sm"
                >
                  {sref.toLocaleString()}
                </div>
              ))}
            </div>

            {/* Formatted for Midjourney */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Ready for Midjourney:</Label>
              <div className="p-4 rounded-lg bg-muted border">
                <code className="text-sm font-mono text-warm-gold">
                  {formatSrefForMidjourney()}
                </code>
              </div>
              <div className="text-xs text-muted-foreground">
                Copy this text and add it to the end of your Midjourney prompt.
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Usage Instructions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">How to use Style References</CardTitle>
        </CardHeader>
        <CardContent className="text-xs text-muted-foreground space-y-2">
          <p>
            <strong>1.</strong> Generate your SREF codes above
          </p>
          <p>
            <strong>2.</strong> Copy the ready-to-use command
          </p>
          <p>
            <strong>3.</strong> Add it to your Midjourney prompt: <br />
            <code className="bg-muted px-1 rounded">
              /imagine your prompt here --sref 123456 --sref 789012 --sref 345678 --sref 901234
            </code>
          </p>
          <p>
            <strong>4.</strong> Use the same SREF codes for consistent style across multiple images
          </p>
        </CardContent>
      </Card>
    </div>
  );
}