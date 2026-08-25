import { describe, expect, it } from "bun:test";
import { SemctxError, attachSuppressedError } from "../src/errors";

describe("attachSuppressedError", () => {
  it("preserves the primary error and exposes cleanup evidence", () => {
    const primary = new SemctxError("ANALYSIS_FAILED", "analysis failed", { stage: "analysis" });
    const cleanup = new SemctxError("STORE_ERROR", "repository store checkpoint is busy");

    const combined = attachSuppressedError(primary, cleanup);

    expect(combined as Error).toBe(primary);
    expect(combined.message).toBe("analysis failed");
    expect(combined.suppressed).toEqual([cleanup]);
    expect(primary.details.suppressed).toEqual([{
      name: "SemctxError",
      message: "repository store checkpoint is busy",
    }]);
  });
});
