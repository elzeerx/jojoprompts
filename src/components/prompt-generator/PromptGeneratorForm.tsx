import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Copy, Wand2, Sparkles } from "lucide-react";
import { GPT5MetaPromptTab } from "./GPT5MetaPromptTab";
import { MidjourneySrefTab } from "./MidjourneySrefTab";
import { JsonSpecTab } from "./JsonSpecTab";


export function PromptGeneratorForm() {
  const [activeGeneratorTab, setActiveGeneratorTab] = useState("gpt5-metaprompt");

  return (
    <Card className="border-0 shadow-none">
      <CardHeader>
        <CardTitle className="text-dark-base">AI Prompt Generator</CardTitle>
        <CardDescription>
          Generate GPT-5 metaprompts, Midjourney style references, or JSON specifications for video/image services
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs value={activeGeneratorTab} onValueChange={setActiveGeneratorTab}>
          <TabsList className="grid w-full grid-cols-3 mb-6">
            <TabsTrigger value="gpt5-metaprompt" className="flex items-center gap-2">
              <Wand2 className="h-4 w-4" />
              <span className="hidden sm:inline">GPT-5 Meta Prompt</span>
              <span className="sm:hidden">GPT-5</span>
            </TabsTrigger>
            <TabsTrigger value="midjourney-sref" className="flex items-center gap-2">
              <Sparkles className="h-4 w-4" />
              <span className="hidden sm:inline">Midjourney SREF</span>
              <span className="sm:hidden">SREF</span>
            </TabsTrigger>
            <TabsTrigger value="json-spec" className="flex items-center gap-2">
              <Copy className="h-4 w-4" />
              <span className="hidden sm:inline">JSON Code</span>
              <span className="sm:hidden">JSON</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="gpt5-metaprompt">
            <GPT5MetaPromptTab />
          </TabsContent>

          <TabsContent value="midjourney-sref">
            <MidjourneySrefTab />
          </TabsContent>

          <TabsContent value="json-spec">
            <JsonSpecTab />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
