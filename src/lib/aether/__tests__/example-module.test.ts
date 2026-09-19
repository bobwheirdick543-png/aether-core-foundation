import { describe, expect, it } from "vitest";
import { executeRegisteredModule, hasModuleHandler, type ModuleExecutionContext } from "../module-runtime";
import { EXAMPLE_MODULE_SLUG } from "../example-module";

describe("Phase Q example module", () => {
  it("registers the minimal trusted example handler", async () => {
    expect(hasModuleHandler(EXAMPLE_MODULE_SLUG)).toBe(true);

    const context: ModuleExecutionContext = {
      moduleId: "example-module",
      moduleSlug: EXAMPLE_MODULE_SLUG,
      version: "1.0.0",
      taskId: "task-example",
      runId: "run-example",
      ownerId: "owner-example",
      inputs: { message: "hello Aether" },
      config: {},
    };

    await expect(executeRegisteredModule(EXAMPLE_MODULE_SLUG, context)).resolves.toEqual({
      status: "succeeded",
      outputs: { echoed: "hello Aether" },
    });
  });
});
