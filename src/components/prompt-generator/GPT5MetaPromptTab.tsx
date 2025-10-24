import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Copy, Wand2, Sparkles, Loader2, Save, Plus, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { callEdgeFunction } from "@/utils/edgeFunctions";
import type { GPT5MetapromptRequest, GPT5MetapromptResponse, MetapromptFieldOptions } from "@/types/gpt5-metaprompt";
import { createLogger } from '@/utils/logging';

const logger = createLogger('GPT5_METAPROMPT_TAB');

// Default field options
const defaultFieldOptions: MetapromptFieldOptions = {
  subjects: [
    "Writing", "Marketing", "Education", "Business Strategy", "Creative Writing", 
    "Technical Documentation", "Customer Service", "Product Management", "Data Analysis", 
    "Programming", "Design", "Content Creation", "Research", "Planning", "Communication"
  ],
  output_formats: [
    "Essay", "Report", "Plan", "Guide", "Tutorial", "Checklist", "Email", "Proposal", 
    "Summary", "Analysis", "Script", "Outline", "JSON", "Dialogue", "Story", "Review"
  ],
  constraints: [
    "Under 500 words", "Academic tone", "Professional tone", "Casual tone", "No jargon", 
    "Include examples", "Step-by-step", "Bullet points", "Numbered list", "Avoid technical terms",
    "Family-friendly", "Beginner level", "Expert level", "Action-oriented", "Data-driven"
  ],
  styles: [
    "Professional", "Academic", "Conversational", "Persuasive", "Informative", "Creative", 
    "Technical", "Friendly", "Authoritative", "Collaborative", "Analytical", "Storytelling",
    "Direct", "Empathetic", "Inspiring", "Practical"
  ],
  audiences: [
    "General audience", "Students", "Professionals", "Beginners", "Experts", "Children", 
    "Teenagers", "Adults", "Seniors", "Business leaders", "Developers", "Marketers",
    "Educators", "Researchers", "Customers", "Team members"
  ],
  goals: [
    "Inform", "Persuade", "Educate", "Entertain", "Solve problems", "Generate ideas", 
    "Make decisions", "Plan strategy", "Build skills", "Create content", "Analyze data",
    "Improve processes", "Communicate clearly", "Engage audience", "Drive action", "Inspire"
  ]
};

