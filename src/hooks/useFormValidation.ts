import { useMemo } from "react";

interface FormData {
  title: string;
  promptText: string;
  promptType: string;
  category: string;
  thumbnail: string | null;
  tags: string[];
}

export function useFormValidation(formData: FormData) {
  const validationErrors = useMemo(() => {
    const errors: string[] = [];

    // Required fields
    if (!formData.title.trim()) {
      errors.push("Title is required");
    } else if (formData.title.length < 3) {
      errors.push("Title must be at least 3 characters long");
    } else if (formData.title.length > 100) {
      errors.push("Title must be less than 100 characters");
    }

    if (!formData.promptText.trim()) {
      errors.push("Prompt text is required");
    } else if (formData.promptText.length < 10) {
      errors.push("Prompt text must be at least 10 characters long");
    } else if (formData.promptText.length > 5000) {
      errors.push("Prompt text must be less than 5000 characters");
    }

    if (!formData.promptType) {
      errors.push("Prompt type is required");
    }

    if (!formData.category) {
      errors.push("Category is required");
    }

    // Tag validation
    if (formData.tags.length > 20) {
      errors.push("Maximum 20 tags allowed");
    }

    // Check for inappropriate content (basic check)
    const inappropriateWords = ['spam', 'virus', 'hack'];
    const lowerText = formData.promptText.toLowerCase();
    const hasInappropriate = inappropriateWords.some(word => lowerText.includes(word));
    if (hasInappropriate) {
      errors.push("Prompt contains inappropriate content");
    }

    return errors;
  }, [formData]);

  const isValid = validationErrors.length === 0;

  return {
    validationErrors,
    isValid
  };
}