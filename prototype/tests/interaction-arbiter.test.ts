import { describe, expect, it } from "vitest";
import { InteractionArbiter } from "../src/interaction/interaction-arbiter";
import { modelForDemo } from "../src/state-machine";

describe("InteractionArbiter", () => {
  it("does not let hover or system HUD work overwrite an open permission", () => {
    const applied: string[] = [];
    let now = 0;
    const arbiter = new InteractionArbiter({
      now: () => now,
      apply: (model) => applied.push(model.event),
    });
    expect(
      arbiter.dispatch({
        id: "permission",
        model: modelForDemo("permission"),
        priority: "permission",
        locks: true,
      }),
    ).toBe(true);
    now = 50;
    expect(
      arbiter.dispatch({
        id: "hud",
        model: modelForDemo("volume"),
        priority: "systemHud",
      }),
    ).toBe(false);
    expect(
      arbiter.dispatch({
        id: "hover",
        model: modelForDemo("idle"),
        priority: "hover",
      }),
    ).toBe(false);
    expect(applied).toEqual(["permission"]);
  });

  it("allows permission resolution to release ownership", () => {
    const applied: string[] = [];
    const arbiter = new InteractionArbiter({
      apply: (model) => applied.push(model.event),
    });
    arbiter.dispatch({
      id: "permission",
      model: modelForDemo("permission"),
      priority: "permission",
      locks: true,
    });
    arbiter.release("permission");
    expect(
      arbiter.dispatch({
        id: "resolved",
        model: modelForDemo("success"),
        priority: "activeAgent",
      }),
    ).toBe(true);
    expect(applied).toEqual(["permission", "success"]);
  });

  it("drops a stale HUD instead of resurfacing it after meaningful work", () => {
    const applied: string[] = [];
    let now = 5_000;
    const arbiter = new InteractionArbiter({
      now: () => now,
      apply: (model) => applied.push(model.event),
    });
    expect(
      arbiter.dispatch({
        id: "late-hud",
        model: modelForDemo("volume"),
        priority: "systemHud",
        createdAt: 0,
        expiresAfterMs: 1_200,
      }),
    ).toBe(false);
    expect(applied).toEqual([]);
    now = 5_010;
  });
});
