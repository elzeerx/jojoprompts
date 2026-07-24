import { describe, it, expect } from "bun:test";
import { isProbeResultUnresolved } from "./probeResolution";

const validDetail = { counts: { pending: 0 } } as any;

describe("isProbeResultUnresolved", () => {
  it("is unresolved while loading", () => {
    expect(isProbeResultUnresolved({ isLoading: true })).toBe(true);
  });
  it("is unresolved while fetching", () => {
    expect(isProbeResultUnresolved({ isFetching: true, data: validDetail })).toBe(true);
  });
  it("is unresolved while pending", () => {
    expect(isProbeResultUnresolved({ isPending: true })).toBe(true);
  });
  it("is unresolved on error", () => {
    expect(isProbeResultUnresolved({ isError: true, data: validDetail })).toBe(true);
  });
  it("is unresolved when error object is set", () => {
    expect(isProbeResultUnresolved({ error: new Error("x"), data: validDetail })).toBe(true);
  });
  it("is unresolved when data is null", () => {
    expect(isProbeResultUnresolved({ data: null })).toBe(true);
  });
  it("is unresolved when data is missing", () => {
    expect(isProbeResultUnresolved({})).toBe(true);
  });
  it("is unresolved when counts is missing", () => {
    expect(isProbeResultUnresolved({ data: {} as any })).toBe(true);
  });
  it("is unresolved when counts.pending is not a number", () => {
    expect(isProbeResultUnresolved({ data: { counts: { pending: null } } as any })).toBe(true);
  });
  it("is resolved when detail has numeric counts.pending", () => {
    expect(isProbeResultUnresolved({ data: validDetail })).toBe(false);
  });
  it("is resolved when detail reports pending children", () => {
    expect(isProbeResultUnresolved({ data: { counts: { pending: 3 } } as any })).toBe(false);
  });
});
