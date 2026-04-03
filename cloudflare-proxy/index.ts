export default {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const targetUrl = url.searchParams.get("url");
    const origin = request.headers.get("Origin") || "";

    // 1. Validation Logic
    const isProduction = origin === "https://iiif.lfod.top";
    const isLocalhost = /^http:\/\/localhost(:\d+)?$/.test(origin);
    const isAllowed = isProduction || isLocalhost;

    // 2. Handle CORS Pre-flight (OPTIONS)
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": isAllowed ? origin : "https://iiif.lfod.top",
          "Access-Control-Allow-Methods": "GET, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
          "Access-Control-Max-Age": "86400",
          "Vary": "Origin",
        },
      });
    }

    // 3. Security Gate
    if (!isAllowed) {
      return new Response("CORS Forbidden: Origin not authorized", { status: 403 });
    }

    if (!targetUrl) {
      return new Response("Missing 'url' parameter", { status: 400 });
    }

    if(targetUrl.includes("iiif-proxy.lfod.top")){
      return new Response("Target can not be the proxy", {status: 400});
    }

    try {
  const response = await fetch(targetUrl, {
    headers: { 'Accept-Encoding': 'identity' } // Ask Smithsonian for uncompressed data
  });

  const newHeaders = new Headers(response.headers);
  newHeaders.set("Access-Control-Allow-Origin", origin || "*");
  newHeaders.set("Vary", "Origin");

  // CRITICAL: Prevent Firefox from choking on double-compression
  newHeaders.delete("Content-Encoding");
  newHeaders.delete("Content-Length"); 
  newHeaders.delete("Set-Cookie");

  return new Response(response.body, {
    status: response.status,
    headers: newHeaders
  });
} catch (err) {
  return new Response("Proxy Error", { status: 502 });
}
  },
};
