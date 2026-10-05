export type GestureTarget = "nox" | "island" | "background" | "control";

export type Gesture =
  | { kind: "tap"; target: GestureTarget; touchCount: number }
  | { kind: "doubleTap"; target: GestureTarget }
  | { kind: "tripleTap"; target: GestureTarget }
  | { kind: "longPress"; target: GestureTarget }
  | {
      kind: "swipe";
      direction: "left" | "right" | "up" | "down";
      velocity: number;
    }
  | { kind: "wheelIntent"; delta: number }
  | { kind: "secondaryTap"; target: GestureTarget };

export interface PointerInput {
  pointerId: number;
  pointerType: string;
  x: number;
  y: number;
  target: GestureTarget;
  time: number;
}

export interface GestureControllerOptions {
  onGesture: (gesture: Gesture) => void;
  onPress?: (target: GestureTarget) => void;
  onRelease?: (target: GestureTarget) => void;
  now?: () => number;
}

interface TrackedPointer extends PointerInput {
  lastX: number;
  lastY: number;
  lastTime: number;
  moved: boolean;
}

const TAP_MOVEMENT = 8;
const TAP_DURATION = 220;
const DOUBLE_TAP_GAP = 260;
const TRIPLE_TAP_TOTAL = 600;
const LONG_PRESS_DELAY = 480;
const SWIPE_DISTANCE = 48;
const SWIPE_VELOCITY = 0.35;
const AXIS_RATIO = 1.3;

const distance = (x: number, y: number) => Math.hypot(x, y);

export class GestureController {
  private readonly now: () => number;
  private readonly active = new Map<number, TrackedPointer>();
  private readonly finished: TrackedPointer[] = [];
  private sessionTarget: GestureTarget = "background";
  private sessionStartedAt = 0;
  private maxTouchCount = 0;
  private sessionConsumed = false;
  private longPressTimer: ReturnType<typeof setTimeout> | undefined;
  private taps: Array<{ at: number; target: GestureTarget }> = [];
  private doubleTapTimer: ReturnType<typeof setTimeout> | undefined;

  public constructor(private readonly options: GestureControllerOptions) {
    this.now = options.now ?? (() => performance.now());
  }

  public attach(
    root: HTMLElement,
    targetFor: (target: EventTarget | null) => GestureTarget,
  ): () => void {
    const down = (event: PointerEvent) => {
      const target = targetFor(event.target);
      this.pointerDown({
        pointerId: event.pointerId,
        pointerType: event.pointerType,
        x: event.clientX,
        y: event.clientY,
        target,
        time: this.now(),
      });
      if (target !== "control") root.setPointerCapture?.(event.pointerId);
    };
    const move = (event: PointerEvent) =>
      this.pointerMove({
        pointerId: event.pointerId,
        pointerType: event.pointerType,
        x: event.clientX,
        y: event.clientY,
        target: targetFor(event.target),
        time: this.now(),
      });
    const up = (event: PointerEvent) =>
      this.pointerUp({
        pointerId: event.pointerId,
        pointerType: event.pointerType,
        x: event.clientX,
        y: event.clientY,
        target: targetFor(event.target),
        time: this.now(),
      });
    const cancel = (event: PointerEvent) => this.pointerCancel(event.pointerId);
    const wheel = (event: WheelEvent) => {
      if (targetFor(event.target) !== "control") {
        this.options.onGesture({ kind: "wheelIntent", delta: event.deltaY });
      }
    };
    const contextMenu = (event: MouseEvent) => {
      const target = targetFor(event.target);
      if (target === "control") return;
      event.preventDefault();
      this.options.onGesture({ kind: "secondaryTap", target });
    };

    root.addEventListener("pointerdown", down);
    root.addEventListener("pointermove", move);
    root.addEventListener("pointerup", up);
    root.addEventListener("pointercancel", cancel);
    root.addEventListener("wheel", wheel, { passive: true });
    root.addEventListener("contextmenu", contextMenu);
    return () => {
      root.removeEventListener("pointerdown", down);
      root.removeEventListener("pointermove", move);
      root.removeEventListener("pointerup", up);
      root.removeEventListener("pointercancel", cancel);
      root.removeEventListener("wheel", wheel);
      root.removeEventListener("contextmenu", contextMenu);
      this.destroy();
    };
  }

  public pointerDown(input: PointerInput): void {
    if (input.target === "control") return;
    if (!this.active.size) {
      this.finished.length = 0;
      this.sessionTarget = input.target;
      this.sessionStartedAt = input.time;
      this.maxTouchCount = 0;
      this.sessionConsumed = false;
    }
    this.active.set(input.pointerId, {
      ...input,
      lastX: input.x,
      lastY: input.y,
      lastTime: input.time,
      moved: false,
    });
    this.maxTouchCount = Math.max(this.maxTouchCount, this.active.size);
    if (input.target === "nox") this.options.onPress?.(input.target);
    if (this.active.size === 1) this.startLongPress(input);
  }

  public pointerMove(input: PointerInput): void {
    const pointer = this.active.get(input.pointerId);
    if (!pointer) return;
    pointer.lastX = input.x;
    pointer.lastY = input.y;
    pointer.lastTime = input.time;
    if (distance(input.x - pointer.x, input.y - pointer.y) > TAP_MOVEMENT) {
      pointer.moved = true;
      this.cancelLongPress();
    }
  }

