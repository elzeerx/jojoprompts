import { CatalogTable } from "./CatalogTable";

type ResourceType = "skill" | "automation" | "prompt" | "prompt_pack" | "image_style" | "bundle";

interface Props {
  lockedType?: ResourceType;
  includeTypes?: ResourceType[];
  title?: string;
  subtitle?: string;
}

const TITLES: Record<ResourceType, string> = {
  skill: "Skills",
  automation: "Automations",
  prompt: "Prompts",
  prompt_pack: "Prompt Packs",
  image_style: "Image Styles",
  bundle: "Bundles",
};

export default function CatalogPage({ lockedType, includeTypes, title, subtitle }: Props) {
  const t = title
    ?? (lockedType ? TITLES[lockedType]
    : includeTypes ? includeTypes.map((x) => TITLES[x]).join(" + ")
    : "All Resources");
  return <CatalogTable lockedType={lockedType} includeTypes={includeTypes} title={t} subtitle={subtitle} />;
}
