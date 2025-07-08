
export function getSiteUrl(envProvider = Deno.env) {
  const rawFrontendUrl = envProvider.get('FRONTEND_URL');
  let siteUrl = rawFrontendUrl;
  if (!siteUrl) {
    siteUrl = (envProvider.get('SUPABASE_URL')?.replace('/supabase', '') ?? '');
  }
  return siteUrl.replace(/\/+$/, '');
}
