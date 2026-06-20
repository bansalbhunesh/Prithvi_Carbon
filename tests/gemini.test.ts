import { describe, it, expect } from "vitest";
import { parseGeminiJson, GeminiError } from "@/lib/gemini";

describe("parseGeminiJson — valid inputs", () => {
  it("parses clean JSON for electricity", () => {
    const out = parseGeminiJson('{"detected":"electricity","kwh":214,"litres":null,"fuel":null,"note":"ok"}');
    expect(out.detected).toBe("electricity");
    expect(out.kwh).toBe(214);
    expect(out.litres).toBeNull();
    expect(out.fuel).toBeNull();
  });

  it("parses fuel detection", () => {
    const out = parseGeminiJson('{"detected":"fuel","kwh":null,"litres":15.5,"fuel":"petrol","note":""}');
    expect(out.detected).toBe("fuel");
    expect(out.litres).toBe(15.5);
    expect(out.fuel).toBe("petrol");
  });

  it("parses unknown detection", () => {
    const out = parseGeminiJson('{"detected":"unknown","kwh":null,"litres":null,"fuel":null,"note":"blurry image"}');
    expect(out.detected).toBe("unknown");
    expect(out.note).toBe("blurry image");
  });

  it("strips markdown json fences", () => {
    const out = parseGeminiJson('```json\n{"detected":"electricity","kwh":100,"litres":null,"fuel":null,"note":""}\n```');
    expect(out.detected).toBe("electricity");
    expect(out.kwh).toBe(100);
  });

  it("strips just backtick fences (no json label)", () => {
    const out = parseGeminiJson('```\n{"detected":"unknown","kwh":null,"litres":null,"fuel":null,"note":"x"}\n```');
    expect(out.detected).toBe("unknown");
  });

  it("handles whitespace around JSON", () => {
    const out = parseGeminiJson('   {"detected":"electricity","kwh":50,"litres":null,"fuel":null,"note":""}   ');
    expect(out.kwh).toBe(50);
  });

  it("handles zero kwh", () => {
    const out = parseGeminiJson('{"detected":"electricity","kwh":0,"litres":null,"fuel":null,"note":""}');
    expect(out.kwh).toBe(0);
  });

  it("handles diesel fuel", () => {
    const out = parseGeminiJson('{"detected":"fuel","kwh":null,"litres":30,"fuel":"diesel","note":""}');
    expect(out.fuel).toBe("diesel");
  });
});

describe("parseGeminiJson — rejection cases", () => {
  it("throws GeminiError on non-JSON", () => {
    expect(() => parseGeminiJson("totally not json")).toThrow(GeminiError);
  });

  it("throws GeminiError on empty string", () => {
    expect(() => parseGeminiJson("")).toThrow(GeminiError);
  });

  it("throws on invalid detected value", () => {
    expect(() => parseGeminiJson('{"detected":"gas","kwh":null,"litres":null,"fuel":null,"note":""}')).toThrow(GeminiError);
  });

  it("throws on negative kwh", () => {
    expect(() => parseGeminiJson('{"detected":"electricity","kwh":-5,"litres":null,"fuel":null,"note":""}')).toThrow(GeminiError);
  });

  it("throws on excessive kwh", () => {
    expect(() => parseGeminiJson('{"detected":"electricity","kwh":999999,"litres":null,"fuel":null,"note":""}')).toThrow(GeminiError);
  });

  it("throws on invalid fuel type", () => {
    expect(() => parseGeminiJson('{"detected":"fuel","kwh":null,"litres":10,"fuel":"cng","note":""}')).toThrow(GeminiError);
  });

  it("throws on plain text that looks like instructions", () => {
    expect(() => parseGeminiJson("Sure! Here is the electricity bill data: 200 kWh")).toThrow(GeminiError);
  });

  it("throws on HTML injection attempt", () => {
    expect(() => parseGeminiJson("<script>alert(1)</script>")).toThrow(GeminiError);
  });

  it("throws on partial JSON", () => {
    expect(() => parseGeminiJson('{"detected":"electricity"')).toThrow(GeminiError);
  });

  it("throws on array instead of object", () => {
    expect(() => parseGeminiJson('[{"detected":"electricity"}]')).toThrow(GeminiError);
  });
});

describe("GeminiError", () => {
  it("is an instance of Error", () => {
    const err = new GeminiError("test");
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(GeminiError);
  });

  it("has default status 502", () => {
    const err = new GeminiError("test");
    expect(err.status).toBe(502);
  });

  it("accepts custom status", () => {
    const err = new GeminiError("not configured", 503);
    expect(err.status).toBe(503);
    expect(err.message).toBe("not configured");
  });
});
