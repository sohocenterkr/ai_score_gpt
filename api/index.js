import app from "./_server/site-ai-score-api.mjs";

export default function handler(request, response) {
  const host = request.headers.host ?? "localhost";
  const url = new URL(request.url ?? "/", `https://${host}`);
  const apiPath = url.searchParams.get("__apiPath");

  if (apiPath !== null) {
    url.searchParams.delete("__apiPath");

    const normalizedPath = apiPath.trim().replace(/^\/+/, "");
    const search = url.searchParams.toString();

    request.url = `/api/${normalizedPath}${search ? `?${search}` : ""}`;
  }

  return app(request, response);
}
