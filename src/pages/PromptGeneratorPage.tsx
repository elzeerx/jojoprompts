import { useState } from "react";
import { Container } from "@/components/ui/container";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";
import { Navigate } from "react-router-dom";
import { PromptGeneratorForm } from "@/components/prompt-generator/PromptGeneratorForm";
import { ModelManager } from "@/components/prompt-generator/ModelManager";
import { FieldManager } from "@/components/prompt-generator/FieldManager";
import { TemplateManager } from "@/components/prompt-generator/TemplateManager";
import { Wand2, Settings, Database, BookOpen } from "lucide-react";

export default function PromptGeneratorPage() {
  const { canManagePrompts, loading } = useAuth();
  const [activeTab, setActiveTab] = useState("generator");

  if (loading) {
    return (
      <div className="min-h-screen bg-soft-bg/30 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-warm-gold mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!canManagePrompts) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="min-h-screen bg-soft-bg/30">
      <Container className="py-4 sm:py-6 lg:py-8">
        <div className="mb-4 sm:mb-6 lg:mb-8">
          <h1 className="section-title text-xl sm:text-2xl lg:text-3xl text-dark-base">
            Prompt Generator
          </h1>
          <p className="text-muted-foreground text-xs sm:text-sm lg:text-base mt-1 sm:mt-2">
            Generate AI prompts for images and videos with dynamic management capabilities
          </p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <div className="mb-4 sm:mb-6">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="generator" className="flex items-center gap-2">
                <Wand2 className="h-4 w-4" />
                <span className="hidden sm:inline">Generator</span>
              </TabsTrigger>
              <TabsTrigger value="models" className="flex items-center gap-2">
                <Settings className="h-4 w-4" />
                <span className="hidden sm:inline">Models</span>
              </TabsTrigger>
              <TabsTrigger value="fields" className="flex items-center gap-2">
                <Database className="h-4 w-4" />
                <span className="hidden sm:inline">Fields</span>
              </TabsTrigger>
              <TabsTrigger value="templates" className="flex items-center gap-2">
                <BookOpen className="h-4 w-4" />
                <span className="hidden sm:inline">Templates</span>
              </TabsTrigger>
            </TabsList>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <TabsContent value="generator" className="m-0">
              <Card className="border-0 shadow-none">
                <CardHeader>
                  <CardTitle className="text-dark-base">AI Prompt Generator</CardTitle>
                  <CardDescription>
                    Create structured prompts for various AI models with dynamic field configuration
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <PromptGeneratorForm />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="models" className="m-0">
              <Card className="border-0 shadow-none">
                <CardHeader>
                  <CardTitle className="text-dark-base">Model Management</CardTitle>
                  <CardDescription>
                    Add, edit, and configure AI models for prompt generation
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ModelManager />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="fields" className="m-0">
              <Card className="border-0 shadow-none">
                <CardHeader>
                  <CardTitle className="text-dark-base">Field Management</CardTitle>
                  <CardDescription>
                    Manage dropdown options and field types for prompt generation
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <FieldManager />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="templates" className="m-0">
              <Card className="border-0 shadow-none">
                <CardHeader>
                  <CardTitle className="text-dark-base">Template Management</CardTitle>
                  <CardDescription>
                    Save and manage prompt templates for quick reuse
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <TemplateManager />
                </CardContent>
              </Card>
            </TabsContent>
          </div>
        </Tabs>
      </Container>
    </div>
  );
}