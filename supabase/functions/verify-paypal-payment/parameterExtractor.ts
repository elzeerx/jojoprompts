
export async function getAllParams(req: Request): Promise<{[k: string]: any}> {
  const url = new URL(req.url);
  let params: any = {};
  url.searchParams.forEach((v, k) => { params[k] = v; });
  try {
    if (req.method === 'POST' && req.headers.get('content-type')?.includes('application/json')) {
      const body = await req.json();
      if (body && typeof body === "object") {
        params = { ...params, ...body };
      }
    }
  } catch {}
  return params;
}
