import { describe, expect, it } from "bun:test";
import {
  allowedActions,
  isTransitionAllowed,
  nextLifecycle,
  requiresConfirmation,
  type Lifecycle,
  type LifecycleAction,
} from "./lifecycleTransitions";

const ALL_STATES: Lifecycle[] = ["draft", "review", "published", "archived"];
const ALL_ACTIONS: LifecycleAction[] = ["review", "publish", "archive", "restore"];

describe("lifecycleTransitions matrix", () => {
  it("draft: review/publish/archive allowed, restore denied", () => {
    expect(allowedActions("draft").sort()).toEqual(["archive","publish","review"]);
    expect(isTransitionAllowed("draft", "restore")).toBe(false);
  });
  it("review: publish/archive allowed only", () => {
    expect(allowedActions("review").sort()).toEqual(["archive","publish"]);
    expect(isTransitionAllowed("review", "review")).toBe(false);
  });
  it("published: only archive allowed", () => {
    expect(allowedActions("published")).toEqual(["archive"]);
    expect(isTransitionAllowed("published", "publish")).toBe(false);
  });
  it("archived: only restore allowed (no silent republish)", () => {
    expect(allowedActions("archived")).toEqual(["restore"]);
    expect(isTransitionAllowed("archived", "publish")).toBe(false);
    expect(isTransitionAllowed("archived", "review")).toBe(false);
  });
  it("restore always yields draft (documented safe state)", () => {
    expect(nextLifecycle("archived", "restore")).toBe("draft");
  });
  it("nextLifecycle returns null for invalid transitions and non-null for allowed ones", () => {
    for (const s of ALL_STATES) {
      for (const a of ALL_ACTIONS) {
        const allowed = isTransitionAllowed(s, a);
        const next = nextLifecycle(s, a);
        if (allowed) expect(next === null).toBe(false);
        else expect(next).toBeNull();
      }
    }
  });
  it("publish and archive require confirmation, restore/review do not", () => {
    expect(requiresConfirmation("publish")).toBe(true);
    expect(requiresConfirmation("archive")).toBe(true);
    expect(requiresConfirmation("restore")).toBe(false);
    expect(requiresConfirmation("review")).toBe(false);
  });
});
