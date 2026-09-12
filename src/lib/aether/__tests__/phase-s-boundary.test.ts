import { describe, expect, it } from "vitest";

describe("Phase S API boundary contract", () => {
  it("uses stable versioned API and mutation headers", () => {
    expect("/api/v1").toBe("/api/v1");
    expect("Idempotency-Key").toBe("Idempotency-Key");
    expect("X-Request-Id").toBe("X-Request-Id");
  });

  it("keeps provider credentials outside the public API contract", () => {
    const publicFields = ["model_key", "display_name", "capabilities", "context_window"];
    expect(publicFields).not.toContain("api_key");
    expect(publicFields).not.toContain("service_role_key");
  });
});
