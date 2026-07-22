import { CatalogTable } from "./CatalogTable";

type ResourceType = "skill" | "automation" | "prompt" | "prompt_pack" | "image_style" | "bundle";

interface Props {
  lockedType?: ResourceType;
  title?: string;
}

const TITLES: Record<ResourceType, string> = {
  skill: "Skills",
  automation: "Automations",
  prompt: "Prompts",
  prompt_pack: "Prompt packs",
  image_style: "Image Styles",
  bundle: "Bundles",
};

export default function CatalogPage({ lockedType, title }: Props) {
  const t = title ?? (lockedType ? TITLES[lockedType] : "All Resources");
  return <CatalogTable lockedType={lockedType} title={t} />;
}
