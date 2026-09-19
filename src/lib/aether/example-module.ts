import { registerModuleHandler, type ModuleExecutionContext } from "./module-runtime";

export const EXAMPLE_MODULE_SLUG = "example.echo";

registerModuleHandler(EXAMPLE_MODULE_SLUG, {
  async execute(context: ModuleExecutionContext) {
    const message = context.inputs.message;
    if (typeof message !== "string") {
      return { status: "failed", error: "example.echo requires a string input named message" };
    }

    return {
      status: "succeeded",
      outputs: { echoed: message.slice(0, 4000) },
    };
  },
});
