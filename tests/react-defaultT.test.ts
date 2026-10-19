import { describe, expect, it } from "vitest";
import { defaultT } from "../src/react/defaultT";

describe("defaultT", () => {
  it("humanizes the last key segment into sentence case", () => {
    expect(defaultT("auth.login.welcomeBack")).toBe("Welcome back");
    expect(defaultT("dashboard.notifications.markAllRead")).toBe("Mark all read");
  });

  it("splits snake_case and kebab-case segments", () => {
    expect(defaultT("a.deep_link.set-up")).toBe("Set up");
  });

  it("interpolates {{param}} placeholders it can place", () => {
    expect(defaultT("x.y.itemCount", { count: 3 })).toBe("Item count");
    expect(defaultT("x.y.ready{{count}}", { count: 3 })).toBe("Ready3");
  });

  it("falls back to the whole key when empty segments remain", () => {
    expect(defaultT("...")).toBe("...");
  });
});
