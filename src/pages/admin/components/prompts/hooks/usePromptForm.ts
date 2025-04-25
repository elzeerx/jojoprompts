
import { useState, useEffect } from "react";
import { type PromptRow } from "@/types";

const EMPTY_METADATA: PromptRow["metadata"] = {
  category: "",
  style: "",
  tags: [],
  target_model: "",
  use_case: "",
};

export const usePromptForm = (initial: PromptRow | null) => {
  const [title, setTitle] = useState("");
  const [promptText, setPromptText] = useState("");
  const [metadata, setMetadata] = useState<PromptRow["metadata"]>(EMPTY_METADATA);
  const [imageURL, setImageURL] = useState("");
  const [file, setFile] = useState<File | null>(null);

  useEffect(() => {
    if (initial) {
      setTitle(initial.title);
      setPromptText(initial.prompt_text);
      setMetadata({
        category: initial.metadata?.category ?? "",
        style: initial.metadata?.style ?? "",
        tags: initial.metadata?.tags ?? [],
        target_model: initial.metadata?.target_model ?? "",
        use_case: initial.metadata?.use_case ?? "",
      });
      setImageURL(initial.image_path ?? "");
    } else {
      setTitle("");
      setPromptText("");
      setMetadata(EMPTY_METADATA);
      setImageURL("");
      setFile(null);
    }
  }, [initial]);

  return {
    title,
    setTitle,
    promptText,
    setPromptText,
    metadata,
    setMetadata,
    imageURL,
    setImageURL,
    file,
    setFile,
  };
};
