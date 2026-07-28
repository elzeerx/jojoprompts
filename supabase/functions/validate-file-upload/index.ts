// Retired endpoint (source-only stub). Do not add logic here.
// This function has been retired; all requests receive HTTP 410.
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, PATCH, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve((req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }
  return new Response(
    '{"error":"endpoint_retired","function":"validate-file-upload","replacement":"v2-admin-upload-resource-file"}',
    {
      status: 410,
      headers: {
        ...CORS_HEADERS,
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
      },
    },
  );
});
