
import React from "react";
import { ImageWrapper } from "@/components/ui/prompt-card/ImageWrapper";
import { Workflow } from "lucide-react";
import { getMediaTypeIcon } from "../utils/categoryUtils";

export function CardContent({
  title,
  imageUrl,
  isSmallMobile,
  prompt_text,
  isN8nWorkflow,
  workflowSteps,
  mediaFiles
}: {
  title: string;
  imageUrl: string;
  isSmallMobile: boolean;
  prompt_text: string;
  isN8nWorkflow: boolean;
  workflowSteps: any[];
  mediaFiles: any[];
}) {
  return (
    <>
      <h3 className="text-gray-900 font-bold leading-tight flex-shrink-0">
        <span className={
          isSmallMobile ? "block text-sm min-h-[2rem] line-clamp-2" : "block text-base sm:text-lg lg:text-xl min-h-[2.5rem] sm:min-h-[3rem] line-clamp-2"
        }>
          {title}
        </span>
      </h3>
      <div className="relative overflow-hidden rounded-xl bg-white/50 flex-shrink-0">
        <div className={
          isSmallMobile ? "aspect-[4/3]" : "aspect-video sm:aspect-square"
        }>
          <ImageWrapper
            src={imageUrl}
            alt={title}
            aspect={1}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
          />
        </div>
        {mediaFiles.length > 1 && (
          <div className="absolute top-1 sm:top-2 right-1 sm:right-2 bg-black/70 text-white text-xs px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-full">
            +{mediaFiles.length - 1} files
          </div>
        )}
        {mediaFiles.length > 0 && mediaFiles[0].type !== 'image' && (
          <div className="absolute bottom-1 sm:bottom-2 left-1 sm:left-2 bg-black/70 p-1 sm:p-1.5 lg:p-2 rounded-full">
            {getMediaTypeIcon(mediaFiles[0])}
          </div>
        )}
      </div>
      {isN8nWorkflow && workflowSteps.length > 0 ? (
        <div className="flex-grow space-y-1 sm:space-y-2">
          <div className="space-y-1">
            <h4 className="text-xs sm:text-sm font-semibold text-gray-800 flex items-center gap-1 sm:gap-2">
              <Workflow className="h-3 w-3 sm:h-4 sm:w-4 text-blue-600" />
              Workflow Steps
            </h4>
            <div className="space-y-1">
              {workflowSteps.slice(0, isSmallMobile ? 1 : 2).map((step, index) => (
                <div key={index} className="flex items-start gap-1 sm:gap-2 text-xs">
                  <span className="flex-shrink-0 w-4 h-4 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center font-medium text-xs">
                    {index + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-700 truncate text-xs">{step.name}</p>
                    <p className="text-gray-500 line-clamp-1 text-xs">{step.description}</p>
                  </div>
                </div>
              ))}
              {workflowSteps.length > (isSmallMobile ? 1 : 2) && (
                <p className="text-xs text-gray-500 pl-5 sm:pl-6">
                  +{workflowSteps.length - (isSmallMobile ? 1 : 2)} more steps
                </p>
              )}
            </div>
          </div>
        </div>
      ) : (
        <p className={
          isSmallMobile 
            ? "text-xs text-gray-600 line-clamp-2 leading-relaxed flex-grow"
            : "text-sm text-gray-600 line-clamp-2 sm:line-clamp-3 leading-relaxed flex-grow"
        }>
          {prompt_text}
        </p>
      )}
    </>
  );
}
