import { useEffect, useRef, useState } from 'react';

interface AutoSaveOptions {
  onRestore?: (data: any) => void;
  saveKey?: string;
  saveDelay?: number;
}

export function usePromptAutoSave(data: any, options: AutoSaveOptions = {}) {
  const { onRestore, saveKey = 'promptDraft', saveDelay = 1000 } = options;
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const saveTimeoutRef = useRef<NodeJS.Timeout>();

  // Auto-save functionality
  useEffect(() => {
    if (data && Object.keys(data).length > 0) {
      setIsSaving(true);
      
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }

      saveTimeoutRef.current = setTimeout(() => {
        try {
          localStorage.setItem(saveKey, JSON.stringify(data));
          setLastSaved(new Date());
          setIsSaving(false);
        } catch (error) {
          console.error('Failed to auto-save:', error);
          setIsSaving(false);
        }
      }, saveDelay);
    }

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [data, saveKey, saveDelay]);

  // Restore from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(saveKey);
      if (saved && onRestore) {
        const parsedData = JSON.parse(saved);
        if (parsedData && Object.keys(parsedData).length > 0) {
          onRestore(parsedData);
        }
      }
    } catch (error) {
      console.error('Failed to restore auto-save:', error);
    }
  }, [saveKey, onRestore]);

  const clearSaved = () => {
    try {
      localStorage.removeItem(saveKey);
      setLastSaved(null);
    } catch (error) {
      console.error('Failed to clear auto-save:', error);
    }
  };

  return {
    isSaving,
    lastSaved,
    clearSaved
  };
}