export function GPT5MetaPromptTab() {
  const { toast } = useToast();
  
  // Step 0 - Quick request (optional)
  const [quickRequest, setQuickRequest] = useState("");
  const [showSteps, setShowSteps] = useState(false);
  
  // Step 1-3 form data
  const [subject, setSubject] = useState("");
  const [outputFormat, setOutputFormat] = useState("");
  const [selectedConstraints, setSelectedConstraints] = useState<string[]>([]);
  const [selectedStyles, setSelectedStyles] = useState<string[]>([]);
  const [selectedAudiences, setSelectedAudiences] = useState<string[]>([]);
  const [selectedGoals, setSelectedGoals] = useState<string[]>([]);
  
  // Field options (editable)
  const [fieldOptions, setFieldOptions] = useState<MetapromptFieldOptions>(defaultFieldOptions);
  
  // Results
  const [generatedMetaprompt, setGeneratedMetaprompt] = useState<GPT5MetapromptResponse | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSuggestingFields, setIsSuggestingFields] = useState(false);

  // Add/remove options handlers
  const addOption = (category: keyof MetapromptFieldOptions, value: string) => {
    if (value.trim() && !fieldOptions[category].includes(value.trim())) {
      setFieldOptions(prev => ({
        ...prev,
        [category]: [...prev[category], value.trim()]
      }));
    }
  };

  const removeOption = (category: keyof MetapromptFieldOptions, value: string) => {
    setFieldOptions(prev => ({
      ...prev,
      [category]: prev[category].filter(item => item !== value)
    }));
  };

  // Multi-select handlers
  const toggleSelection = (selectedArray: string[], setSelected: (items: string[]) => void, value: string) => {
    if (selectedArray.includes(value)) {
      setSelected(selectedArray.filter(item => item !== value));
    } else {
      setSelected([...selectedArray, value]);
    }
  };

  // AI field suggestion
  const handleSuggestFields = async () => {
    if (!quickRequest.trim()) {
      toast({
        variant: "destructive",
        title: "Input required",
        description: "Please enter a quick request to suggest fields with AI."
      });
      return;
    }

    setIsSuggestingFields(true);
    try {
      // Use a simple extraction approach for now
      const request = quickRequest.toLowerCase();
      
      // Auto-suggest subject
      const subjectMatch = fieldOptions.subjects.find(s => 
        request.includes(s.toLowerCase()) || s.toLowerCase().includes(request.split(' ')[0])
      );
      if (subjectMatch) setSubject(subjectMatch);
      
      // Auto-suggest output format
      const formatMatch = fieldOptions.output_formats.find(f => 
        request.includes(f.toLowerCase())
      );
      if (formatMatch) setOutputFormat(formatMatch);
      
      // Auto-suggest some common constraints/styles based on keywords
      if (request.includes('professional') || request.includes('business')) {
        setSelectedStyles(['Professional']);
        setSelectedAudiences(['Professionals']);
      }
      if (request.includes('simple') || request.includes('beginner')) {
        setSelectedConstraints(['No jargon', 'Beginner level']);
        setSelectedAudiences(['Beginners']);
      }
      if (request.includes('academic') || request.includes('research')) {
        setSelectedStyles(['Academic']);
        setSelectedConstraints(['Academic tone']);
      }
      
      setShowSteps(true);
      
      toast({
        title: "Fields suggested!",
        description: "Review and adjust the suggested fields below."
      });
      
    } catch (error: any) {
      logger.error('Error suggesting fields', { error: error.message });
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to suggest fields. Please fill them manually."
      });
    } finally {
      setIsSuggestingFields(false);
    }
  };

  // Generate metaprompt
  const handleGenerateMetaprompt = async () => {
    if (!subject || !outputFormat) {
      toast({
        variant: "destructive",
        title: "Required fields missing",
        description: "Please select both Subject and Output Format."
      });
      return;
    }

    setIsGenerating(true);
    try {
      const request: GPT5MetapromptRequest = {
        subject,
        output_format: outputFormat,
        constraints: selectedConstraints,
        style: selectedStyles,
        audience: selectedAudiences,
        goal: selectedGoals,
        quick_request: quickRequest
      };

      const response = await callEdgeFunction('ai-gpt5-metaprompt', request);
      setGeneratedMetaprompt(response);
      
      toast({
        title: "Metaprompt generated!",
        description: "Your GPT-5 metaprompt is ready to use."
      });

    } catch (error: any) {
      logger.error('Error generating metaprompt', { error: error.message });
      toast({
        variant: "destructive",
        title: "Generation failed",
        description: "Failed to generate metaprompt. Please try again."
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

  return (
    <div className="space-y-6">
      {/* Step 0: Quick Request (Optional) */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-warm-gold" />
            Quick Start (Optional)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="quick-request">Describe what you want the metaprompt to do</Label>
            <Textarea
              id="quick-request"
              placeholder="e.g., I want to create professional emails for customer service..."
              value={quickRequest}
              onChange={(e) => setQuickRequest(e.target.value)}
              className="min-h-[80px]"
            />
          </div>
          <div className="flex gap-2">
            <Button 
              onClick={handleSuggestFields}
              disabled={isSuggestingFields || !quickRequest.trim()}
              className="mobile-button-primary"
            >
              {isSuggestingFields ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Suggesting...
                </>
              ) : (
                <>
                  <Wand2 className="h-4 w-4 mr-2" />
                  Suggest fields with AI
                </>
              )}
            </Button>
            <Button 
              variant="outline" 
              onClick={() => setShowSteps(true)}
              className="mobile-button-secondary"
            >
              Skip to manual setup
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Steps 1-3: Manual Configuration */}
      {showSteps && (
        <Card>
          <CardHeader>
            <CardTitle>Metaprompt Configuration</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Step 1: Subject */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Step 1: Subject *</Label>
              <Select value={subject} onValueChange={setSubject}>
                <SelectTrigger>
                  <SelectValue placeholder="Select what the metaprompt is about" />
                </SelectTrigger>
                <SelectContent>
                  {fieldOptions.subjects.map((option) => (
                    <SelectItem key={option} value={option}>{option}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Step 2: Output Format */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Step 2: Output Format *</Label>
              <Select value={outputFormat} onValueChange={setOutputFormat}>
                <SelectTrigger>
                  <SelectValue placeholder="Select the desired output format" />
                </SelectTrigger>
                <SelectContent>
                  {fieldOptions.output_formats.map((option) => (
                    <SelectItem key={option} value={option}>{option}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Separator />

            {/* Step 3: Additional Options */}
            <div className="space-y-4">
              <Label className="text-sm font-medium">Step 3: Additional Options (Optional)</Label>
              
              {/* Constraints */}
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Constraints</Label>
                <div className="flex flex-wrap gap-2">
                  {fieldOptions.constraints.map((constraint) => (
                    <Badge
                      key={constraint}
                      variant={selectedConstraints.includes(constraint) ? "default" : "outline"}
                      className="cursor-pointer hover:bg-warm-gold/20"
                      onClick={() => toggleSelection(selectedConstraints, setSelectedConstraints, constraint)}
                    >
                      {constraint}
                    </Badge>
                  ))}
                </div>
              </div>

              {/* Style */}
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Style</Label>
                <div className="flex flex-wrap gap-2">
                  {fieldOptions.styles.map((style) => (
                    <Badge
                      key={style}
                      variant={selectedStyles.includes(style) ? "default" : "outline"}
                      className="cursor-pointer hover:bg-warm-gold/20"
                      onClick={() => toggleSelection(selectedStyles, setSelectedStyles, style)}
                    >
                      {style}
                    </Badge>
                  ))}
                </div>
              </div>

              {/* Audience */}
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Audience</Label>
                <div className="flex flex-wrap gap-2">
                  {fieldOptions.audiences.map((audience) => (
                    <Badge
                      key={audience}
                      variant={selectedAudiences.includes(audience) ? "default" : "outline"}
                      className="cursor-pointer hover:bg-warm-gold/20"
                      onClick={() => toggleSelection(selectedAudiences, setSelectedAudiences, audience)}
                    >
                      {audience}
                    </Badge>
                  ))}
                </div>
              </div>

              {/* Goal */}
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Goal</Label>
                <div className="flex flex-wrap gap-2">
                  {fieldOptions.goals.map((goal) => (
                    <Badge
                      key={goal}
                      variant={selectedGoals.includes(goal) ? "default" : "outline"}
                      className="cursor-pointer hover:bg-warm-gold/20"
                      onClick={() => toggleSelection(selectedGoals, setSelectedGoals, goal)}
                    >
                      {goal}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>

            <Button 
              onClick={handleGenerateMetaprompt}
              disabled={isGenerating || !subject || !outputFormat}
              className="w-full mobile-button-primary"
              size="lg"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Generating metaprompt...
                </>
              ) : (
                <>
                  <Wand2 className="h-4 w-4 mr-2" />
                  Generate metaprompt
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Generated Results */}
      {generatedMetaprompt && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              Generated Metaprompt
              <Button variant="outline" size="sm">
                <Save className="h-4 w-4 mr-2" />
                Save as Template
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="template" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="template">Template</TabsTrigger>
                <TabsTrigger value="json">JSON</TabsTrigger>
              </TabsList>
              
              <TabsContent value="template" className="space-y-4">
                {/* English Template */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-medium">English Template</Label>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => copyToClipboard(generatedMetaprompt.metaprompt_template_english, "English Template")}
                    >
                      <Copy className="h-4 w-4 mr-2" />
                      Copy
                    </Button>
                  </div>
                  <div className="p-4 rounded-lg bg-muted border">
                    <pre className="whitespace-pre-wrap text-sm font-mono">
                      {generatedMetaprompt.metaprompt_template_english}
                    </pre>
                  </div>
                </div>

                {/* Arabic Template */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-medium">Arabic Template / القالب العربي</Label>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => copyToClipboard(generatedMetaprompt.metaprompt_template_arabic, "Arabic Template")}
                    >
                      <Copy className="h-4 w-4 mr-2" />
                      Copy
                    </Button>
                  </div>
                  <div className="p-4 rounded-lg bg-muted border">
                    <pre className="whitespace-pre-wrap text-sm font-mono" dir="rtl">
                      {generatedMetaprompt.metaprompt_template_arabic}
                    </pre>
                  </div>
                </div>
              </TabsContent>
              
              <TabsContent value="json" className="space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-medium">Structured JSON (English & Arabic)</Label>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => copyToClipboard(JSON.stringify(generatedMetaprompt.metaprompt_json, null, 2), "JSON")}
                    >
                      <Copy className="h-4 w-4 mr-2" />
                      Copy
                    </Button>
                  </div>
                  <div className="p-4 rounded-lg bg-muted border">
                    <pre className="whitespace-pre-wrap text-sm font-mono overflow-auto max-h-96">
                      {JSON.stringify(generatedMetaprompt.metaprompt_json, null, 2)}
                    </pre>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      )}
    </div>
  );
}