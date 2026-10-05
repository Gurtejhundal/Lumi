import { afterEach, describe, expect, it, vi } from "vitest";
import { InteractionArbiter } from "../src/interaction/interaction-arbiter";
import { modelForDemo } from "../src/state-machine";

afterEach(() => vi.useRealTimers());

function harness() {
  const applied: string[] = [];
  let now = 0;
  const arbiter = new InteractionArbiter({
    now: () => now,
    apply: (model) => applied.push(model.event),
    fallback: () => modelForDemo("idle"),
  });
  return {
    applied,
    arbiter,
    setNow: (value: number) => {
      now = value;
    },
  };
}

describe("InteractionArbiter", () => {
  it("releases the exact permission owner before rendering a resolved state", () => {
    const { applied, arbiter } = harness();
    arbiter.dispatch({
      id: "permission:request-7",
      kind: "permission",
      ownerKey: "request-7",
      model: modelForDemo("permission"),
      priority: "permission",
      locks: true,
    });
    expect(
      arbiter.dispatch({
        id: "volume",
        model: modelForDemo("volume"),
        priority: "systemHud",
      }),
    ).toBe(false);
    expect(arbiter.releaseByKind("permission", "wrong-request")).toBe(false);
    expect(arbiter.releaseByKind("permission", "request-7")).toBe(true);
    expect(
      arbiter.dispatch({
        id: "resolved:request-7",
        model: modelForDemo("success"),
        priority: "activeAgent",
      }),
    ).toBe(true);
    expect(applied).toEqual(["permission", "success"]);
    arbiter.destroy();
  });

  it("keeps normal background ownership priority-ordered", () => {
    const { arbiter } = harness();
    arbiter.dispatch({
      id: "agent",
      model: modelForDemo("thinking"),
      priority: "activeAgent",
    });
    expect(
      arbiter.dispatch({
        id: "hud",
        model: modelForDemo("volume"),
        priority: "systemHud",
      }),
    ).toBe(false);
    arbiter.dispatch({
      id: "failure",
      kind: "failure",
      model: modelForDemo("failure"),
      priority: "failure",
      expiresAfterMs: 2_800,
    });
    expect(
      arbiter.dispatch({
        id: "agent-update",
        model: modelForDemo("editing"),
        priority: "activeAgent",
      }),
    ).toBe(false);
    arbiter.dispatch({
      id: "privacy:microphone",
      kind: "privacy",
      ownerKey: "microphone",
      model: modelForDemo("notification"),
      priority: "privacy",
      locks: true,
    });
    expect(
      arbiter.dispatch({
        id: "failure-update",
        model: modelForDemo("failure"),
        priority: "failure",
      }),
    ).toBe(false);
    arbiter.dispatch({
      id: "permission:request-8",
      kind: "permission",
      ownerKey: "request-8",
      model: modelForDemo("permission"),
      priority: "permission",
      locks: true,
    });
    expect(
      arbiter.dispatch({
        id: "privacy-update",
        model: modelForDemo("notification"),
        priority: "privacy",
      }),
    ).toBe(false);
    arbiter.destroy();
  });

  it("does not permanently lock file, failure, or inactive privacy", () => {
    const { arbiter } = harness();
    arbiter.dispatch({
      id: "file",
      kind: "fileDrop",
      model: modelForDemo("file"),
      priority: "fileDrop",
      expiresAfterMs: 3_500,
    });
    expect(
      arbiter.navigate({
        id: "user-rest",
        model: modelForDemo("idle"),
        priority: "idle",
      }),
    ).toBe(true);
    arbiter.dispatch({
      id: "privacy:camera",
      kind: "privacy",
      ownerKey: "camera",
      model: modelForDemo("notification"),
      priority: "privacy",
      locks: true,
    });
    expect(arbiter.releaseByKind("privacy", "camera")).toBe(true);
    expect(
      arbiter.dispatch({
        id: "privacy-inactive",
        model: modelForDemo("volume"),
        priority: "systemHud",
      }),
    ).toBe(true);
    arbiter.destroy();
  });

  it("visually restores the prior state when a HUD expires and refreshes its timer", () => {
    vi.useFakeTimers();
    const { applied, arbiter, setNow } = harness();
    arbiter.dispatch({
      id: "rest",
      model: modelForDemo("idle"),
      priority: "idle",
    });
    arbiter.dispatch({
      id: "volume",
      model: modelForDemo("volume"),
      priority: "systemHud",
      expiresAfterMs: 1_200,
    });
    setNow(1_000);
    vi.advanceTimersByTime(1_000);
    arbiter.dispatch({
      id: "volume",
      model: modelForDemo("volume"),
      priority: "systemHud",
      expiresAfterMs: 1_200,
    });
    setNow(2_199);
    vi.advanceTimersByTime(1_199);
    expect(applied.at(-1)).toBe("volume");
    setNow(2_200);
    vi.advanceTimersByTime(1);
    expect(applied).toEqual(["idle", "volume", "volume", "idle"]);
    arbiter.destroy();
  });

  it("drops stale HUD work instead of replaying it later", () => {
    const { applied, arbiter, setNow } = harness();
    setNow(5_000);
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
    arbiter.destroy();
  });

  it("returns to PETIT when an expiring surface has no prior owner", () => {
    vi.useFakeTimers();
    const { applied, arbiter, setNow } = harness();
    arbiter.dispatch({
      id: "media",
      model: modelForDemo("media"),
      priority: "media",
      expiresAfterMs: 1_200,
    });
    setNow(1_200);
    vi.advanceTimersByTime(1_200);
    expect(applied.map((event) => event)).toEqual(["media", "idle"]);
    arbiter.destroy();
  });
});
