import { describe, it, expect } from "bun:test";
import { isPreviewHost } from "./siteMode";

describe("isPreviewHost", () => {
  it("unlocks the exact Lovable private preview host", () => {
    expect(isPreviewHost("id-preview--766f3370-d38c-42e5-8566-5e4946986dd2.lovable.app")).toBe(true);
    expect(isPreviewHost("ID-PREVIEW--abc123.LOVABLE.APP")).toBe(true);
  });

  it("allows localhost dev hosts", () => {
    expect(isPreviewHost("localhost")).toBe(true);
    expect(isPreviewHost("127.0.0.1")).toBe(true);
  });

  it("locks production hosts", () => {
    expect(isPreviewHost("jojoprompts.com")).toBe(false);
    expect(isPreviewHost("www.jojoprompts.com")).toBe(false);
  });

  it("locks the public Lovable published host", () => {
    expect(isPreviewHost("jojoprompts.lovable.app")).toBe(false);
  });

  it("locks malformed / attacker-controlled preview-like hosts", () => {
    expect(isPreviewHost("id-preview--x.lovable.app.evil.com")).toBe(false);
    expect(isPreviewHost("evil.id-preview--x.lovable.app")).toBe(false);
    expect(isPreviewHost("id-preview--.lovable.app")).toBe(false);
    expect(isPreviewHost("id-preview--x.lovable.appevil.com")).toBe(false);
    expect(isPreviewHost("notid-preview--x.lovable.app")).toBe(false);
    expect(isPreviewHost("id-preview--x_y.lovable.app")).toBe(false);
  });

  it("SSR / non-browser is locked", () => {
    expect(isPreviewHost(undefined)).toBe(false);
    expect(isPreviewHost(null)).toBe(false);
    expect(isPreviewHost("")).toBe(false);
  });
});
