import React, { useState, useCallback, useMemo } from 'react';
import { Platform } from '@/types/platform';
import { BasePromptFields, PromptFormData, PromptFormStep } from '@/types/prompt-form';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, ArrowRight, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface PromptWizardProps {
  mode?: 'create' | 'edit';
  initialData?: Partial<PromptFormData>;
  onComplete: (data: PromptFormData) => Promise<void>;
  onCancel?: () => void;
  className?: string;
}

export function PromptWizard({
  mode = 'create',
  initialData,
  onComplete,
  onCancel,
  className
}: PromptWizardProps) {
  
  // Current step index (0-based)
  const [currentStep, setCurrentStep] = useState(0);
  
  // Selected platform
  const [selectedPlatform, setSelectedPlatform] = useState<Platform | null>(
    initialData?.platform_id ? null : null // Will load from initialData in Phase 3.5
  );

  // Base fields state
  const [baseFields, setBaseFields] = useState<BasePromptFields>({
    title: initialData?.title || '',
    title_ar: initialData?.title_ar || '',
    prompt_text: initialData?.prompt_text || '',
    prompt_text_ar: initialData?.prompt_text_ar || '',
    category_id: initialData?.category_id || '',
    thumbnail: null,
    thumbnail_url: initialData?.thumbnail_url || ''
  });

  // Platform-specific fields state
  const [platformFields, setPlatformFields] = useState<Record<string, any>>(
    initialData?.platform_fields || {}
  );

  // Step validation states
  const [stepErrors, setStepErrors] = useState<Record<number, string[]>>({});
  
  // Submission state
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Define wizard steps
  const steps: PromptFormStep[] = useMemo(() => [
    {
      id: 'platform',
      title: 'Select Platform',
      description: 'Choose the AI platform or tool',
      isComplete: !!selectedPlatform
    },
    {
      id: 'base-fields',
      title: 'Basic Information',
      description: 'Add title, description, and category',
      isComplete: !!(baseFields.title && baseFields.prompt_text)
    },
    {
      id: 'platform-fields',
      title: 'Platform Configuration',
      description: selectedPlatform 
        ? `Configure ${selectedPlatform.name} settings`
        : 'Configure platform-specific options',
      isComplete: selectedPlatform ? true : false // Will validate properly later
    },
    {
      id: 'preview',
      title: 'Review & Submit',
      description: 'Preview your prompt before creating',
      isComplete: false
    }
  ], [selectedPlatform, baseFields]);

  // Navigation handlers
  const canGoNext = useMemo(() => {
    const step = steps[currentStep];
    
    switch (step.id) {
      case 'platform':
        return !!selectedPlatform;
      case 'base-fields':
        return !!(baseFields.title.trim() && baseFields.prompt_text.trim());
      case 'platform-fields':
        return true; // Will add proper validation in Phase 3.3
      case 'preview':
        return true;
      default:
        return false;
    }
  }, [currentStep, steps, selectedPlatform, baseFields]);

  const canGoBack = currentStep > 0;

  const handleNext = useCallback(() => {
    if (canGoNext && currentStep < steps.length - 1) {
      setCurrentStep(prev => prev + 1);
      setStepErrors(prev => ({ ...prev, [currentStep]: [] }));
    }
  }, [canGoNext, currentStep, steps.length]);

  const handleBack = useCallback(() => {
    if (canGoBack) {
      setCurrentStep(prev => prev - 1);
    }
  }, [canGoBack]);

  const handleStepClick = useCallback((stepIndex: number) => {
    // Allow clicking on previous steps or completed steps
    if (stepIndex < currentStep || steps[stepIndex].isComplete) {
      setCurrentStep(stepIndex);
    }
  }, [currentStep, steps]);

  const handleSubmit = useCallback(async () => {
    if (!selectedPlatform) return;

    const formData: PromptFormData = {
      ...baseFields,
      platform_id: selectedPlatform.id,
      platform_fields: platformFields
    };

    setIsSubmitting(true);
    try {
      await onComplete(formData);
    } catch (error) {
      console.error('Submission error:', error);
      // Handle error (will add error display in Phase 3.4)
    } finally {
      setIsSubmitting(false);
    }
  }, [selectedPlatform, baseFields, platformFields, onComplete]);

  return (
    <div className={cn("space-y-6", className)}>
      {/* Progress Steps Indicator */}
      <StepIndicator
        steps={steps}
        currentStep={currentStep}
        onStepClick={handleStepClick}
      />

      {/* Step Content */}
      <Card className="p-6 min-h-[500px]">
        {/* Step 1: Platform Selection */}
        {currentStep === 0 && (
          <div>
            <h2 className="text-2xl font-semibold mb-2">{steps[0].title}</h2>
            <p className="text-muted-foreground mb-6">{steps[0].description}</p>
            
            {/* Platform selector will be added here */}
            <div className="text-center py-12 text-muted-foreground">
              Platform Selector Component (will be integrated)
            </div>
          </div>
        )}

        {/* Step 2: Base Fields */}
        {currentStep === 1 && (
          <div>
            <h2 className="text-2xl font-semibold mb-2">{steps[1].title}</h2>
            <p className="text-muted-foreground mb-6">{steps[1].description}</p>
            
            {/* Base fields will be added here */}
            <div className="text-center py-12 text-muted-foreground">
              Base Prompt Fields Component (will be integrated)
            </div>
          </div>
        )}

        {/* Step 3: Platform Fields */}
        {currentStep === 2 && (
          <div>
            <h2 className="text-2xl font-semibold mb-2">{steps[2].title}</h2>
            <p className="text-muted-foreground mb-6">{steps[2].description}</p>
            
            {/* Dynamic fields will be added here */}
            <div className="text-center py-12 text-muted-foreground">
              Dynamic Platform Fields Component (will be integrated)
            </div>
          </div>
        )}

        {/* Step 4: Preview */}
        {currentStep === 3 && (
          <div>
            <h2 className="text-2xl font-semibold mb-2">{steps[3].title}</h2>
            <p className="text-muted-foreground mb-6">{steps[3].description}</p>
            
            {/* Preview will be added in Phase 3.3 */}
            <div className="text-center py-12 text-muted-foreground">
              Preview Component (will be added in Phase 3.3)
            </div>
          </div>
        )}
      </Card>

      {/* Navigation Buttons */}
      <div className="flex justify-between items-center">
        <div>
          {onCancel && (
            <Button
              type="button"
              variant="ghost"
              onClick={onCancel}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
          )}
        </div>

        <div className="flex gap-3">
          {canGoBack && (
            <Button
              type="button"
              variant="outline"
              onClick={handleBack}
              disabled={isSubmitting}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
          )}

          {currentStep < steps.length - 1 ? (
            <Button
              type="button"
              onClick={handleNext}
              disabled={!canGoNext || isSubmitting}
            >
              Next
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          ) : (
            <Button
              type="button"
              onClick={handleSubmit}
              disabled={!canGoNext || isSubmitting}
            >
              {isSubmitting ? 'Creating...' : mode === 'edit' ? 'Update Prompt' : 'Create Prompt'}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

// Step Indicator Component
interface StepIndicatorProps {
  steps: PromptFormStep[];
  currentStep: number;
  onStepClick: (index: number) => void;
}

function StepIndicator({ steps, currentStep, onStepClick }: StepIndicatorProps) {
  return (
    <nav aria-label="Progress">
      <ol className="flex items-center justify-between">
        {steps.map((step, index) => {
          const isActive = index === currentStep;
          const isCompleted = step.isComplete;
          const isPast = index < currentStep;
          const isClickable = isPast || isCompleted;

          return (
            <li key={step.id} className="relative flex-1">
              {/* Connector Line */}
              {index !== 0 && (
                <div
                  className={cn(
                    "absolute top-5 -left-1/2 w-full h-0.5 -translate-y-1/2",
                    isPast || isCompleted ? "bg-primary" : "bg-muted"
                  )}
                  aria-hidden="true"
                />
              )}

              {/* Step Button */}
              <button
                type="button"
                onClick={() => isClickable && onStepClick(index)}
                disabled={!isClickable}
                className={cn(
                  "relative flex flex-col items-center group w-full",
                  isClickable ? "cursor-pointer" : "cursor-not-allowed"
                )}
                aria-current={isActive ? "step" : undefined}
              >
                {/* Step Circle */}
                <span
                  className={cn(
                    "flex h-10 w-10 items-center justify-center rounded-full border-2 transition-all",
                    isActive && "border-primary bg-primary text-primary-foreground shadow-lg scale-110",
                    isCompleted && !isActive && "border-primary bg-primary text-primary-foreground",
                    !isActive && !isCompleted && "border-muted bg-background text-muted-foreground",
                    isClickable && !isActive && "hover:border-primary/50 hover:bg-primary/10"
                  )}
                >
                  {isCompleted && !isActive ? (
                    <Check className="h-5 w-5" aria-hidden="true" />
                  ) : (
                    <span className="text-sm font-semibold">{index + 1}</span>
                  )}
                </span>

                {/* Step Label */}
                <span className="mt-2 text-center">
                  <span
                    className={cn(
                      "block text-xs font-medium transition-colors",
                      isActive && "text-primary",
                      !isActive && "text-muted-foreground"
                    )}
                  >
                    {step.title}
                  </span>
                  <span className="hidden sm:block text-xs text-muted-foreground mt-0.5">
                    {step.description}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
