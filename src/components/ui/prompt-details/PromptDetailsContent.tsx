
import { Badge } from "@/components/ui/badge";
import { Workflow } from "lucide-react";
import { MediaThumbnail } from "./MediaThumbnail";
import { WorkflowDownloadSection } from "@/components/ui/workflow-download-section";

interface PromptDetailsContentProps {
  imageUrl: string;
  title: string;
  mediaFiles: Array<{ type: string; path: string; name: string }>;
  isN8nWorkflow: boolean;
  workflowSteps: Array<{ name: string; description: string; type?: string }>;
  workflowFiles: Array<{ type: 'json' | 'zip'; path: string; name: string }>;
  prompt_text: string;
  model: string;
  useCase?: string;
  style?: string;
  tags: string[];
  onMediaClick: (index: number) => void;
}

export function PromptDetailsContent({
  imageUrl,
  title,
  mediaFiles,
  isN8nWorkflow,
  workflowSteps,
  workflowFiles,
  prompt_text,
  model,
  useCase,
  style,
  tags,
  onMediaClick
}: PromptDetailsContentProps) {
  return (
    <div className="bg-white/40 p-4 sm:p-6 rounded-xl border border-gray-200 space-y-6">
      {/* Main Image */}
      <div 
        className="relative overflow-hidden rounded-xl aspect-square bg-white/50 cursor-pointer hover:opacity-90 transition-opacity"
        onClick={() => onMediaClick(0)}
      >
        <img
          src={imageUrl}
          alt={title}
          className="w-full h-full object-contain"
        />
        <div className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity bg-black/20">
          <span className="text-white text-sm font-medium bg-black/50 px-3 py-1 rounded-lg">
            Click to expand
          </span>
        </div>
      </div>

      {/* Media Files Grid */}
      {mediaFiles.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-3">Media Files ({mediaFiles.length})</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {mediaFiles.map((media, index) => (
              <MediaThumbnail
                key={index}
                media={media}
                index={index}
                onClick={() => onMediaClick(index)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Workflow Steps Section for n8n prompts */}
      {isN8nWorkflow && workflowSteps.length > 0 ? (
        <div>
          <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
            <Workflow className="h-5 w-5 text-blue-600" />
            Workflow Steps ({workflowSteps.length})
          </h3>
          <div className="space-y-4 max-h-80 overflow-y-auto">
            {workflowSteps.map((step: any, index: number) => (
              <div key={index} className="flex items-start gap-3 p-4 bg-gray-50 rounded-lg border">
                <span className="flex-shrink-0 w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center font-semibold text-sm">
                  {index + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <h4 className="font-semibold text-gray-900 mb-1">{step.name}</h4>
                  <p className="text-gray-700 text-sm leading-relaxed">{step.description}</p>
                  {step.type && (
                    <Badge variant="outline" className="mt-2 bg-blue-100 text-blue-800 border-blue-200">
                      {step.type}
                    </Badge>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        /* Show prompt text for non-workflow prompts */
        <div>
          <h3 className="text-xl font-bold text-gray-900 mb-4">Prompt Text</h3>
          <div className="bg-gray-50 p-4 rounded-lg border max-h-60 overflow-y-auto">
            <p className="text-gray-800 text-sm leading-relaxed whitespace-pre-wrap">
              {prompt_text}
            </p>
          </div>
        </div>
      )}

      {/* Workflow Files Download Section for n8n prompts */}
      {isN8nWorkflow && workflowFiles.length > 0 && (
        <WorkflowDownloadSection workflowFiles={workflowFiles} />
      )}

      {/* Tags */}
      <div className="flex flex-wrap gap-2">
        <Badge variant="secondary" className="bg-white/60 text-gray-700 border-gray-200">
          {model}
        </Badge>
        {useCase && (
          <Badge variant="secondary" className="bg-white/60 text-gray-700 border-gray-200">
            {useCase}
          </Badge>
        )}
        {style && (
          <Badge variant="secondary" className="bg-white/60 text-gray-700 border-gray-200">
            {style}
          </Badge>
        )}
        {tags.slice(0, 4).map((tag, i) => (
          <Badge
            key={i}
            variant="secondary"
            className="bg-white/60 text-gray-700 border-gray-200"
          >
            {tag}
          </Badge>
        ))}
        {tags.length > 4 && (
          <Badge variant="secondary" className="bg-white/60 text-gray-500 border-gray-200">
            +{tags.length - 4} more
          </Badge>
        )}
      </div>
    </div>
  );
}
