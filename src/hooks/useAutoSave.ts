import { useState, useEffect, useCallback, useRef } from 'react';
import { safeLog } from '@/utils/safeLogging';

interface AutoSaveOptions {
  key: string;
  interval?: number; // milliseconds
  debounce?: number; // milliseconds
  maxDrafts?: number;
  onSave?: (data: any) => void;
  onRestore?: (data: any) => void;
  enabled?: boolean;
}

interface DraftData {
  id: string;
  data: any;
  timestamp: number;
  version: number;
}

interface AutoSaveResult {
  isSaving: boolean;
  lastSaved: Date | null;
  drafts: DraftData[];
  saveDraft: (data: any) => void;
  restoreDraft: (draftId: string) => void;
  deleteDraft: (draftId: string) => void;
  clearDrafts: () => void;
  getLatestDraft: () => DraftData | null;
}

export function useAutoSave(options: AutoSaveOptions): AutoSaveResult {
  const {
    key,
    interval = 30000, // 30 seconds
    debounce = 1000, // 1 second
    maxDrafts = 5,
    onSave,
    onRestore,
    enabled = true
  } = options;

  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [drafts, setDrafts] = useState<DraftData[]>([]);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastDataRef = useRef<any>(null);

  // Generate unique draft ID
  const generateDraftId = () => `draft_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  // Save data to localStorage
  const saveToStorage = useCallback((data: any, draftId?: string) => {
    try {
      const draftData: DraftData = {
        id: draftId || generateDraftId(),
        data,
        timestamp: Date.now(),
        version: 1
      };

      // Get existing drafts
      const existingDrafts = JSON.parse(localStorage.getItem(`autosave_${key}`) || '[]');
      
      // Add new draft
      const updatedDrafts = [draftData, ...existingDrafts]
        .slice(0, maxDrafts) // Keep only maxDrafts
        .sort((a: DraftData, b: DraftData) => b.timestamp - a.timestamp); // Sort by timestamp

      // Save to localStorage
      localStorage.setItem(`autosave_${key}`, JSON.stringify(updatedDrafts));
      
      // Update state
      setDrafts(updatedDrafts);
      setLastSaved(new Date());
      
      safeLog.debug(`Auto-saved draft for key: ${key}`, {
        draftId: draftData.id,
        timestamp: draftData.timestamp,
        dataSize: JSON.stringify(data).length
      });

      // Call onSave callback
      if (onSave) {
        onSave(data);
      }

      return draftData;
    } catch (error) {
      safeLog.error('Failed to save draft:', error);
      return null;
    }
  }, [key, maxDrafts, onSave]);

  // Load drafts from localStorage
  const loadDrafts = useCallback(() => {
    try {
      const savedDrafts = localStorage.getItem(`autosave_${key}`);
      if (savedDrafts) {
        const parsedDrafts = JSON.parse(savedDrafts);
        setDrafts(parsedDrafts);
        return parsedDrafts;
      }
    } catch (error) {
      safeLog.error('Failed to load drafts:', error);
    }
    return [];
  }, [key]);

  // Debounced save function
  const debouncedSave = useCallback((data: any) => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(() => {
      if (enabled && JSON.stringify(data) !== JSON.stringify(lastDataRef.current)) {
        setIsSaving(true);
        saveToStorage(data);
        lastDataRef.current = data;
        setIsSaving(false);
      }
    }, debounce);
  }, [enabled, debounce, saveToStorage]);

  // Manual save function
  const saveDraft = useCallback((data: any) => {
    if (!enabled) return;

    setIsSaving(true);
    const draft = saveToStorage(data);
    setIsSaving(false);
    return draft;
  }, [enabled, saveToStorage]);

  // Restore draft function
  const restoreDraft = useCallback((draftId: string) => {
    try {
      const draft = drafts.find(d => d.id === draftId);
      if (draft && onRestore) {
        onRestore(draft.data);
        safeLog.debug(`Restored draft: ${draftId}`, {
          timestamp: draft.timestamp,
          dataSize: JSON.stringify(draft.data).length
        });
        return draft.data;
      }
    } catch (error) {
      safeLog.error('Failed to restore draft:', error);
    }
    return null;
  }, [drafts, onRestore]);

  // Delete draft function
  const deleteDraft = useCallback((draftId: string) => {
    try {
      const updatedDrafts = drafts.filter(d => d.id !== draftId);
      localStorage.setItem(`autosave_${key}`, JSON.stringify(updatedDrafts));
      setDrafts(updatedDrafts);
      
      safeLog.debug(`Deleted draft: ${draftId}`);
    } catch (error) {
      safeLog.error('Failed to delete draft:', error);
    }
  }, [drafts, key]);

  // Clear all drafts function
  const clearDrafts = useCallback(() => {
    try {
      localStorage.removeItem(`autosave_${key}`);
      setDrafts([]);
      setLastSaved(null);
      
      safeLog.debug(`Cleared all drafts for key: ${key}`);
    } catch (error) {
      safeLog.error('Failed to clear drafts:', error);
    }
  }, [key]);

  // Get latest draft function
  const getLatestDraft = useCallback(() => {
    return drafts.length > 0 ? drafts[0] : null;
  }, [drafts]);

  // Set up interval-based auto-save
  useEffect(() => {
    if (enabled && interval > 0) {
      intervalRef.current = setInterval(() => {
        if (lastDataRef.current) {
          debouncedSave(lastDataRef.current);
        }
      }, interval);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [enabled, interval, debouncedSave]);

  // Load drafts on mount
  useEffect(() => {
    loadDrafts();
  }, [loadDrafts]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  return {
    isSaving,
    lastSaved,
    drafts,
    saveDraft,
    restoreDraft,
    deleteDraft,
    clearDrafts,
    getLatestDraft
  };
}

// Hook for form auto-save
export function useFormAutoSave<T>(
  formData: T,
  options: Omit<AutoSaveOptions, 'key'> & { key: string }
) {
  const autoSave = useAutoSave(options);

  // Auto-save when form data changes
  useEffect(() => {
    if (formData && Object.keys(formData as any).length > 0) {
      autoSave.saveDraft(formData);
    }
  }, [formData, autoSave.saveDraft]);

  return autoSave;
}

// Hook for prompt auto-save
export function usePromptAutoSave(
  formData: {
    title: string;
    promptText: string;
    promptType: string;
    metadata: any;
  },
  options: Omit<AutoSaveOptions, 'key'> = {}
) {
  const promptKey = `prompt_${formData.promptType || 'new'}`;
  
  return useFormAutoSave(formData, {
    key: promptKey,
    interval: 15000, // 15 seconds for prompts
    debounce: 2000, // 2 seconds debounce
    maxDrafts: 3, // Keep 3 drafts per prompt type
    ...options
  });
} 