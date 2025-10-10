import { supabase } from '@/integrations/supabase/client';
import { PromptFormData } from '@/types/prompt-form';

export interface CreatePromptParams {
  title: string;
  title_ar?: string;
  prompt_text: string;
  prompt_text_ar?: string;
  category_id?: string;
  platform_id: string;
  platform_fields: Record<string, any>;
  thumbnail?: File | null;
  user_id?: string; // Will be set automatically from auth
}

export interface UpdatePromptParams extends CreatePromptParams {
  id: string;
  existing_thumbnail_url?: string;
}

export interface PromptResponse {
  id: string;
  title: string;
  prompt_text: string;
  image_path?: string;
  platform_id: string;
  category_id?: string;
  created_at: string;
}

/**
 * Upload thumbnail to Supabase storage
 */
export async function uploadThumbnail(file: File, promptId: string): Promise<string> {
  try {
    const fileExt = file.name.split('.').pop();
    const fileName = `${promptId}-${Date.now()}.${fileExt}`;
    const filePath = `${fileName}`;

    // Upload to prompt-images bucket
    const { data, error } = await supabase.storage
      .from('prompt-images')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false
      });

    if (error) throw error;

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('prompt-images')
      .getPublicUrl(filePath);

    return urlData.publicUrl;
  } catch (error) {
    console.error('Error uploading thumbnail:', error);
    throw new Error('Failed to upload thumbnail');
  }
}

/**
 * Delete thumbnail from storage
 */
export async function deleteThumbnail(imageUrl: string): Promise<void> {
  try {
    // Extract file path from URL
    const urlParts = imageUrl.split('/');
    const fileName = urlParts[urlParts.length - 1];

    const { error } = await supabase.storage
      .from('prompt-images')
      .remove([fileName]);

    if (error) throw error;
  } catch (error) {
    console.error('Error deleting thumbnail:', error);
    // Don't throw - deleting old thumbnail is not critical
  }
}

/**
 * Create a new prompt
 */
export async function createPrompt(params: CreatePromptParams): Promise<PromptResponse> {
  try {
    // Get current user
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    // Prepare prompt data
    const promptData: any = {
      title: params.title,
      title_ar: params.title_ar || null,
      prompt_text: params.prompt_text,
      prompt_text_ar: params.prompt_text_ar || null,
      category_id: params.category_id || null,
      platform_id: params.platform_id,
      platform_fields: params.platform_fields,
      user_id: user.id,
      version: 1
    };

    // Insert prompt
    const { data: prompt, error: insertError } = await supabase
      .from('prompts')
      .insert([promptData])
      .select()
      .single();

    if (insertError) throw insertError;

    // Upload thumbnail if provided
    if (params.thumbnail && prompt) {
      try {
        const imageUrl = await uploadThumbnail(params.thumbnail, prompt.id);
        
        // Update prompt with image path
        const { data: updatedPrompt, error: updateError } = await supabase
          .from('prompts')
          .update({ image_path: imageUrl })
          .eq('id', prompt.id)
          .select()
          .single();

        if (updateError) throw updateError;
        return updatedPrompt as PromptResponse;
      } catch (uploadError) {
        // Thumbnail upload failed, but prompt was created
        console.error('Thumbnail upload failed:', uploadError);
        return prompt as PromptResponse; // Return prompt without image
      }
    }

    return prompt as PromptResponse;
  } catch (error) {
    console.error('Error creating prompt:', error);
    throw error;
  }
}

/**
 * Update an existing prompt
 */
export async function updatePrompt(params: UpdatePromptParams): Promise<PromptResponse> {
  try {
    // Get current user
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    // Prepare update data
    const updateData: any = {
      title: params.title,
      title_ar: params.title_ar || null,
      prompt_text: params.prompt_text,
      prompt_text_ar: params.prompt_text_ar || null,
      category_id: params.category_id || null,
      platform_id: params.platform_id,
      platform_fields: params.platform_fields
    };

    // Handle thumbnail update
    if (params.thumbnail) {
      // Delete old thumbnail if exists
      if (params.existing_thumbnail_url) {
        await deleteThumbnail(params.existing_thumbnail_url);
      }

      // Upload new thumbnail
      const imageUrl = await uploadThumbnail(params.thumbnail, params.id);
      updateData.image_path = imageUrl;
    }

    // Update prompt
    const { data: prompt, error } = await supabase
      .from('prompts')
      .update(updateData)
      .eq('id', params.id)
      .select()
      .single();

    if (error) throw error;
    return prompt as PromptResponse;
  } catch (error) {
    console.error('Error updating prompt:', error);
    throw error;
  }
}

/**
 * Delete a prompt
 */
export async function deletePrompt(promptId: string, imageUrl?: string): Promise<void> {
  try {
    // Delete thumbnail if exists
    if (imageUrl) {
      await deleteThumbnail(imageUrl);
    }

    // Delete prompt
    const { error } = await supabase
      .from('prompts')
      .delete()
      .eq('id', promptId);

    if (error) throw error;
  } catch (error) {
    console.error('Error deleting prompt:', error);
    throw error;
  }
}

/**
 * Get prompt by ID
 */
export async function getPromptById(promptId: string): Promise<PromptResponse | null> {
  try {
    const { data, error } = await supabase
      .from('prompts')
      .select('*')
      .eq('id', promptId)
      .single();

    if (error) throw error;
    return data as PromptResponse;
  } catch (error) {
    console.error('Error fetching prompt:', error);
    return null;
  }
}
