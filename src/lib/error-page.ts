function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function renderErrorPage(detail?: string): string {
  const safeDetail =
    detail && detail.trim().length > 0
      ? escapeHtml(detail.trim().slice(0, 500))
      : null;

  const isConfigError =
    safeDetail &&
    (safeDetail.includes("Missing Supabase") ||
      safeDetail.includes("environment variable") ||
      safeDetail.includes("SUPABASE_"));

  const title = isConfigError ? "Configuration required" : "This page didn't load";
  const body = isConfigError
    ? "Required environment variables are missing on the server. Add them in your host (e.g. Vercel) and redeploy."
    : "Something went wrong on our end. You can try refreshing or head back home.";

  const detailBlock = safeDetail
    ? `<pre class="detail">${safeDetail}</pre>`
    : "";

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>${title}</title>
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>
      body { font: 15px/1.5 system-ui, -apple-system, sans-serif; background: #fafafa; color: #111; display: grid; place-items: center; min-height: 100vh; margin: 0; padding: 1.5rem; }
      .card { max-width: 32rem; width: 100%; text-align: center; padding: 2rem; }
      h1 { font-size: 1.25rem; margin: 0 0 0.5rem; }
      p { color: #4b5563; margin: 0 0 1rem; }
      .detail { margin: 0 0 1.5rem; text-align: left; font: 12px/1.4 ui-monospace, SFMono-Regular, Menlo, monospace; background: #f3f4f6; color: #374151; border: 1px solid #e5e7eb; border-radius: 0.375rem; padding: 0.75rem 1rem; white-space: pre-wrap; word-break: break-word; }
      .actions { display: flex; gap: 0.5rem; justify-content: center; flex-wrap: wrap; }
      a, button { padding: 0.5rem 1rem; border-radius: 0.375rem; font: inherit; cursor: pointer; text-decoration: none; border: 1px solid transparent; }
      .primary { background: #111; color: #fff; }
      .secondary { background: #fff; color: #111; border-color: #d1d5db; }
    </style>
  </head>
  <body>
    <div class="card">
      <h1>${title}</h1>
      <p>${body}</p>
      ${detailBlock}
      <div class="actions">
        <button class="primary" onclick="location.reload()">Try again</button>
        <a class="secondary" href="/">Go home</a>
      </div>
    </div>
  </body>
</html>`;
}
