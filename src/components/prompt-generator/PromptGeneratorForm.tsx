import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Copy, Download, Save, Wand2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { usePromptGenerator } from "@/hooks/prompt-generator/usePromptGenerator";
import { DynamicField } from "./DynamicField";
import { ModelParametersEditor } from "./ModelParametersEditor";
import { PromptPreview } from "./PromptPreview";

const promptSchema = z.object({
  modelType: z.enum(["image", "video"]),
  selectedModel: z.string().min(1, "Please select a model"),
  style: z.record(z.string(), z.any()).optional(),
  subject: z.record(z.string(), z.any()).optional(),
  effects: z.record(z.string(), z.any()).optional(),
  customPrompt: z.string().optional(),
  modelParameters: z.record(z.string(), z.any()).optional(),
});

type PromptFormData = z.infer<typeof promptSchema>;

export function PromptGeneratorForm() {
  const { toast } = useToast();
  const {
    models,
    fields,
    generatePrompt,
    saveTemplate,
    loading
  } = usePromptGenerator();

  const [outputMode, setOutputMode] = useState<"text" | "json">("text");
  const [generatedPrompt, setGeneratedPrompt] = useState<string>("");
  const [promptData, setPromptData] = useState<any>(null);

  const form = useForm<PromptFormData>({
    resolver: zodResolver(promptSchema),
    defaultValues: {
      modelType: "image",
      selectedModel: "",
      style: {},
      subject: {},
      effects: {},
      customPrompt: "",
      modelParameters: {},
    },
  });

  const selectedModelType = form.watch("modelType");
  const selectedModelId = form.watch("selectedModel");

  const filteredModels = models.filter(model => 
    model.type === selectedModelType && model.is_active
  );

  const selectedModel = models.find(model => model.id === selectedModelId);

  const onSubmit = async (data: PromptFormData) => {
    try {
      const result = await generatePrompt(data);
      setGeneratedPrompt(result.prompt);
      setPromptData(result.data);
      
      toast({
        title: "Prompt Generated",
        description: "Your AI prompt has been generated successfully.",
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Generation Failed",
        description: "Failed to generate prompt. Please try again.",
      });
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(
        outputMode === "json" ? JSON.stringify(promptData, null, 2) : generatedPrompt
      );
      toast({
        title: "Copied",
        description: "Prompt copied to clipboard.",
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Copy Failed",
        description: "Failed to copy to clipboard.",
      });
    }
  };

  const handleSaveTemplate = async () => {
    if (!generatedPrompt || !promptData) {
      toast({
        variant: "destructive",
        title: "No Prompt",
        description: "Please generate a prompt first.",
      });
      return;
    }

    try {
      await saveTemplate({
        name: `${selectedModel?.name || "Custom"} Template`,
        description: "Generated template",
        template_data: promptData,
        model_type: selectedModelType,
        is_public: false,
      });

      toast({
        title: "Template Saved",
        description: "Your prompt template has been saved.",
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Save Failed",
        description: "Failed to save template.",
      });
    }
  };

  const handleDownload = () => {
    const content = outputMode === "json" 
      ? JSON.stringify(promptData, null, 2)
      : generatedPrompt;
    
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `prompt-${Date.now()}.${outputMode === "json" ? "json" : "txt"}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Get fields by category for the selected model type
  const getFieldsByCategory = (category: string) => {
    return fields.filter(field => 
      field.field_category === category && field.is_active
    ).sort((a, b) => a.display_order - b.display_order);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Input Form */}
      <div className="space-y-6">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Model Selection */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Model Selection</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField
                  control={form.control}
                  name="modelType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Model Type</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select model type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="image">Image Generation</SelectItem>
                          <SelectItem value="video">Video Generation</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="selectedModel"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>AI Model</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select AI model" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {filteredModels.map((model) => (
                            <SelectItem key={model.id} value={model.id}>
                              {model.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            {/* Style Fields */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Style</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {getFieldsByCategory("style").map((field) => (
                  <DynamicField
                    key={field.id}
                    field={field}
                    form={form}
                    fieldPath={`style.${field.field_name}`}
                  />
                ))}
              </CardContent>
            </Card>

            {/* Subject Fields */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Subject</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {getFieldsByCategory("subject").map((field) => (
                  <DynamicField
                    key={field.id}
                    field={field}
                    form={form}
                    fieldPath={`subject.${field.field_name}`}
                  />
                ))}
                
                <FormField
                  control={form.control}
                  name="customPrompt"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Custom Subject Description</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Add custom subject details..."
                          {...field}
                          rows={3}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            {/* Effects Fields */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Effects & Modifiers</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {getFieldsByCategory("effects").map((field) => (
                  <DynamicField
                    key={field.id}
                    field={field}
                    form={form}
                    fieldPath={`effects.${field.field_name}`}
                  />
                ))}
              </CardContent>
            </Card>

            {/* Model Parameters */}
            {selectedModel && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Model Parameters</CardTitle>
                </CardHeader>
                <CardContent>
                  <ModelParametersEditor
                    model={selectedModel}
                    form={form}
                    fieldPath="modelParameters"
                  />
                </CardContent>
              </Card>
            )}

            <Button 
              type="submit" 
              className="w-full mobile-button-primary"
              disabled={loading}
            >
              <Wand2 className="mr-2 h-4 w-4" />
              {loading ? "Generating..." : "Generate Prompt"}
            </Button>
          </form>
        </Form>
      </div>

      {/* Output Preview */}
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <CardTitle className="text-lg">Generated Prompt</CardTitle>
              <Tabs value={outputMode} onValueChange={(value) => setOutputMode(value as "text" | "json")}>
                <TabsList>
                  <TabsTrigger value="text">Text</TabsTrigger>
                  <TabsTrigger value="json">JSON</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
          </CardHeader>
          <CardContent>
            {generatedPrompt ? (
              <div className="space-y-4">
                <PromptPreview
                  prompt={generatedPrompt}
                  data={promptData}
                  mode={outputMode}
                />
                
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleCopy}
                    className="flex-1 min-w-0"
                  >
                    <Copy className="mr-2 h-4 w-4" />
                    Copy
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleDownload}
                    className="flex-1 min-w-0"
                  >
                    <Download className="mr-2 h-4 w-4" />
                    Download
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleSaveTemplate}
                    className="flex-1 min-w-0"
                  >
                    <Save className="mr-2 h-4 w-4" />
                    Save Template
                  </Button>
                </div>
              </div>
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                <Wand2 className="mx-auto h-12 w-12 mb-4 opacity-50" />
                <p>Generate a prompt to see the output here</p>
              </div>
            )}
          </CardContent>
        </Card>

        {selectedModel && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Model Information</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="font-medium">Model:</span>
                  <Badge variant="secondary">{selectedModel.name}</Badge>
                </div>
                <div className="flex justify-between">
                  <span className="font-medium">Type:</span>
                  <Badge variant="outline">{selectedModel.type}</Badge>
                </div>
                {Object.keys(selectedModel.parameters as object).length > 0 && (
                  <div>
                    <span className="font-medium">Available Parameters:</span>
                    <div className="mt-2 flex flex-wrap gap-1">
                      {Object.keys(selectedModel.parameters as object).map((param) => (
                        <Badge key={param} variant="outline" className="text-xs">
                          {param}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}