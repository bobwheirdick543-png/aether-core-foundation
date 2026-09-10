import { describe, expect, it } from "vitest";
import { isAaxAvailable } from "./aax";

describe("AAX release availability", () => {
  it("rejects every non-available lifecycle state", () => {
    for (const releaseStatus of ["draft", "training", "evaluation", "approved", "scheduled", "announced", "deprecated", "retired"] as const) {
      expect(isAaxAvailable({ releaseStatus })).toBe(false);
    }
  });

  it("allows an available model with no explicit availability time", () => {
    expect(isAaxAvailable({ releaseStatus: "available" })).toBe(true);
  });

  it("blocks a future scheduled availability time", () => {
    expect(isAaxAvailable({
      releaseStatus: "available",
      availableAt: "2099-01-01T00:00:00.000Z",
    }, new Date("2098-01-01T00:00:00.000Z"))).toBe(false);
  });

  it("allows a model at or after its availability time", () => {
    expect(isAaxAvailable({
      releaseStatus: "available",
      availableAt: "2099-01-01T00:00:00.000Z",
    }, new Date("2099-01-01T00:00:00.000Z"))).toBe(true);
  });
});
