# Simplified Prompt System Documentation

## Overview

The Simplified Prompt System is a unified, streamlined approach to creating and editing prompts in the JojoPrompts application. It replaces the previous multi-step wizard system with a single, comprehensive dialog that includes all essential features.

## Architecture

### Core Component

**`SimplifiedPromptDialog`** - Main component for creating and editing prompts
- Location: `src/components/prompts/SimplifiedPromptDialog.tsx`
- Single-dialog approach for both create and edit modes
- Includes all essential prompt fields and features

### Key Features

1. **Title & Prompt Text**
   - Title field (max 200 characters)
   - Prompt text area (min 10 characters)
   - Client-side validation with user feedback

2. **Category Management**
   - Select from existing categories
   - Create new categories inline
   - Powered by `CategorySelector` component

3. **AI-Generated Tags**
   - Automatic tag generation using OpenAI
   - Manual tag addition/removal
   - Integrated via `TagsManager` component

4. **Thumbnail Management**
   - Upload custom thumbnails
   - Automatic image optimization
   - Preview before submission
   - Uses `ThumbnailManager` component

5. **Translation Support**
   - Automatic Arabic/English translations
   - Powered by OpenAI translation API
   - Integrated via `TranslationButtons` component

6. **File Attachments** ⭐ NEW
   - Support for workflow files, JSON configs, etc.
   - Client-side validation:
     - Max 20MB per file
     - Max 10 files per prompt
   - Organized storage by prompt ID
   - Upload progress tracking

## Component Props

```typescript
interface SimplifiedPromptDialogProps {
  /** Controls dialog visibility */
  open: boolean;
  
  /** Callback to control dialog open/close state */
  onOpenChange: (open: boolean) => void;
  
  /** Optional prompt data for edit mode */
  editingPrompt?: PromptRow | null;
  
  /** Callback fired on successful creation/update */
  onSuccess?: () => void;
}
```

## Usage Examples

### Creating a New Prompt

```tsx
import { SimplifiedPromptDialog } from '@/components/prompts';

function MyComponent() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        Create Prompt
      </Button>
      
      <SimplifiedPromptDialog
        open={open}
        onOpenChange={setOpen}
        onSuccess={() => {
          console.log('Prompt created!');
          // Refresh data, show notification, etc.
        }}
      />
    </>
  );
}
```

### Editing an Existing Prompt

```tsx
import { SimplifiedPromptDialog } from '@/components/prompts';

function PromptCard({ prompt }) {
  const [editOpen, setEditOpen] = useState(false);

  return (
    <>
      <Button onClick={() => setEditOpen(true)}>
        Edit
      </Button>
      
      <SimplifiedPromptDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        editingPrompt={prompt}
        onSuccess={() => {
          console.log('Prompt updated!');
          // Refresh the prompt list
        }}
      />
    </>
  );
}
```

## File Attachments Feature

### Storage Structure

Files are stored in the `prompt-attachments` Supabase storage bucket:

```
prompt-attachments/
├── {prompt-id}/
│   ├── {timestamp}-file1.json
│   ├── {timestamp}-file2.workflow
│   └── {timestamp}-file3.txt
```

### Validation Rules

- **Maximum file size**: 20MB per file
- **Maximum files**: 10 files per prompt
- **Storage bucket**: `prompt-attachments`
- **Access control**: Based on user `membership_tier`

### Access Control

File download permissions are controlled by the `canDownloadAttachments()` helper:

```typescript
import { canDownloadAttachments } from '@/utils/subscriptionHelpers';

// Only admins, jadmins, and lifetime members can download
const canDownload = canDownloadAttachments(userProfile);
```

### Metadata Storage

File paths are stored in the prompt's metadata:

```json
{
  "metadata": {
    "attached_files": [
      "prompt-id/12345-workflow.json",
      "prompt-id/12346-config.txt"
    ]
  }
}
```

## Validation

### Client-Side Validation

All form fields are validated before submission:

1. **Title**
   - Required (cannot be empty)
   - Max 200 characters

