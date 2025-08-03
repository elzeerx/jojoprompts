import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CheckCircle, AlertCircle, Save, Upload } from 'lucide-react';
import { ModelSpecificPromptForm } from './ModelSpecificPromptForm';
import { DragDropUpload } from './DragDropUpload';
import { RichTextEditor } from './RichTextEditor';
import { usePromptValidation } from '@/utils/promptValidation';
import { usePromptAutoSave } from '@/hooks/useAutoSave';
import { toast } from '@/hooks/use-toast';

interface EnhancedPromptDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  editingPrompt?: any;
  className?: string;
}

export function EnhancedPromptDialog({
  open,
  onOpenChange,
  onSuccess,
  editingPrompt,
  className
}: EnhancedPromptDialogProps) {
  const [formData, setFormData] = useState<any>({});
  const [isValid, setIsValid] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Auto-save functionality
  const autoSave = usePromptAutoSave(formData, {
    onRestore: (data) => {
      setFormData(data);
      toast({
        title: "Draft Restored",
        description: "Your previous draft has been restored",
      });
    }
  });

  // Validation
  const validation = usePromptValidation(formData, { checkQuality: true });

  // Handle form data changes
  const handleFormChange = (data: any) => {
    setFormData(data);
  };

  // Handle validation changes
  const handleValidationChange = (valid: boolean, formErrors: Record<string, string>) => {
    setIsValid(valid);
    setErrors(formErrors);
  };

  // Handle file uploads
  const handleFilesDrop = (files: File[]) => {
    console.log('Files dropped:', files);
    // Here you would typically upload files to your storage
    toast({
      title: "Files Uploaded",
      description: `${files.length} file(s) uploaded successfully`,
    });
  };

  // Handle form submission
  const handleSubmit = async () => {
    if (!isValid) {
      toast({
        title: "Validation Error",
        description: "Please fix the errors before submitting",
        variant: "destructive"
      });
      return;
    }

    setIsSubmitting(true);
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      toast({
        title: "Success!",
        description: "Prompt saved successfully",
      });
      
      onSuccess();
      onOpenChange(false);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to save prompt",
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-full max-w-6xl h-[90vh] flex flex-col p-0">
        {/* Header */}
        <div className="flex-shrink-0 p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="text-2xl font-bold text-gray-900">
                {editingPrompt ? "Edit Prompt" : "Create New Prompt"}
              </DialogTitle>
              <p className="text-gray-600 mt-1">
                Use our enhanced form with model-specific fields and validation
              </p>
            </div>
            
            {/* Status Indicators */}
            <div className="flex items-center gap-4">
              {autoSave.isSaving && (
                <Badge variant="outline" className="flex items-center gap-1">
                  <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-blue-600" />
                  Auto-saving...
                </Badge>
              )}
              
              {validation.qualityScore > 80 && (
                <Badge variant="outline" className="flex items-center gap-1 text-green-600">
                  <CheckCircle className="h-3 w-3" />
                  High Quality
                </Badge>
              )}
              
              {validation.qualityScore < 50 && (
                <Badge variant="outline" className="flex items-center gap-1 text-orange-600">
                  <AlertCircle className="h-3 w-3" />
                  Needs Improvement
                </Badge>
              )}
            </div>
          </div>
        </div>

        {/* Content */}
        <ScrollArea className="flex-1 px-6">
          <div className="py-6 space-y-6">
            {/* Model-Specific Form */}
            <ModelSpecificPromptForm
              value={formData}
              onChange={handleFormChange}
              onValidationChange={handleValidationChange}
            />

            {/* File Upload Section */}
            <div className="border-t pt-6">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Upload className="h-5 w-5" />
                Media Files
              </h3>
              <DragDropUpload
                onFilesDrop={handleFilesDrop}
                acceptedTypes={['image/*', 'video/*', 'audio/*', '.json', '.zip']}
                maxFiles={10}
                maxSize={50 * 1024 * 1024} // 50MB
                preview={true}
              />
            </div>

            {/* Rich Text Editor for Additional Notes */}
            <div className="border-t pt-6">
              <h3 className="text-lg font-semibold mb-4">Additional Notes</h3>
              <RichTextEditor
                value={formData.notes || ''}
                onChange={(value) => handleFormChange({ ...formData, notes: value })}
                placeholder="Add any additional notes or instructions..."
                features={['bold', 'italic', 'code', 'link']}
                maxLength={1000}
              />
            </div>

            {/* Validation Summary */}
            {!validation.isValid && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  <div className="space-y-1">
                    <p>Please fix the following issues:</p>
                    <ul className="list-disc list-inside space-y-1">
                      {Object.entries(validation.errors).map(([field, error]) => (
                        <li key={field}>{error}</li>
                      ))}
                    </ul>
                  </div>
                </AlertDescription>
              </Alert>
            )}

            {/* Quality Suggestions */}
            {validation.suggestions.length > 0 && (
              <Alert>
                <CheckCircle className="h-4 w-4" />
                <AlertDescription>
                  <div className="space-y-1">
                    <p className="font-medium">Suggestions to improve your prompt:</p>
                    <ul className="list-disc list-inside space-y-1">
                      {validation.suggestions.map((suggestion, index) => (
                        <li key={index}>{suggestion}</li>
                      ))}
                    </ul>
                  </div>
                </AlertDescription>
              </Alert>
            )}
          </div>
        </ScrollArea>

        {/* Footer */}
        <div className="flex-shrink-0 p-6 border-t border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <span className="text-sm text-gray-500">
                Quality Score: {validation.qualityScore}/100
              </span>
              {autoSave.lastSaved && (
                <span className="text-sm text-gray-500">
                  Last saved: {autoSave.lastSaved.toLocaleTimeString()}
                </span>
              )}
            </div>
            
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={!isValid || isSubmitting}
                className="flex items-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4" />
                    Save Prompt
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
} 