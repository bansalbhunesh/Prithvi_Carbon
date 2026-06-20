import { describe, it, expect } from "vitest";
import {
  ScanRequestSchema, ScanResultSchema, stripDataUrl,
  MAX_IMAGE_BASE64_CHARS, ALLOWED_MIME,
} from "@/lib/scan-schema";

describe("ScanRequestSchema — valid inputs", () => {
  it("accepts minimal valid payload", () => {
    const r = ScanRequestSchema.safeParse({ image: "A".repeat(32) });
    expect(r.success).toBe(true);
  });

  it("accepts valid base64 with all allowed characters", () => {
    const r = ScanRequestSchema.safeParse({ image: "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/==" });
    expect(r.success).toBe(true);
  });

  it("accepts all allowed mime types", () => {
    for (const mime of ALLOWED_MIME) {
      const r = ScanRequestSchema.safeParse({ image: "A".repeat(40), mime });
      expect(r.success).toBe(true);
    }
  });

  it("defaults mime to image/jpeg", () => {
    const r = ScanRequestSchema.safeParse({ image: "A".repeat(40) });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.mime).toBe("image/jpeg");
  });

  it("accepts max size payload", () => {
    const r = ScanRequestSchema.safeParse({ image: "A".repeat(MAX_IMAGE_BASE64_CHARS) });
    expect(r.success).toBe(true);
  });
});

describe("ScanRequestSchema — rejection cases", () => {
  it("rejects too-short image", () => {
    const r = ScanRequestSchema.safeParse({ image: "ABC" });
    expect(r.success).toBe(false);
  });

  it("rejects oversized image", () => {
    const r = ScanRequestSchema.safeParse({ image: "A".repeat(MAX_IMAGE_BASE64_CHARS + 1) });
    expect(r.success).toBe(false);
  });

  it("rejects non-base64 characters", () => {
    expect(ScanRequestSchema.safeParse({ image: "A".repeat(31) + "!" }).success).toBe(false);
    expect(ScanRequestSchema.safeParse({ image: "A".repeat(31) + "<" }).success).toBe(false);
    expect(ScanRequestSchema.safeParse({ image: "A".repeat(31) + " " }).success).toBe(false);
    expect(ScanRequestSchema.safeParse({ image: "<script>alert(1)</script>" }).success).toBe(false);
  });

  it("rejects disallowed mime types", () => {
    expect(ScanRequestSchema.safeParse({ image: "A".repeat(40), mime: "image/svg+xml" }).success).toBe(false);
    expect(ScanRequestSchema.safeParse({ image: "A".repeat(40), mime: "image/gif" }).success).toBe(false);
    expect(ScanRequestSchema.safeParse({ image: "A".repeat(40), mime: "application/json" }).success).toBe(false);
    expect(ScanRequestSchema.safeParse({ image: "A".repeat(40), mime: "text/html" }).success).toBe(false);
  });

  it("rejects missing image field", () => {
    expect(ScanRequestSchema.safeParse({}).success).toBe(false);
    expect(ScanRequestSchema.safeParse({ mime: "image/png" }).success).toBe(false);
  });

  it("rejects non-string image", () => {
    expect(ScanRequestSchema.safeParse({ image: 12345 }).success).toBe(false);
    expect(ScanRequestSchema.safeParse({ image: null }).success).toBe(false);
  });

  it("rejects empty string image", () => {
    expect(ScanRequestSchema.safeParse({ image: "" }).success).toBe(false);
  });
});

describe("ScanResultSchema — valid outputs", () => {
  it("accepts electricity detection", () => {
    const r = ScanResultSchema.safeParse({
      detected: "electricity", kwh: 214, litres: null, fuel: null, note: "ok",
    });
    expect(r.success).toBe(true);
  });

  it("accepts fuel detection", () => {
    const r = ScanResultSchema.safeParse({
      detected: "fuel", kwh: null, litres: 15.5, fuel: "petrol", note: "",
    });
    expect(r.success).toBe(true);
  });

  it("accepts unknown detection", () => {
    const r = ScanResultSchema.safeParse({
      detected: "unknown", kwh: null, litres: null, fuel: null, note: "couldn't read",
    });
    expect(r.success).toBe(true);
  });

  it("accepts zero kwh", () => {
    const r = ScanResultSchema.safeParse({
      detected: "electricity", kwh: 0, litres: null, fuel: null, note: "",
    });
    expect(r.success).toBe(true);
  });

  it("applies default values for optional fields", () => {
    const r = ScanResultSchema.safeParse({ detected: "unknown" });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.kwh).toBeNull();
      expect(r.data.litres).toBeNull();
      expect(r.data.fuel).toBeNull();
      expect(r.data.note).toBe("");
    }
  });

  it("accepts diesel fuel type", () => {
    const r = ScanResultSchema.safeParse({
      detected: "fuel", kwh: null, litres: 20, fuel: "diesel", note: "",
    });
    expect(r.success).toBe(true);
  });
});

describe("ScanResultSchema — rejection cases", () => {
  it("rejects invalid detected type", () => {
    expect(ScanResultSchema.safeParse({
      detected: "water", kwh: null, litres: null, fuel: null, note: "",
    }).success).toBe(false);
  });

  it("rejects negative kwh", () => {
    expect(ScanResultSchema.safeParse({
      detected: "electricity", kwh: -5, litres: null, fuel: null, note: "",
    }).success).toBe(false);
  });

  it("rejects excessive kwh", () => {
    expect(ScanResultSchema.safeParse({
      detected: "electricity", kwh: 200000, litres: null, fuel: null, note: "",
    }).success).toBe(false);
  });

  it("rejects negative litres", () => {
    expect(ScanResultSchema.safeParse({
      detected: "fuel", kwh: null, litres: -1, fuel: "petrol", note: "",
    }).success).toBe(false);
  });

  it("rejects excessive litres", () => {
    expect(ScanResultSchema.safeParse({
      detected: "fuel", kwh: null, litres: 50000, fuel: "petrol", note: "",
    }).success).toBe(false);
  });

  it("rejects invalid fuel type", () => {
    expect(ScanResultSchema.safeParse({
      detected: "fuel", kwh: null, litres: 10, fuel: "kerosene", note: "",
    }).success).toBe(false);
  });

  it("rejects excessively long note", () => {
    expect(ScanResultSchema.safeParse({
      detected: "unknown", kwh: null, litres: null, fuel: null, note: "x".repeat(281),
    }).success).toBe(false);
  });

  it("accepts note at max length (280)", () => {
    expect(ScanResultSchema.safeParse({
      detected: "unknown", kwh: null, litres: null, fuel: null, note: "x".repeat(280),
    }).success).toBe(true);
  });
});

describe("stripDataUrl", () => {
  it("strips data:image/jpeg;base64, prefix", () => {
    expect(stripDataUrl("data:image/jpeg;base64,QUJD")).toBe("QUJD");
  });

  it("strips data:image/png;base64, prefix", () => {
    expect(stripDataUrl("data:image/png;base64,AAAA")).toBe("AAAA");
  });

  it("strips data:image/webp;base64, prefix", () => {
    expect(stripDataUrl("data:image/webp;base64,AAAA")).toBe("AAAA");
  });

  it("returns raw base64 unchanged", () => {
    expect(stripDataUrl("QUJD")).toBe("QUJD");
  });

  it("handles empty string", () => {
    expect(stripDataUrl("")).toBe("");
  });

  it("handles string containing 'base64,' but not as prefix", () => {
    expect(stripDataUrl("somedata:base64,ABC")).toBe("ABC");
  });
});
