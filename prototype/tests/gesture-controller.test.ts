import { afterEach, describe, expect, it, vi } from "vitest";
import {
  GestureController,
  type Gesture,
  type GestureTarget,
} from "../src/interaction/gesture-controller";

let now = 0;
const input = (
  pointerId: number,
  x: number,
  y: number,
  time: number,
  target: GestureTarget = "nox",
) => ({ pointerId, pointerType: "touch", x, y, time, target });

function controller(events: Gesture[]): GestureController {
  return new GestureController({
    onGesture: (gesture) => events.push(gesture),
    now: () => now,
  });
}

afterEach(() => vi.useRealTimers());

describe("GestureController", () => {
  it("recognizes a short, still tap", () => {
    const events: Gesture[] = [];
    const gestures = controller(events);
    gestures.pointerDown(input(1, 10, 10, 0));
    gestures.pointerUp(input(1, 14, 14, 120));
    expect(events).toEqual([{ kind: "tap", target: "nox", touchCount: 1 }]);
  });

  it("emits a double tap after its explicit 260ms decision gap", () => {
    vi.useFakeTimers();
    const events: Gesture[] = [];
    const gestures = controller(events);
    gestures.pointerDown(input(1, 0, 0, 0));
    gestures.pointerUp(input(1, 0, 0, 30));
    gestures.pointerDown(input(2, 0, 0, 140));
    gestures.pointerUp(input(2, 0, 0, 170));
    vi.advanceTimersByTime(260);
    expect(events.map((event) => event.kind)).toEqual(["tap", "doubleTap"]);
  });

  it("emits triple tap once instead of scheduling a double tap", () => {
    vi.useFakeTimers();
    const events: Gesture[] = [];
    const gestures = controller(events);
    for (const [id, at] of [
      [1, 0],
      [2, 130],
      [3, 260],
    ] as const) {
      gestures.pointerDown(input(id, 0, 0, at));
      gestures.pointerUp(input(id, 0, 0, at + 20));
    }
    vi.advanceTimersByTime(300);
    expect(events.map((event) => event.kind)).toEqual(["tap", "tripleTap"]);
  });

  it("requires the 480ms long-press dwell without drift", () => {
    vi.useFakeTimers();
    const events: Gesture[] = [];
    const gestures = controller(events);
    gestures.pointerDown(input(1, 0, 0, 0));
    vi.advanceTimersByTime(480);
    expect(events).toEqual([{ kind: "longPress", target: "nox" }]);
  });

  it("cancels a long press when movement exceeds the 8px tolerance", () => {
    vi.useFakeTimers();
    const events: Gesture[] = [];
    const gestures = controller(events);
    gestures.pointerDown(input(1, 0, 0, 0));
    gestures.pointerMove(input(1, 9, 0, 100));
    vi.advanceTimersByTime(480);
    expect(events).toEqual([]);
  });

  it("recognizes a fast, axis-dominant swipe", () => {
    const events: Gesture[] = [];
    const gestures = controller(events);
    gestures.pointerDown(input(1, 0, 0, 0));
    gestures.pointerUp(input(1, 60, 8, 100));
    expect(events).toEqual([
      { kind: "swipe", direction: "right", velocity: expect.any(Number) },
    ]);
  });

  it("rejects diagonal and slow drags as swipes", () => {
    const events: Gesture[] = [];
    const gestures = controller(events);
    gestures.pointerDown(input(1, 0, 0, 0));
    gestures.pointerUp(input(1, 55, 45, 100));
    gestures.pointerDown(input(2, 0, 0, 900));
    gestures.pointerUp(input(2, 60, 0, 1300));
    expect(events).toEqual([]);
  });

  it("uses the centroid for direct multi-touch", () => {
    const events: Gesture[] = [];
    const gestures = controller(events);
    gestures.pointerDown(input(1, 0, 0, 0));
    gestures.pointerDown(input(2, 20, 0, 0));
    gestures.pointerUp(input(1, 60, 0, 100));
    gestures.pointerUp(input(2, 80, 0, 100));
    expect(events).toEqual([
      { kind: "swipe", direction: "right", velocity: expect.any(Number) },
    ]);
  });

  it("cancels only the relevant pointer and ignores controls", () => {
    const events: Gesture[] = [];
    const gestures = controller(events);
    gestures.pointerDown(input(1, 0, 0, 0));
    gestures.pointerDown(input(2, 20, 0, 0));
    gestures.pointerCancel(1);
    gestures.pointerUp(input(2, 80, 0, 100));
    gestures.pointerDown(input(3, 0, 0, 120, "control"));
    gestures.pointerUp(input(3, 0, 0, 140, "control"));
    expect(events).toEqual([
      { kind: "swipe", direction: "right", velocity: expect.any(Number) },
    ]);
  });
});
