import type { NoxEmotion } from "./state-machine";

export type NoxTrigger =
  | "press"
  | "release"
  | "annoyed"
  | "dizzy"
  | "success"
  | "failure"
  | "fileCatch"
  | "attention";

export interface NoxRendererOptions {
  reducedMotion: boolean;
  emotion: NoxEmotion;
  activity: boolean;
  visible: boolean;
}

export interface NoxMotionSample {
  squash: number;
  hop: number;
  drop: number;
  wingBoost: number;
  fileCatch: number;
  dizzy: number;
  annoyed: number;
  attention: number;
}

interface Pointer {
  x: number;
  y: number;
  active: boolean;
}

const clamp = (value: number, low: number, high: number) =>
  Math.max(low, Math.min(high, value));

const eased = (value: number) => 1 - Math.pow(1 - clamp(value, 0, 1), 3);

/** One-shot character impulses. None of these values are persistent states. */
export class NoxMotion {
  private last = 0;
  private squash = 0;
  private squashVelocity = 0;
  private pressed = false;
  private dizzyUntil = 0;
  private annoyedUntil = 0;
  private successAt = -1;
  private failureAt = -1;
  private fileCatchAt = -1;
  private attentionUntil = 0;

  public trigger(trigger: NoxTrigger, now = performance.now()): boolean {
    switch (trigger) {
      case "press":
        this.pressed = true;
        return true;
      case "release":
        this.pressed = false;
        this.annoyedUntil = now + 560;
        return true;
      case "annoyed":
        this.annoyedUntil = now + 560;
        return true;
      case "dizzy":
        if (now < this.dizzyUntil) return false;
        this.dizzyUntil = now + 2100;
        return true;
      case "success":
        this.successAt = now;
        return true;
      case "failure":
        this.failureAt = now;
        return true;
      case "fileCatch":
        this.fileCatchAt = now;
        return true;
      case "attention":
        this.attentionUntil = now + 480;
        return true;
    }
  }

  public sample(now: number): NoxMotionSample {
    const dt = Math.min(0.034, Math.max(0.001, (now - this.last || 16) / 1000));
    this.last = now;
    const target = this.pressed ? 1 : 0;
    this.squashVelocity += (target - this.squash) * 205 * dt;
    this.squashVelocity *= Math.exp(-15 * dt);
    this.squash += this.squashVelocity * dt;

    const successAge = this.successAt < 0 ? Infinity : now - this.successAt;
    const failureAge = this.failureAt < 0 ? Infinity : now - this.failureAt;
    const fileAge = this.fileCatchAt < 0 ? Infinity : now - this.fileCatchAt;
    const success = successAge < 1100 ? successAge / 1100 : -1;
    const preHop = success >= 0 && success < 0.18 ? eased(success / 0.18) : 0;
    const hop =
      success >= 0.13 && success < 0.64
        ? Math.sin(((success - 0.13) / 0.51) * Math.PI) * 7.2
        : 0;
    const failure =
      failureAge < 510 ? Math.sin((failureAge / 510) * Math.PI) * 2.8 : 0;
    const catchProgress =
      fileAge < 820 ? Math.sin((fileAge / 820) * Math.PI) : 0;

    return {
      squash: clamp(this.squash + preHop * 0.7, -0.2, 1.15),
      hop,
      drop: failure,
      wingBoost: success >= 0 && success < 0.76 ? 0.5 : 0,
      fileCatch: catchProgress,
      dizzy: now < this.dizzyUntil ? (this.dizzyUntil - now) / 2100 : 0,
      annoyed: now < this.annoyedUntil ? (this.annoyedUntil - now) / 560 : 0,
      attention:
        now < this.attentionUntil ? (this.attentionUntil - now) / 480 : 0,
    };
  }
}

export class NoxRenderer {
  private readonly context: CanvasRenderingContext2D;
  private readonly resizeObserver: ResizeObserver;
  private readonly motion = new NoxMotion();
  private frame = 0;
  private last = 0;
  private nextBlink = 0;
  private blinkStart = -1;
  private doubleBlink = false;
  private gaze = { x: 0, y: 0 };
  private pointer: Pointer = { x: 0, y: 0, active: false };
  private pointerSince = 0;
  private options: NoxRendererOptions = {
    reducedMotion: false,
    emotion: "neutral",
    activity: false,
    visible: true,
  };

