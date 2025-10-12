import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { Platform } from '@/types/platform';
import { BasePromptFields, PromptFormData, PromptFormStep } from '@/types/prompt-form';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, ArrowRight, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { StepIndicator } from './StepIndicator';
import { PlatformSelector } from './PlatformSelector';
import { BasePromptFieldsSection } from './BasePromptFields';
import { DynamicFieldGroup } from './fields/DynamicFieldGroup';
import { PromptPreview } from './PromptPreview';
import { SubmissionOverlay } from './SubmissionOverlay';
import { useCategories } from '@/hooks/useCategories';
import { usePlatformWithFields } from '@/hooks/usePlatforms';
import { useKeyboardNavigation } from '@/hooks/useKeyboardNavigation';
import { usePromptSubmission } from '@/hooks/usePromptSubmission';
import { usePromptLoader } from '@/hooks/usePromptLoader';

export interface PromptWizardProps {
  mode?: 'create' | 'edit';
  promptId?: string; // For edit mode
  initialData?: Partial<PromptFormData>;
  onComplete: (data: PromptFormData) => Promise<void>;
  onCancel?: () => void;
  className?: string;
}

export function PromptWizard({
  mode = 'create',
  promptId,
  initialData,
  onComplete,
  onCancel,
  className
}: PromptWizardProps) {
  
  // Load prompt data if in edit mode
  const {
    data: loadedData,
    formData: loadedFormData,
    loading: loadingPrompt,
    error: loadError
  } = usePromptLoader(mode === 'edit' ? promptId : undefined);

  // Current step index (0-based)
  const [currentStep, setCurrentStep] = useState(0);
  
  // Selected platform
  const [selectedPlatform, setSelectedPlatform] = useState<Platform | null>(null);

  // Base fields state
  const [baseFields, setBaseFields] = useState<BasePromptFields>({
    title: '',
    title_ar: '',
    prompt_text: '',
    prompt_text_ar: '',
    category_id: '',
    thumbnail: null,
    thumbnail_url: ''
  });

  // Platform-specific fields state
  const [platformFields, setPlatformFields] = useState<Record<string, any>>({});

  // Step validation states
  const [stepErrors, setStepErrors] = useState<Record<number, string[]>>({});

  // Track if form has been initialized from loaded data
  const [isInitialized, setIsInitialized] = useState(false);

  // Initialize form when data loads
  useEffect(() => {
    if (mode === 'edit' && loadedData && loadedFormData && !isInitialized) {
      // Set platform
      if (loadedData.platform) {
        setSelectedPlatform(loadedData.platform);
      }

      // Set base fields
      setBaseFields({
        title: loadedFormData.title,
        title_ar: loadedFormData.title_ar || '',
        prompt_text: loadedFormData.prompt_text,
        prompt_text_ar: loadedFormData.prompt_text_ar || '',
        category_id: loadedFormData.category_id || '',
        thumbnail: null,
        thumbnail_url: loadedFormData.thumbnail_url || ''
      });

      // Set platform fields
      setPlatformFields(loadedFormData.platform_fields);

      // Start on step 1 (base fields) in edit mode since platform is already set
      setCurrentStep(1);
      
      setIsInitialized(true);
    } else if (mode === 'create' && initialData && !isInitialized) {
      // Handle initial data for create mode
      if (initialData.title) {
        setBaseFields(prev => ({
          ...prev,
          title: initialData.title || '',
          title_ar: initialData.title_ar || '',
          prompt_text: initialData.prompt_text || '',
          prompt_text_ar: initialData.prompt_text_ar || '',
          category_id: initialData.category_id || '',
          thumbnail_url: initialData.thumbnail_url || ''
        }));
      }
      if (initialData.platform_fields) {
        setPlatformFields(initialData.platform_fields);
      }
      setIsInitialized(true);
    }
  }, [mode, loadedData, loadedFormData, initialData, isInitialized]);

  // Categories for base fields
  const { categories, createCategory } = useCategories();

  // Platform fields
  const { data: platformWithFields, isLoading: fieldsLoading } = usePlatformWithFields(
    selectedPlatform?.id || ''
  );
  const platformFieldsList = platformWithFields?.fields || [];

  // Submission hook
  const {
    submit,
    isSubmitting,
    validationErrors,
    clearValidationErrors
  } = usePromptSubmission({
    mode,
    existingPromptId: promptId,
    existingThumbnailUrl: baseFields.thumbnail_url,
    platformFields: platformFieldsList,
    onSuccess: async (promptId) => {
      console.log('Prompt saved with ID:', promptId);
      await onComplete({
        ...baseFields,
        platform_id: selectedPlatform!.id,
        platform_fields: platformFields
      });
    },
    onError: (error) => {
      console.error('Failed to save prompt:', error);
    }
  });

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

    const result = await submit(formData);
    
    if (result.success) {
      // Success handled by onSuccess callback
    }
  }, [selectedPlatform, baseFields, platformFields, submit]);

  // Keyboard navigation
  useKeyboardNavigation({
    onNext: handleNext,
    onBack: handleBack,
    canGoNext,
    canGoBack,
    enabled: !isSubmitting
  });

  // Show loading state while fetching data
  if (mode === 'edit' && loadingPrompt) {
    return (
      <div className={cn("space-y-6", className)}>
        <div className="space-y-4">
          <Skeleton className="h-8 w-3/4" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-2/3" />
        </div>
        <Card className="p-6">
          <div className="space-y-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        </Card>
      </div>
    );
  }

  // Show error state if loading failed
  if (mode === 'edit' && loadError) {
    return (
      <div className={cn("space-y-6", className)}>
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Failed to Load Prompt</AlertTitle>
          <AlertDescription>
            {loadError.message || 'Could not load the prompt data. Please try again.'}
          </AlertDescription>
        </Alert>
        {onCancel && (
          <Button variant="outline" onClick={onCancel}>
            Go Back
          </Button>
        )}
      </div>
    );
  }

  // Show error if edit mode but no prompt found
  if (mode === 'edit' && !loadingPrompt && !loadedData && isInitialized) {
    return (
      <div className={cn("space-y-6", className)}>
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Prompt Not Found</AlertTitle>
          <AlertDescription>
            The prompt you're trying to edit could not be found.
          </AlertDescription>
        </Alert>
        {onCancel && (
          <Button variant="outline" onClick={onCancel}>
            Go Back
          </Button>
        )}
      </div>
    );
  }

  return (
    <>
      <div className={cn("space-y-6", className)}>
        {/* Progress Steps Indicator */}
        <StepIndicator
          steps={steps}
          currentStep={currentStep}
          onStepClick={handleStepClick}
        />

      {/* Step Content */}
      <Card className="p-6 min-h-[500px]">
        {/* Keyboard shortcuts hint */}
        <div className="mb-4 text-xs text-muted-foreground text-right">
          💡 Tip: Use <kbd className="px-1.5 py-0.5 bg-muted rounded text-xs">Alt</kbd> + <kbd className="px-1.5 py-0.5 bg-muted rounded text-xs">←</kbd>/<kbd className="px-1.5 py-0.5 bg-muted rounded text-xs">→</kbd> to navigate
        </div>
        {/* Step 1: Platform Selection */}
        {currentStep === 0 && (
          <div>
            <h2 className="text-2xl font-semibold mb-2">{steps[0].title}</h2>
            <p className="text-muted-foreground mb-6">{steps[0].description}</p>
            
            <PlatformSelector
              onSelect={setSelectedPlatform}
              selectedPlatformId={selectedPlatform?.id}
              showSearch={true}
              showCategoryTabs={true}
            />
          </div>
        )}

        {/* Step 2: Base Fields */}
        {currentStep === 1 && (
          <div>
            <h2 className="text-2xl font-semibold mb-2">{steps[1].title}</h2>
            <p className="text-muted-foreground mb-6">{steps[1].description}</p>
            
            <BasePromptFieldsSection
              values={baseFields}
              onChange={(field, value) => {
                setBaseFields(prev => ({ ...prev, [field]: value }));
              }}
              errors={{}} // Will add validation in Phase 3.4
              categories={categories.map(cat => ({
                id: cat.id,
                name: cat.name,
                slug: cat.link_path || cat.name.toLowerCase().replace(/\s+/g, '-')
              }))}
              onCreateCategory={async (name: string) => {
                const slug = name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
                await createCategory({
                  name,
                  description: '',
                  image_path: '',
                  required_plan: 'free',
                  icon_name: 'Folder',
                  features: [],
                  bg_gradient: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  link_path: slug,
                  is_active: true,
                  display_order: 999
                });
              }}
              showBilingualSupport={false} // Can be made configurable
            />
          </div>
        )}

        {/* Step 3: Platform Fields */}
        {currentStep === 2 && (
          <div>
            <h2 className="text-2xl font-semibold mb-2">{steps[2].title}</h2>
            <p className="text-muted-foreground mb-6">{steps[2].description}</p>
            
            {selectedPlatform && (
              <>
                {fieldsLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="text-center">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4" />
                      <p className="text-muted-foreground">Loading platform fields...</p>
                    </div>
                  </div>
                ) : platformFieldsList && platformFieldsList.length > 0 ? (
                  <DynamicFieldGroup
                    fields={platformFieldsList}
                    values={platformFields}
                    onChange={(fieldKey, value) => {
                      setPlatformFields(prev => ({ ...prev, [fieldKey]: value }));
                    }}
                    errors={{}} // Will add validation later
                    layout="vertical"
                  />
                ) : (
                  <div className="text-center py-12 border-2 border-dashed border-muted rounded-lg">
                    <p className="text-muted-foreground">
                      No additional configuration needed for {selectedPlatform.name}
                    </p>
                    <p className="text-xs text-muted-foreground mt-2">
                      Click Next to proceed to the preview step
                    </p>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* Step 4: Preview */}
        {currentStep === 3 && selectedPlatform && (
          <div>
            <h2 className="text-2xl font-semibold mb-2">{steps[3].title}</h2>
            <p className="text-muted-foreground mb-6">{steps[3].description}</p>
            
            <PromptPreview
              data={{
                ...baseFields,
                platform_id: selectedPlatform.id,
                platform_fields: platformFields
              }}
              platform={selectedPlatform}
              categoryName={categories.find(c => c.id === baseFields.category_id)?.name}
              onEdit={(stepIndex) => {
                // Allow navigating to previous steps only
                if (stepIndex < currentStep) {
                  setCurrentStep(stepIndex);
                }
              }}
            />
          </div>
        )}
      </Card>

      {/* Validation Errors */}
      {validationErrors.length > 0 && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <p className="font-semibold mb-2">Please fix the following errors:</p>
            <ul className="list-disc list-inside space-y-1">
              {validationErrors.map((error, index) => (
                <li key={index}>{error.message}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

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

      {/* Submission Overlay */}
      <SubmissionOverlay
        isSubmitting={isSubmitting}
        message={mode === 'edit' ? 'Updating your prompt...' : 'Creating your prompt...'}
      />
    </>
  );
}
