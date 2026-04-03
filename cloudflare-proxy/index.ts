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
      // 4. Fetch and Stream the Asset
      const response = await fetch(targetUrl);

      const proxyResponse = new Response(response.body, {
        status: response.status,
        headers: new Headers(response.headers),
      });

      proxyResponse.headers.set("Access-Control-Allow-Origin", origin);
      proxyResponse.headers.set("Vary", "Origin");

      return proxyResponse;
    } catch (err) {
      return new Response("Proxy Error: Destination Unreachable", { status: 502 });
    }
  },
};
