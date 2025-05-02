
import { useState, useEffect } from "react";
import { type PromptRow } from "@/types";
import { getPromptImage } from "@/utils/image";

export const usePromptForm = (initial: PromptRow | null | undefined) => {
  const [title, setTitle] = useState<string>("");
  const [promptText, setPromptText] = useState<string>("");
  const [metadata, setMetadata] = useState<PromptRow["metadata"]>({});
  const [file, setFile] = useState<File | null>(null);
  const [imageURL, setImageURL] = useState<string>("");
  const [selectedImagePath, setSelectedImagePath] = useState<string | null>(null);

  // Reset form states to initial values or empty
  const resetForm = () => {
    setTitle("");
    setPromptText("");
    setMetadata({});
    setFile(null);
    setImageURL("");
    setSelectedImagePath(null);
  };

  useEffect(() => {
    if (initial) {
      setTitle(initial.title);
      setPromptText(initial.prompt_text);
      setMetadata(initial.metadata || {});
      
      const imagePath = initial.prompt_type === "text" 
        ? initial.default_image_path
        : initial.image_path;
        
      if (imagePath) {
        setSelectedImagePath(imagePath);
        
        // Load the image URL
        const loadImage = async () => {
          try {
            const url = await getPromptImage(imagePath, 400, 80);
            setImageURL(url);
          } catch (error) {
            console.error("Error loading form image:", error);
          }
        };
        
        loadImage();
      }
    } else {
      // Reset form if initial is null/undefined
      resetForm();
    }
  }, [initial]);

  const handleSetFile = (newFile: File | null) => {
    setFile(newFile);
    
    // If a new file is uploaded, clear the selected image path
    if (newFile) {
      setSelectedImagePath(null);
    } else if (!newFile && !selectedImagePath) {
      // If we're clearing the file and don't have a selected image, keep the original
      if (initial) {
        const imagePath = initial.prompt_type === "text" 
          ? initial.default_image_path
          : initial.image_path;
        setSelectedImagePath(imagePath || null);
      }
    }
  };

  return {
    title,
    promptText,
    metadata,
    file,
    imageURL,
    selectedImagePath,
    setTitle,
    setPromptText,
    setMetadata,
    setFile: handleSetFile,
    setSelectedImagePath,
    resetForm, // Export the reset function
  };
};
