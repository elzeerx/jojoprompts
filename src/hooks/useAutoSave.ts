import { useState, useEffect, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";

interface FormData {
  title: string;
  promptText: string;
  promptType: string;
  category: string;
  thumbnail: string | null;
  tags: string[];
  translations: { arabic?: string; english?: string };
}

interface UseAutoSaveProps {
  formData: FormData;
  isValid: boolean;
  onSave?: (data: FormData) => Promise<void>;
}

export function useAutoSave({ formData, isValid, onSave }: UseAutoSaveProps) {
  const { toast } = useToast();
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // Auto-save timer
  useEffect(() => {
    if (!hasChanges || !isValid || !onSave) return;

    const timer = setTimeout(async () => {
      setIsSaving(true);
      try {
        await onSave(formData);
        setLastSaved(new Date());
        setHasChanges(false);
        toast({
          title: "Auto-saved",
          description: "Your prompt has been automatically saved.",
        });
      } catch (error) {
        console.error("Auto-save failed:", error);
      } finally {
        setIsSaving(false);
      }
    }, 30000); // Auto-save every 30 seconds

    return () => clearTimeout(timer);
  }, [formData, hasChanges, isValid, onSave, toast]);

  // Track changes
  useEffect(() => {
    setHasChanges(true);
  }, [formData]);

  // Load from localStorage on mount
  useEffect(() => {
    const savedData = localStorage.getItem('prompt-draft');
    if (savedData) {
      try {
        const parsed = JSON.parse(savedData);
        // This would be handled by the parent component
        console.log("Loaded draft:", parsed);
      } catch (error) {
        console.error("Failed to load draft:", error);
      }
    }
  }, []);

  // Save to localStorage
  useEffect(() => {
    if (formData.title || formData.promptText) {
      localStorage.setItem('prompt-draft', JSON.stringify(formData));
    }
  }, [formData]);

  const clearDraft = useCallback(() => {
    localStorage.removeItem('prompt-draft');
    setHasChanges(false);
  }, []);

  const manualSave = useCallback(async () => {
    if (!onSave) return;
    
    setIsSaving(true);
    try {
      await onSave(formData);
      setLastSaved(new Date());
      setHasChanges(false);
      clearDraft();
      toast({
        title: "Saved!",
        description: "Your prompt has been saved successfully.",
      });
    } catch (error) {
      console.error("Manual save failed:", error);
      toast({
        variant: "destructive",
        title: "Save failed",
        description: "Failed to save prompt. Please try again.",
      });
    } finally {
      setIsSaving(false);
    }
  }, [formData, onSave, clearDraft, toast]);

  return {
    lastSaved,
    isSaving,
    hasChanges,
    clearDraft,
    manualSave
  };
}