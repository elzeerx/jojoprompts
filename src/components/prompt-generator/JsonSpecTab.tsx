import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Copy, Wand2, Loader2, Save, CheckCircle, XCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { callEdgeFunction } from "@/utils/edgeFunctions";
import { createLogger } from '@/utils/logging';

const logger = createLogger('JSON_SPEC_TAB');

interface JsonSpecRequest {
  user_prompt: string;
  duration_sec: 5 | 8;
}

interface JsonSpecResponse {
  json_spec: any;
}

export function JsonSpecTab() {
  const { toast } = useToast();
  const [userPrompt, setUserPrompt] = useState("");
  const [duration, setDuration] = useState<5 | 8>(5);
  const [generatedJson, setGeneratedJson] = useState<any>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [jsonValid, setJsonValid] = useState<boolean | null>(null);

  // Generate JSON spec
  const handleGenerateJson = async () => {
    if (!userPrompt.trim()) {
      toast({
        variant: "destructive",
        title: "Prompt required",
        description: "Please enter a description for your video/image."
      });
      return;
    }

    setIsGenerating(true);
    try {
      const request: JsonSpecRequest = {
        user_prompt: userPrompt.trim(),
        duration_sec: duration
      };

      const response: JsonSpecResponse = await callEdgeFunction('ai-json-spec', request);
      setGeneratedJson(response.json_spec);
      setJsonValid(true);
      
      toast({
        title: "JSON generated!",
        description: "Your video/image specification is ready to use."
      });

    } catch (error: any) {
      logger.error('Error generating JSON', { error: error.message });
      setJsonValid(false);
      toast({
        variant: "destructive",
        title: "Generation failed",
        description: "Failed to generate JSON specification. Please try again."
      });
    } finally {
      setIsGenerating(false);
    }
  };

  // Copy to clipboard
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

  // Validate JSON structure
  const validateJsonStructure = (json: any): boolean => {
    if (!json || typeof json !== 'object') return false;
    
    const requiredFields = ['shot', 'subject', 'scene', 'visual_details', 'cinematography', 'audio', 'color_palette', 'visual_rules'];
    return requiredFields.every(field => json.hasOwnProperty(field));
  };

  // Format JSON for display
  const formatJsonForDisplay = () => {
    if (!generatedJson) return "";
    return JSON.stringify(generatedJson, null, 2);
  };

  return (
    <div className="space-y-6">
      {/* Input Form */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wand2 className="h-5 w-5 text-warm-gold" />
            Video/Image JSON Generator
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Duration Selection */}
          <div className="space-y-2">
            <Label htmlFor="duration">Video Duration *</Label>
            <Select 
              value={duration.toString()} 
              onValueChange={(value) => setDuration(parseInt(value) as 5 | 8)}
            >
              <SelectTrigger id="duration">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="5">5 seconds</SelectItem>
                <SelectItem value="8">8 seconds</SelectItem>
              </SelectContent>
            </Select>
            <div className="text-xs text-muted-foreground">
              Choose the duration for your video generation. This affects the timeline structure.
            </div>
          </div>

          {/* User Prompt */}
          <div className="space-y-2">
            <Label htmlFor="user-prompt">Describe your video/image idea *</Label>
            <Textarea
              id="user-prompt"
              placeholder="e.g., A futuristic cityscape at sunset with flying cars moving through neon-lit streets..."
              value={userPrompt}
              onChange={(e) => setUserPrompt(e.target.value)}
              className="min-h-[120px]"
            />
            <div className="text-xs text-muted-foreground">
              Describe what you want to see. Be as detailed or as simple as you like - the AI will expand your description into a complete specification.
            </div>
          </div>

          <Button 
            onClick={handleGenerateJson}
            disabled={isGenerating || !userPrompt.trim()}
            className="w-full mobile-button-primary"
            size="lg"
          >
            {isGenerating ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Generating JSON...
              </>
            ) : (
              <>
                <Wand2 className="h-4 w-4 mr-2" />
                Generate JSON Specification
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Generated JSON */}
      {generatedJson && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                Generated JSON Specification
                {jsonValid !== null && (
                  <Badge variant={jsonValid ? "default" : "destructive"} className="flex items-center gap-1">
                    {jsonValid ? (
                      <>
                        <CheckCircle className="h-3 w-3" />
                        Valid
                      </>
                    ) : (
                      <>
                        <XCircle className="h-3 w-3" />
                        Invalid
                      </>
                    )}
                  </Badge>
                )}
              </div>
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => copyToClipboard(formatJsonForDisplay(), "JSON specification")}
                >
                  <Copy className="h-4 w-4 mr-2" />
                  Copy
                </Button>
                <Button variant="outline" size="sm">
                  <Save className="h-4 w-4 mr-2" />
                  Save Template
                </Button>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* JSON Structure Overview */}
              {validateJsonStructure(generatedJson) && (
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Structure Overview</Label>
                  <div className="flex flex-wrap gap-1">
                    {Object.keys(generatedJson).map((key) => (
                      <Badge key={key} variant="outline" className="text-xs">
                        {key}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* JSON Display */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">Complete JSON</Label>
                <div className="p-4 rounded-lg bg-muted border max-h-96 overflow-auto">
                  <pre className="whitespace-pre-wrap text-xs font-mono">
                    {formatJsonForDisplay()}
                  </pre>
                </div>
              </div>

              {/* Usage Instructions */}
              <div className="p-4 rounded-lg bg-soft-bg/30 border border-warm-gold/20">
                <div className="text-sm font-medium text-warm-gold mb-2">How to use this JSON:</div>
                <ul className="text-xs text-muted-foreground space-y-1">
                  <li>• <strong>Veo3:</strong> Use the complete JSON as your video generation specification</li>
                  <li>• <strong>Other services:</strong> Extract relevant fields like "shot", "subject", "scene"</li>
                  <li>• <strong>Timeline:</strong> Follow the visual_details.timeline for {duration}-second sequences</li>
                  <li>• <strong>Physics weight:</strong> Adjust visual_rules.physics_weight (0-1) for realism control</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Usage Guide */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">JSON Specification Guide</CardTitle>
        </CardHeader>
        <CardContent className="text-xs text-muted-foreground space-y-3">
          <div>
            <strong className="text-foreground">What this generates:</strong>
            <p>A complete JSON specification optimized for video/image AI services like Veo3, with structured fields for cinematography, timing, and visual rules.</p>
          </div>
          
          <div>
            <strong className="text-foreground">Key sections:</strong>
            <ul className="list-disc list-inside mt-1 space-y-1">
              <li><strong>Shot:</strong> Camera composition, motion, lens, and technical settings</li>
              <li><strong>Subject:</strong> Main elements, poses, and emotions</li>
              <li><strong>Scene:</strong> Location, time, and environment details</li>
              <li><strong>Visual Details:</strong> Timeline breakdown for chosen duration</li>
              <li><strong>Cinematography:</strong> Lighting, style, and tone</li>
              <li><strong>Audio:</strong> Sound design and music suggestions</li>
              <li><strong>Visual Rules:</strong> Physics weight and content restrictions</li>
            </ul>
          </div>

          <div>
            <strong className="text-foreground">Tips:</strong>
            <ul className="list-disc list-inside mt-1 space-y-1">
              <li>Be specific about camera movements and lighting for better results</li>
              <li>Use physics_weight 0.8-1.0 for realistic videos, 0.3-0.7 for stylized content</li>
              <li>Timeline ensures logical progression without sudden scene changes</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}