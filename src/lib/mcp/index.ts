import { auth, defineMcp } from "@lovable.dev/mcp-js";
import listMyPromptsTool from "./tools/list-my-prompts";

// Direct Supabase host, built from project ref (inlined at build time by Vite).
// Fallback keeps the string well-formed during the manifest-extract eval.
const projectRef =
  import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "jojoprompts-mcp",
  title: "JojoPrompts",
  version: "0.1.0",
  instructions:
    "Tools for JojoPrompts. Use `list_my_prompts` to fetch prompts owned by the signed-in user.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [listMyPromptsTool],
});
