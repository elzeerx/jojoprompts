import React from 'react';
import { PromptFormStep } from '@/types/prompt-form';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface StepIndicatorProps {
  steps: PromptFormStep[];
  currentStep: number;
  onStepClick?: (stepIndex: number) => void;
  className?: string;
}

export function StepIndicator({
  steps,
  currentStep,
  onStepClick,
  className
}: StepIndicatorProps) {
  
  return (
    <div className={cn("w-full", className)}>
      {/* Desktop: Horizontal stepper */}
      <div className="hidden md:flex items-center justify-between">
        {steps.map((step, index) => {
          const isActive = index === currentStep;
          const isComplete = step.isComplete;
          const isPast = index < currentStep;
          const isClickable = (isPast || isComplete) && onStepClick;

          return (
            <React.Fragment key={step.id}>
              {/* Step Circle */}
              <div className="flex flex-col items-center flex-1">
                <button
                  type="button"
                  onClick={() => isClickable && onStepClick(index)}
                  disabled={!isClickable}
                  className={cn(
                    "relative flex items-center justify-center w-10 h-10 rounded-full border-2 transition-all",
                    isActive && "border-primary bg-primary text-primary-foreground shadow-lg scale-110",
                    isComplete && !isActive && "border-primary bg-primary text-primary-foreground",
                    !isActive && !isComplete && "border-muted bg-background text-muted-foreground",
                    isClickable && "cursor-pointer hover:border-primary/50 hover:bg-primary/10",
                    !isClickable && "cursor-default"
                  )}
                  aria-current={isActive ? 'step' : undefined}
                >
                  {isComplete && !isActive ? (
                    <Check className="h-5 w-5" />
                  ) : (
                    <span className="text-sm font-semibold">{index + 1}</span>
                  )}
                </button>

                {/* Step Label */}
                <div className="mt-2 text-center max-w-[120px]">
                  <p className={cn(
                    "text-sm font-medium transition-colors",
                    isActive && "text-primary",
                    !isActive && "text-muted-foreground"
                  )}>
                    {step.title}
                  </p>
                  {isActive && (
                    <p className="text-xs text-muted-foreground mt-1">
                      {step.description}
                    </p>
                  )}
                </div>
              </div>

              {/* Connector Line */}
              {index < steps.length - 1 && (
                <div className={cn(
                  "h-0.5 flex-1 mx-2 transition-all",
                  isPast || isComplete ? "bg-primary" : "bg-muted"
                )} />
              )}
            </React.Fragment>
          );
        })}
      </div>

      {/* Mobile: Compact stepper */}
      <div className="md:hidden">
        <div className="flex items-center gap-2 mb-4">
          {steps.map((step, index) => (
            <div
              key={step.id}
              className={cn(
                "h-2 flex-1 rounded-full transition-all",
                index === currentStep && "bg-primary",
                index < currentStep && "bg-primary",
                index > currentStep && "bg-muted"
              )}
            />
          ))}
        </div>
        
        <div className="text-center">
          <p className="text-sm font-medium">{steps[currentStep].title}</p>
          <p className="text-xs text-muted-foreground mt-1">
            Step {currentStep + 1} of {steps.length}
          </p>
          {steps[currentStep].description && (
            <p className="text-xs text-muted-foreground mt-1">
              {steps[currentStep].description}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
