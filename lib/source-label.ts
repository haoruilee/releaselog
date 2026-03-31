export function getSourceLabel(sourceUrl: string): string {
  let url: URL;

  try {
    url = new URL(sourceUrl);
  } catch {
    return "Source";
  }

  const host = url.hostname.replace(/^www\./, "");
  const path = url.pathname;

  if (host === "anthropic.com" && path.startsWith("/news/")) {
    return "Anthropic News";
  }

  if (host === "claude.com" && path.startsWith("/blog/")) {
    return "Claude Blog";
  }

  if (host === "support.claude.com") {
    return "Claude Help";
  }

  if (host === "platform.claude.com" && path.startsWith("/docs/")) {
    return "Platform Docs";
  }

  if (host === "openai.com" && path.startsWith("/index/")) {
    return "OpenAI";
  }

  if (host === "help.openai.com") {
    return "OpenAI Help";
  }

  if (host === "platform.openai.com" && path.startsWith("/docs/")) {
    return "OpenAI API Docs";
  }

  return "Source";
}
