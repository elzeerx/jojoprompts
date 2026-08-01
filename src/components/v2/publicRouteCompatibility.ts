/**
 * Resolve retired public URLs without registering each one as a separate page.
 * Destinations are fixed; arbitrary incoming parameters are discarded except
 * for the historic prompts-catalog filter URL.
 */
export function resolveLegacyPublicPath(pathname: string, search = "", hash = ""): string | null {
  const [area, section] = pathname.split("/").filter(Boolean);

  if (area === "prompts-catalog") {
    const params = new URLSearchParams(search);
    const next = new URLSearchParams();
    const query = params.get("query") ?? params.get("q");
    const platform = params.get("platform") ?? params.get("p");
    if (query) next.set("q", query);
    if (platform) next.set("p", platform);
    next.set("type", "prompt");
    return `/explore?${next.toString()}${hash}`;
  }

  const aliases: Readonly<Record<string, string>> = {
    skills: "skill",
    automations: "automation",
    prompts: "prompt",
    "image-styles": "image_style",
    bundles: "bundle",
  };
  if (area && aliases[area] && !section) return `/explore?type=${aliases[area]}`;

  if (area === "prompts" && section) {
    if (section === "chatgpt") return "/explore?type=prompt&p=chatgpt";
    if (section === "midjourney") return "/explore?type=image_style";
    if (section === "workflow") return "/explore?type=automation";
    if (section === "gpts-builder") return "/explore?type=skill";
  }

  if (area === "favorites") return "/library";
  if (area === "dashboard") return section === "prompter" ? "/explore" : "/account";
  if (area?.startsWith("payment-")) return "/orders";
  if (area === "prompter" || area === "examples" || area === "search") return "/explore";
  if (area === "demo" && section === "enhanced-prompt") return "/explore";

  return null;
}