2. **Prompt Text**
   - Required (cannot be empty)
   - Min 10 characters

3. **Category**
   - Required (must select a category)

4. **Files**
   - Max 20MB per file
   - Max 10 files total

### Error Handling

Validation errors are displayed using toast notifications with:
- Clear error titles
- Descriptive error messages
- Destructive variant for visibility

## Database Schema

### Prompts Table

```sql
prompts (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES profiles(id),
  title TEXT NOT NULL,
  prompt_text TEXT NOT NULL,
  category_id UUID REFERENCES categories(id),
  image_path TEXT,
  metadata JSONB,
  prompt_type TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
)
```

### Metadata Structure

```typescript
{
  category: string;           // Category name
  tags: string[];            // AI-generated or manual tags
  translations: {            // Optional translations
    arabic?: {
      title?: string;
      prompt_text?: string;
    };
    english?: {
      title?: string;
      prompt_text?: string;
    };
  };
  attached_files: string[];  // File paths in storage
}
```

## Integration Points

### Used By

- `FloatingAddPromptButton` - Quick create button
- `PromptsManagement` (Admin) - Full CRUD interface
- `PrompterDashboard` - Prompter management
- `AdminPromptCard` - Edit existing prompts

### Dependencies

- `@/contexts/AuthContext` - User authentication
- `@/hooks/useCategories` - Category management
- `@/integrations/supabase/client` - Database & storage
- `@/components/prompt-generator/*` - Feature components

## Migration from Legacy System

### Removed Components

The following legacy wizard components were removed:

- `PromptWizard.tsx`
- `PromptWizardDialog.tsx`
- `EditPromptButton.tsx`
- `PromptWizardSkeleton.tsx`
- `StepIndicator.tsx`
- `PromptPreview.tsx`
- `PromptPreviewCard.tsx`
- `PromptSummary.tsx`
- `usePromptSubmission.ts`
- `usePromptLoader.ts`
- `types/prompt-form.ts` (partial - recreated with minimal types)

### Benefits of New System

1. **Simplified UX** - Single dialog instead of multi-step wizard
2. **Faster Creation** - All fields visible at once
3. **Better Edit Experience** - Same interface for create/edit
4. **Reduced Code** - Less complexity, easier maintenance
5. **Improved Performance** - Fewer components, less re-rendering

## Testing

### Manual Testing Checklist

- [ ] Create new prompt with all fields
- [ ] Create prompt with minimal required fields
- [ ] Edit existing prompt
- [ ] Upload thumbnail
- [ ] Add tags manually
- [ ] Generate tags via AI
- [ ] Translate content
- [ ] Attach files (single)
- [ ] Attach multiple files
- [ ] Test file size validation
- [ ] Test file count validation
- [ ] Test title length validation
- [ ] Test prompt text length validation
- [ ] Test category requirement
- [ ] Cancel dialog
- [ ] Submit and verify database entry

## Future Enhancements

1. **Drag & Drop Files** - Improve file attachment UX
2. **File Preview** - Show thumbnails/previews of attached files
3. **Bulk Operations** - Create multiple prompts at once
4. **Templates** - Save and reuse prompt templates
5. **Version History** - Track changes to prompts over time

## Support & Troubleshooting

### Common Issues

**Issue**: Files not uploading
- Check storage bucket exists: `prompt-attachments`
- Verify RLS policies allow uploads
- Check file size limits

**Issue**: Tags not generating
- Verify OpenAI API key is set
- Check edge function logs
- Ensure user has proper permissions

**Issue**: Translations failing
- Verify OpenAI API key
- Check translation edge function
- Review API quota limits

### Debug Mode

Enable verbose logging by checking browser console for:
- Upload progress events
- Validation errors
- API response data

## Related Documentation

- [Supabase Storage Guide](https://supabase.com/docs/guides/storage)
- [Subscription Helpers](../src/utils/subscriptionHelpers.ts)
- [OpenAI Integration](../supabase/functions/)
