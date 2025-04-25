
import { uploadDefaultPromptImage } from "@/utils/image";

async function uploadImage() {
  try {
    // Note: In a real scenario, you'd pass the actual File object
    // This is a placeholder and would need to be replaced with actual file handling
    const file = new File([], 'text-prompt-default.png');
    const path = await uploadDefaultPromptImage(file);
    console.log('Default text prompt image uploaded successfully:', path);
  } catch (error) {
    console.error('Error uploading default text prompt image:', error);
  }
}

uploadImage();
