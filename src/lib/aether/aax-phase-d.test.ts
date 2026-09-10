import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("Phase D chat workspace contract", () => {
  const root = resolve(process.cwd());
  const chat = readFileSync(resolve(root, "src/routes/_authenticated/chat.tsx"), "utf8");
  const api = readFileSync(resolve(root, "src/routes/api/aax/chat.ts"), "utf8");
  const web = readFileSync(resolve(root, "src/lib/aether/aax-web-research.ts"), "utf8");
  const functions = readFileSync(resolve(root, "src/lib/aether/aax-chat.functions.ts"), "utf8");

  it("has a real server streaming endpoint", () => {
    expect(api).toContain('createFileRoute("/api/aax/chat")');
    expect(api).toContain("text/event-stream");
    expect(api).toContain("executeAaxChatStream");
  });

  it("gates web research through the provider web-search tool and stores sources", () => {
    expect(web).toContain('tools: [{ type: "web_search" }]');
    expect(functions).toContain("executeAaxWebResearch");
    expect(functions).toContain("aax_chat_sources");
    expect(chat).toContain("toggleWeb");
  });

  it("contains persistent lifecycle, attachment, memory and stop controls", () => {
    for (const marker of ["createAaxConversation", "renameAaxConversation", "archiveAaxConversation", "deleteAaxConversation", "registerAaxAttachment", "saveAaxMemoryCandidate", "stopAaxGeneration"]) expect(functions).toContain(marker);
    expect(chat).toContain("Save memory");
    expect(chat).toContain("Regenerate");
    expect(chat).toContain("Attachments");
  });
});
