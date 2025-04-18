
import { Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function AiHelpers() {
  return (
    <div className="grid gap-6 md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Generate Metadata</CardTitle>
          <CardDescription>
            Analyze prompt text to generate tags, categories, and styles
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button className="w-full">
            <Zap className="mr-2 h-4 w-4" />
            Run Metadata Generator
          </Button>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader>
          <CardTitle>Suggest New Prompt</CardTitle>
          <CardDescription>
            Generate a fresh prompt based on existing ones
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button className="w-full">
            <Zap className="mr-2 h-4 w-4" />
            Generate Prompt Suggestion
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