  public pointerUp(input: PointerInput): void {
    const pointer = this.active.get(input.pointerId);
    if (!pointer) return;
    this.pointerMove(input);
    const finished = this.active.get(input.pointerId);
    if (!finished) return;
    this.active.delete(input.pointerId);
    this.finished.push(finished);
    if (finished.target === "nox") this.options.onRelease?.(finished.target);
    if (this.active.size) return;
    this.cancelLongPress();
    this.completeSession(input.time);
  }

  public pointerCancel(pointerId: number): void {
    if (!this.active.has(pointerId)) return;
    this.active.delete(pointerId);
    this.maxTouchCount = this.active.size;
    if (this.active.size) return;
    this.cancelLongPress();
    this.finished.length = 0;
    this.sessionConsumed = true;
  }

  public destroy(): void {
    this.cancelLongPress();
    if (this.doubleTapTimer) clearTimeout(this.doubleTapTimer);
    this.doubleTapTimer = undefined;
    this.active.clear();
    this.finished.length = 0;
  }

  private startLongPress(input: PointerInput): void {
    this.cancelLongPress();
    this.longPressTimer = setTimeout(() => {
      const pointer = this.active.get(input.pointerId);
      if (!pointer || pointer.moved || this.active.size !== 1) return;
      this.sessionConsumed = true;
      this.options.onGesture({ kind: "longPress", target: pointer.target });
    }, LONG_PRESS_DELAY);
  }

  private cancelLongPress(): void {
    if (this.longPressTimer) clearTimeout(this.longPressTimer);
    this.longPressTimer = undefined;
  }

  private completeSession(now: number): void {
    if (this.sessionConsumed || !this.finished.length) return;
    const start = this.centroid(this.finished, "start");
    const end = this.centroid(this.finished, "end");
    const elapsed = Math.max(1, now - this.sessionStartedAt);
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const travel = distance(dx, dy);
    const velocity = travel / elapsed;
    const horizontal = Math.abs(dx) / Math.max(1, Math.abs(dy));
    const vertical = Math.abs(dy) / Math.max(1, Math.abs(dx));

    if (
      travel >= SWIPE_DISTANCE &&
      velocity >= SWIPE_VELOCITY &&
      (horizontal >= AXIS_RATIO || vertical >= AXIS_RATIO)
    ) {
      this.options.onGesture({
        kind: "swipe",
        direction:
          horizontal >= AXIS_RATIO
            ? dx < 0
              ? "left"
              : "right"
            : dy < 0
              ? "up"
              : "down",
        velocity,
      });
      return;
    }

    if (travel <= TAP_MOVEMENT && elapsed <= TAP_DURATION) {
      if (this.maxTouchCount > 1) {
        this.options.onGesture({
          kind: "tap",
          target: this.sessionTarget,
          touchCount: this.maxTouchCount,
        });
      } else {
        this.recordTap(now, this.sessionTarget);
      }
    }
  }

  private recordTap(now: number, target: GestureTarget): void {
    this.taps = this.taps.filter((tap) => now - tap.at <= TRIPLE_TAP_TOTAL);
    const previous = this.taps.at(-1);
    if (
      !previous ||
      previous.target !== target ||
      now - previous.at > DOUBLE_TAP_GAP
    ) {
      this.taps = [{ at: now, target }];
      this.options.onGesture({ kind: "tap", target, touchCount: 1 });
      return;
    }
    this.taps.push({ at: now, target });
    if (this.taps.length >= 3 && now - this.taps[0].at <= TRIPLE_TAP_TOTAL) {
      if (this.doubleTapTimer) clearTimeout(this.doubleTapTimer);
      this.doubleTapTimer = undefined;
      this.taps = [];
      this.options.onGesture({ kind: "tripleTap", target });
      return;
    }
    if (this.doubleTapTimer) clearTimeout(this.doubleTapTimer);
    this.doubleTapTimer = setTimeout(() => {
      this.options.onGesture({ kind: "doubleTap", target });
      this.taps = [];
      this.doubleTapTimer = undefined;
    }, DOUBLE_TAP_GAP);
  }

  private centroid(
    points: TrackedPointer[],
    phase: "start" | "end",
  ): { x: number; y: number } {
    const sum = points.reduce(
      (total, point) => ({
        x: total.x + (phase === "start" ? point.x : point.lastX),
        y: total.y + (phase === "start" ? point.y : point.lastY),
      }),
      { x: 0, y: 0 },
    );
    return { x: sum.x / points.length, y: sum.y / points.length };
  }
}

export const gestureThresholds = {
  tapMovement: TAP_MOVEMENT,
  tapDuration: TAP_DURATION,
  doubleTapGap: DOUBLE_TAP_GAP,
  tripleTapTotal: TRIPLE_TAP_TOTAL,
  longPress: LONG_PRESS_DELAY,
  swipeDistance: SWIPE_DISTANCE,
  swipeVelocity: SWIPE_VELOCITY,
  axisRatio: AXIS_RATIO,
};
