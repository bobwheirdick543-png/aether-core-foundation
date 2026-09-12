import { describe, expect, it } from "bun:test";
import { createObservabilityContext } from "./observability";

describe("global observability contracts", () => {
  it("creates stable trace/request correlation identifiers", () => {
    const context = createObservabilityContext({ userId: "user-1", taskId: "task-1", runId: "run-1", workerId: "worker-1" });
    expect(context.traceId).toBeTruthy();
    expect(context.requestId).toBeTruthy();
    expect(context.userId).toBe("user-1");
    expect(context.taskId).toBe("task-1");
    expect(context.runId).toBe("run-1");
    expect(context.workerId).toBe("worker-1");
  });

  it("preserves an externally supplied trace id for cross-layer correlation", () => {
    const context = createObservabilityContext({ traceId: "trace-123", requestId: "request-456" });
    expect(context.traceId).toBe("trace-123");
    expect(context.requestId).toBe("request-456");
  });
});
