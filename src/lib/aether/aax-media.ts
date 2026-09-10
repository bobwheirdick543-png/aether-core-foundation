export type AaxMediaKind = "text" | "image" | "audio" | "file";

export interface AaxMediaPart {
  kind: AaxMediaKind;
  mimeType?: string;
  url?: string;
  data?: string;
  name?: string;
}

export interface AaxToolDefinition {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

export interface AaxStreamingEvent {
  type: "delta" | "tool_call" | "usage" | "done" | "error";
  content?: string;
  toolCall?: Record<string, unknown>;
  usage?: { inputTokens: number; outputTokens: number };
  error?: string;
}

export function validateMedia(parts: AaxMediaPart[]) {
  if (!Array.isArray(parts)) throw new Error("Media parts must be an array");
  for (const part of parts) {
    if (!part || !["text","image","audio","file"].includes(part.kind)) throw new Error("Unsupported AAX media part");
    if (!part.url && !part.data && part.kind !== "text") throw new Error("Media parts require a URL or data payload");
  }
  return parts;
}
