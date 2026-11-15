import { describe, expect, it } from "vitest";
import {
  flattenToDottedPaths,
  pruneToPaths,
  setByDottedPath,
} from "../src/application/services/dotted-key-helper";

describe("setByDottedPath", () => {
  it("creates intermediate objects and sets the leaf", () => {
    const target: Record<string, unknown> = {};
    expect(setByDottedPath(target, "nav.header.login", "Sign in")).toBe(true);
    expect(target).toEqual({ nav: { header: { login: "Sign in" } } });
  });

  it("returns false when a non-object intermediate conflicts", () => {
    const target: Record<string, unknown> = { nav: "flat" };
    expect(setByDottedPath(target, "nav.header.login", "x")).toBe(false);
    expect(target).toEqual({ nav: "flat" });
  });

  it("returns false instead of clobbering an existing object subtree with a scalar", () => {
    const target: Record<string, unknown> = {
      admin: { templates: { t1: { label: "Label", reason: "Reason" } } },
    };
    expect(setByDottedPath(target, "admin.templates.t1", "")).toBe(false);
    expect(target).toEqual({
      admin: { templates: { t1: { label: "Label", reason: "Reason" } } },
    });
  });

  it("keeps an existing subtree intact when pruning rebuilds around it", () => {
    const source = { keep: { a: "1" }, drop: { b: "2" } };
    const { pruned, removedPaths } = pruneToPaths(source, new Set(["keep.a"]));
    expect(pruned).toEqual({ keep: { a: "1" } });
    expect(removedPaths).toEqual(["drop.b"]);
  });
});

describe("flattenToDottedPaths", () => {
  it("produces leaf paths only", () => {
    const leaves = flattenToDottedPaths({
      nav: { home: "Home", section: { title: "Hi" } },
      cta: "Go",
    });
    expect([...leaves.keys()].sort()).toEqual(["cta", "nav.home", "nav.section.title"]);
  });
});
