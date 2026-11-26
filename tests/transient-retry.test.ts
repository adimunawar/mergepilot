import { describe, expect, it, vi } from "vitest";
import { withTransientRetry } from "../src/review/transient-retry.js";

describe("withTransientRetry", () => {
  it("retries temporary 503 errors and returns the successful response", async () => {
    const operation = vi.fn()
      .mockRejectedValueOnce({ status: 503, message: "High demand" })
      .mockResolvedValueOnce("ok");
    const wait = vi.fn().mockResolvedValue(undefined);

    await expect(withTransientRetry(operation, wait)).resolves.toBe("ok");

    expect(operation).toHaveBeenCalledTimes(2);
    expect(wait).toHaveBeenCalledOnce();
    expect(wait.mock.calls[0]?.[0]).toBeGreaterThanOrEqual(1_000);
    expect(wait.mock.calls[0]?.[0]).toBeLessThan(1_250);
  });

  it("stops after the configured number of retries", async () => {
    const error = { status: 503, message: "Still unavailable" };
    const operation = vi.fn().mockRejectedValue(error);
    const wait = vi.fn().mockResolvedValue(undefined);

    await expect(withTransientRetry(operation, wait)).rejects.toBe(error);

    expect(operation).toHaveBeenCalledTimes(3);
    expect(wait).toHaveBeenCalledTimes(2);
  });

  it("does not retry permanent errors", async () => {
    const error = { status: 404, message: "Model not found" };
    const operation = vi.fn().mockRejectedValue(error);
    const wait = vi.fn().mockResolvedValue(undefined);

    await expect(withTransientRetry(operation, wait)).rejects.toBe(error);

    expect(operation).toHaveBeenCalledOnce();
    expect(wait).not.toHaveBeenCalled();
  });
});
