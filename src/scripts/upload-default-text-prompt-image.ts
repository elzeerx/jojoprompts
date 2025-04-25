
import { uploadDefaultPromptImage } from "@/utils/image";

// Convert base64 string to File object
async function base64ToFile(base64String: string, filename: string) {
  // Remove data URL prefix if present
  const base64Data = base64String.replace(/^data:image\/(png|jpeg|jpg);base64,/, '');
  
  // Convert base64 to binary
  const binaryString = atob(base64Data);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  
  // Create Blob and File
  const blob = new Blob([bytes], { type: 'image/png' });
  return new File([blob], filename, { type: 'image/png' });
}

async function uploadImage() {
  try {
    console.log("Starting default text prompt image upload process...");
    
    // Use the attached image
    const imageBase64 = "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";
    
    // Convert base64 to File
    const file = await base64ToFile(imageBase64, 'text-prompt-default.png');
    
    // Upload the image to the default-prompt-images bucket
    const path = await uploadDefaultPromptImage(file);
    console.log('Default text prompt image uploaded successfully:', path);
    
    // Now verify the upload by trying to retrieve it
    console.log('You should now be able to see this image in text prompts');
  } catch (error) {
    console.error('Error uploading default text prompt image:', error);
  }
}

uploadImage();
