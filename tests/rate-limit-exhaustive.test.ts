import { describe, it, expect, beforeEach } from "vitest";
import { rateLimit, clientKey, __resetRateLimit } from "@/lib/rate-limit";

describe("rateLimit — window behavior", () => {
  beforeEach(() => __resetRateLimit());

  it("first request is always allowed", () => {
    const r = rateLimit("test-ip", 5, 60_000);
    expect(r.ok).toBe(true);
    expect(r.remaining).toBe(4);
  });

  it("allows exactly up to the limit", () => {
    for (let i = 0; i < 5; i++) {
      const r = rateLimit("test-ip", 5, 60_000);
      expect(r.ok).toBe(true);
      expect(r.remaining).toBe(4 - i);
    }
  });

  it("blocks after the limit is reached", () => {
    for (let i = 0; i < 5; i++) rateLimit("test-ip", 5, 60_000);
    const r = rateLimit("test-ip", 5, 60_000);
    expect(r.ok).toBe(false);
    expect(r.remaining).toBe(0);
  });

  it("blocked requests still return resetAt", () => {
    for (let i = 0; i < 5; i++) rateLimit("test-ip", 5, 60_000);
    const r = rateLimit("test-ip", 5, 60_000);
    expect(r.resetAt).toBeGreaterThan(Date.now() - 1000);
  });

  it("different keys are isolated", () => {
    for (let i = 0; i < 5; i++) rateLimit("ip-a", 5, 60_000);
    expect(rateLimit("ip-a", 5, 60_000).ok).toBe(false);
    expect(rateLimit("ip-b", 5, 60_000).ok).toBe(true);
  });

  it("window expiry resets the counter", () => {
    const r1 = rateLimit("test-ip", 2, 1);
    expect(r1.ok).toBe(true);
    const r2 = rateLimit("test-ip", 2, 1);
    expect(r2.ok).toBe(true);

    // Wait for window to expire (1ms window)
    const start = Date.now();
    while (Date.now() - start < 5) { /* busy wait */ }

    const r3 = rateLimit("test-ip", 2, 1);
    expect(r3.ok).toBe(true);
    expect(r3.remaining).toBe(1);
  });

  it("remaining count decrements correctly", () => {
    const limit = 10;
    for (let i = 0; i < limit; i++) {
      const r = rateLimit("counter-test", limit, 60_000);
      expect(r.remaining).toBe(limit - 1 - i);
    }
  });

  it("limit=1 allows exactly one request", () => {
    expect(rateLimit("one-shot", 1, 60_000).ok).toBe(true);
    expect(rateLimit("one-shot", 1, 60_000).ok).toBe(false);
  });

  it("default limit is 12", () => {
    for (let i = 0; i < 12; i++) {
      expect(rateLimit("default-limit").ok).toBe(true);
    }
    expect(rateLimit("default-limit").ok).toBe(false);
  });
});

describe("clientKey — header extraction", () => {
  it("extracts first IP from x-forwarded-for", () => {
    const h = new Headers({ "x-forwarded-for": "1.2.3.4, 5.6.7.8" });
    expect(clientKey(h)).toBe("1.2.3.4");
  });

  it("trims whitespace from x-forwarded-for", () => {
    const h = new Headers({ "x-forwarded-for": "  9.8.7.6 , 1.1.1.1" });
    expect(clientKey(h)).toBe("9.8.7.6");
  });

  it("single IP in x-forwarded-for", () => {
    const h = new Headers({ "x-forwarded-for": "10.0.0.1" });
    expect(clientKey(h)).toBe("10.0.0.1");
  });

  it("falls back to x-real-ip when no x-forwarded-for", () => {
    const h = new Headers({ "x-real-ip": "192.168.1.1" });
    expect(clientKey(h)).toBe("192.168.1.1");
  });

  it("falls back to 'anon' when no headers", () => {
    const h = new Headers();
    expect(clientKey(h)).toBe("anon");
  });

  it("x-forwarded-for takes priority over x-real-ip", () => {
    const h = new Headers({
      "x-forwarded-for": "1.1.1.1",
      "x-real-ip": "2.2.2.2",
    });
    expect(clientKey(h)).toBe("1.1.1.1");
  });
});

describe("__resetRateLimit", () => {
  it("clears all buckets", () => {
    rateLimit("ip1", 1, 60_000);
    rateLimit("ip2", 1, 60_000);
    expect(rateLimit("ip1", 1, 60_000).ok).toBe(false);
    __resetRateLimit();
    expect(rateLimit("ip1", 1, 60_000).ok).toBe(true);
    expect(rateLimit("ip2", 1, 60_000).ok).toBe(true);
  });
});
