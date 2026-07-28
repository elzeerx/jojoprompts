import { describe, expect, it } from "bun:test";
import {
  ADMIN_MOBILE_BREAKPOINT,
  defaultCatalogViewForWidth,
} from "./catalogView";

describe("admin catalog default view", () => {
  it("uses cards on mobile-sized screens", () => {
    expect(defaultCatalogViewForWidth(320)).toBe("card");
    expect(defaultCatalogViewForWidth(ADMIN_MOBILE_BREAKPOINT - 1)).toBe("card");
  });

  it("uses the operations table on tablet and desktop screens", () => {
    expect(defaultCatalogViewForWidth(ADMIN_MOBILE_BREAKPOINT)).toBe("table");
    expect(defaultCatalogViewForWidth(1440)).toBe("table");
  });
});
