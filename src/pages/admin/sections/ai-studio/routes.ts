export const AI_STUDIO_BASE_ROUTE = "/admin/content?tool=ai-studio";

export function aiStudioDraftRoute(draftId: string): string {
  const params = new URLSearchParams({ tool: "ai-studio", draftId });
  return `/admin/content?${params.toString()}`;
}