  public constructor(private readonly canvas: HTMLCanvasElement) {
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Canvas 2D is not available.");
    this.context = context;
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(canvas);
    this.resize();
  }

  public update(options: Partial<NoxRendererOptions>): void {
    this.options = { ...this.options, ...options };
    if (this.options.visible && !this.frame) this.start();
    if (!this.options.visible) this.stop();
  }

  public setPointer(x: number, y: number, active: boolean): void {
    if (active && !this.pointer.active) {
      this.pointerSince = performance.now();
      this.motion.trigger("attention", this.pointerSince);
    }
    this.pointer = { x, y, active };
  }

  public trigger(trigger: NoxTrigger): boolean {
    const accepted = this.motion.trigger(trigger);
    if (accepted) this.start();
    return accepted;
  }

  public destroy(): void {
    this.stop();
    this.resizeObserver.disconnect();
  }

  private resize(): void {
    const bounds = this.canvas.getBoundingClientRect();
    const dpr = clamp(window.devicePixelRatio || 1, 1, 2);
    this.canvas.width = Math.max(1, Math.round(bounds.width * dpr));
    this.canvas.height = Math.max(1, Math.round(bounds.height * dpr));
    this.context.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  private start(): void {
    if (!this.frame && this.options.visible) {
      this.frame = requestAnimationFrame((now) => this.render(now));
    }
  }

  private stop(): void {
    if (this.frame) cancelAnimationFrame(this.frame);
    this.frame = 0;
    this.context.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }

  private blink(now: number): number {
    if (this.options.reducedMotion) return 1;
    if (!this.nextBlink) this.nextBlink = now + 4600 + Math.random() * 3900;
    if (now >= this.nextBlink && this.blinkStart < 0) {
      this.blinkStart = now;
      this.doubleBlink = Math.random() < 0.14;
    }
    if (this.blinkStart < 0) return 1;
    const elapsed = now - this.blinkStart;
    const close = 54;
    const hold = 28;
    const open = 98;
    const first = close + hold + open;
    const gap = 70;
    const secondStart = first + gap;
    const total = this.doubleBlink ? secondStart + first : first;
    if (elapsed >= total) {
      this.blinkStart = -1;
      this.nextBlink = now + 4500 + Math.random() * 4000;
      return 1;
    }
    if (this.doubleBlink && elapsed >= first && elapsed < secondStart) return 1;
    const local =
      this.doubleBlink && elapsed >= secondStart
        ? elapsed - secondStart
        : elapsed;
    if (local < close) return clamp(1 - local / close, 0.04, 1);
    if (local < close + hold) return 0.04;
    return clamp((local - close - hold) / open, 0.04, 1);
  }

  private mantaPath(
    cx: number,
    cy: number,
    scale: number,
    leftWingLift: number,
    rightWingLift: number,
    tailCurl: number,
    breath: number,
  ): Path2D {
    const width = 36 * scale * (1 + breath * 0.018);
    const height = 16.5 * scale * (1 + breath * 0.026);
    const leftLift = 7 * scale * leftWingLift;
    const rightLift = 7 * scale * rightWingLift;
    const path = new Path2D();
    path.moveTo(cx, cy - height * 0.94);
    path.bezierCurveTo(
      cx - width * 0.18,
      cy - height * 1.19,
      cx - width * 0.67,
      cy - height * 0.88 - leftLift,
      cx - width,
      cy - height * 0.1 - leftLift,
    );
    path.bezierCurveTo(
      cx - width * 0.81,
      cy + height * 0.36,
      cx - width * 0.43,
      cy + height * 0.72,
      cx - width * 0.1,
      cy + height * 0.4,
    );
    path.bezierCurveTo(
      cx - width * 0.01,
      cy + height * 0.68,
      cx - width * 0.07,
      cy + height * 0.82,
      cx + tailCurl * 4 * scale,
      cy + height * 0.9,
    );
    path.bezierCurveTo(
      cx + width * 0.17 + tailCurl * 7 * scale,
      cy + height * 1.02,
      cx + width * 0.18 + tailCurl * 5 * scale,
      cy + height * 0.7,
      cx + width * 0.11,
      cy + height * 0.4,
    );
    path.bezierCurveTo(
      cx + width * 0.43,
      cy + height * 0.72,
      cx + width * 0.81,
      cy + height * 0.36,
      cx + width,
      cy - height * 0.1 - rightLift,
    );
    path.bezierCurveTo(
      cx + width * 0.67,
      cy - height * 0.88 - rightLift,
      cx + width * 0.18,
      cy - height * 1.19,
      cx,
      cy - height * 0.94,
    );
    path.closePath();
    return path;
  }

  private eye(
    x: number,
    y: number,
    width: number,
    openness: number,
    slant: number,
    pupilX: number,
    pupilY: number,
    alpha: number,
  ): void {
    const ctx = this.context;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(slant);
    ctx.globalAlpha = alpha;
    const height = Math.max(1.35, width * 0.34 * openness);
    ctx.beginPath();
    ctx.roundRect(-width / 2, -height / 2, width, height, height);
    ctx.fillStyle = "rgba(228, 240, 255, 0.98)";
    ctx.fill();
    if (openness > 0.35) {
      ctx.beginPath();
      ctx.ellipse(
        pupilX,
        pupilY,
        width * 0.1,
        height * 0.39,
        0,
        0,
        Math.PI * 2,
      );
      ctx.fillStyle = "rgba(13, 19, 29, 0.96)";
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(
        pupilX - width * 0.025,
        pupilY - height * 0.15,
        Math.max(0.55, width * 0.03),
        Math.max(0.45, height * 0.15),
        0,
        0,
        Math.PI * 2,
      );
      ctx.fillStyle = "rgba(255, 255, 255, 0.88)";
      ctx.fill();
    }
    ctx.restore();
  }

  private render(now: number): void {
    this.frame = 0;
    const dt = Math.min(34, now - this.last || 16);
    this.last = now;
    const ctx = this.context;
    const dpr = clamp(window.devicePixelRatio || 1, 1, 2);
    const width = this.canvas.width / dpr;
    const height = this.canvas.height / dpr;
    ctx.clearRect(0, 0, width, height);

    const reduced = this.options.reducedMotion;
    const wave = reduced ? 0 : now;
    const motion = this.motion.sample(now);
    const breath = (1 - Math.cos((wave / 3560) * Math.PI * 2)) * 0.5;
    const driftX = reduced
      ? 0
      : Math.sin(wave / 1900) * 1.1 + Math.sin(wave / 3130) * 0.6;
    const driftY = reduced ? 0 : Math.sin(wave / 2410) * 0.8;
    const baseScale = Math.min(width / 104, height / 61);
    const mood = this.options.emotion;
    const hoverAge = this.pointer.active ? now - this.pointerSince : 0;
    const hoverLean = hoverAge > 50 ? clamp((hoverAge - 50) / 240, 0, 1) : 0;

    let leftWing = this.pointer.active ? 0.36 + hoverLean * 0.24 : 0.16;
    let rightWing = this.pointer.active ? 0.27 + hoverLean * 0.1 : 0.16;
    if (this.options.activity) {
      const activityLift = Math.sin(wave / 760) * 0.1;
      leftWing += activityLift;
      rightWing += activityLift;
    }
    if (mood === "pleased") leftWing = rightWing = 0.78;
    if (mood === "worried" || mood === "sleepy") leftWing = rightWing = -0.08;
    leftWing += motion.wingBoost + motion.fileCatch * 0.35;
    rightWing +=
      motion.wingBoost + motion.fileCatch * 0.2 + motion.attention * 0.1;
    leftWing -= motion.annoyed * 0.22;
    const wobble = motion.dizzy ? Math.sin(wave / 49) * 0.16 * motion.dizzy : 0;
    const tailCurl = motion.dizzy
      ? Math.sin(wave / 93) * motion.dizzy
      : motion.fileCatch * 0.42;

    const canvasBounds = this.canvas.getBoundingClientRect();
    const targetX = this.pointer.active
      ? clamp(
          (this.pointer.x - (canvasBounds.left + canvasBounds.width / 2)) / 30,
          -2.7,
          2.7,
        )
      : 0;
    const targetY = this.pointer.active
      ? clamp(
          (this.pointer.y - (canvasBounds.top + canvasBounds.height / 2)) / 30,
          -1.6,
          1.6,
        )
      : 0;
    const blend = 1 - Math.exp(-dt / 90);
    this.gaze.x += (targetX - this.gaze.x) * blend;
    this.gaze.y += (targetY - this.gaze.y) * blend;

    ctx.save();
    ctx.translate(
      width / 2 + driftX,
      height / 2 + 2 + driftY + motion.drop - motion.hop,
    );
    ctx.rotate(
      wobble +
        hoverLean * this.gaze.x * 0.018 +
        motion.annoyed * 0.052 +
        (mood === "working" ? Math.sin(wave / 1260) * 0.025 : 0),
    );
    ctx.scale(1 + motion.squash * 0.11, 1 - motion.squash * 0.17);
    const body = this.mantaPath(
      0,
      0,
      baseScale,
      leftWing,
      rightWing,
      tailCurl,
      breath,
    );
    const fill = ctx.createLinearGradient(
      0,
      -26 * baseScale,
      0,
      31 * baseScale,
    );
    fill.addColorStop(
      0,
      mood === "worried"
        ? "rgba(139, 144, 159, 0.98)"
        : "rgba(187, 194, 224, 0.98)",
    );
    fill.addColorStop(0.46, "rgba(96, 105, 144, 0.99)");
    fill.addColorStop(1, "rgba(31, 38, 61, 0.99)");
    ctx.shadowColor =
      mood === "pleased"
        ? "rgba(123, 235, 202, .28)"
        : "rgba(111, 154, 255, .19)";
    ctx.shadowBlur = 15 * baseScale;
    ctx.fillStyle = fill;
    ctx.fill(body);
    ctx.shadowBlur = 0;
    ctx.strokeStyle = "rgba(255,255,255,.16)";
    ctx.lineWidth = Math.max(0.8, baseScale * 0.9);
    ctx.stroke(body);

    ctx.save();
    ctx.globalAlpha = 0.26;
    ctx.strokeStyle = "rgba(229, 239, 255, .72)";
    ctx.lineWidth = Math.max(0.65, baseScale * 0.64);
    ctx.beginPath();
    ctx.bezierCurveTo(
      -7.2 * baseScale,
      -10.1 * baseScale,
      0,
      -15.2 * baseScale,
      7.9 * baseScale,
      -9.2 * baseScale,
    );
    ctx.stroke();
    ctx.restore();

    let openness = this.blink(now) + (hoverAge > 50 ? 0.08 * hoverLean : 0);
    let leftSlant = 0.03;
    let rightSlant = -0.03;
    if (mood === "curious") {
      openness = Math.max(openness, 0.9);
      leftSlant = -0.08;
      rightSlant = 0.08;
    }
    if (mood === "pleased") {
      openness = Math.min(openness, 0.68);
      leftSlant = -0.15;
      rightSlant = 0.15;
    }
    if (mood === "worried") {
      openness = Math.min(openness, 0.65);
      leftSlant = 0.14;
      rightSlant = -0.14;
    }
    if (mood === "sleepy") openness = Math.min(openness, 0.46);
    if (motion.annoyed > 0) {
      leftSlant = -0.28;
      rightSlant = 0.12;
    }
    const eyeX = 10.7 * baseScale;
    const eyeY = -4.2 * baseScale;
    const orbitX = motion.dizzy ? Math.cos(wave / 126) * 2.4 : this.gaze.x;
    const orbitY = motion.dizzy ? Math.sin(wave / 126) * 1.4 : this.gaze.y;
    const alpha = mood === "sleepy" ? 0.62 : 1;
    this.eye(
      -eyeX,
      eyeY,
      12.4 * baseScale,
      openness,
      leftSlant,
      orbitX,
      orbitY,
      alpha,
    );
    this.eye(
      eyeX,
      eyeY,
      12.4 * baseScale,
      openness,
      rightSlant,
      motion.dizzy ? -orbitX : this.gaze.x,
      motion.dizzy ? -orbitY : this.gaze.y,
      alpha,
    );
    ctx.restore();
    this.start();
  }
}
