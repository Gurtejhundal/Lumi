import { describe, expect, it } from "vitest";
import { NoxMotion } from "../src/nox";

describe("NoxMotion", () => {
  it("settles a success impulse by 1.1 seconds", () => {
    const motion = new NoxMotion();
    motion.trigger("success", 0);
    expect(motion.sample(300).hop).toBeGreaterThan(0);
    const settled = motion.sample(1_101);
    expect(settled.hop).toBe(0);
    expect(settled.wingBoost).toBe(0);
  });

  it("uses a temporary asymmetric annoyed expression", () => {
    const motion = new NoxMotion();
    motion.trigger("annoyed", 0);
    expect(motion.sample(120).annoyed).toBeGreaterThan(0);
    expect(motion.sample(561).annoyed).toBe(0);
  });

  it("locks repeated dizzy triggers until the one-shot completes", () => {
    const motion = new NoxMotion();
    expect(motion.trigger("dizzy", 0)).toBe(true);
    expect(motion.trigger("dizzy", 100)).toBe(false);
    expect(motion.trigger("dizzy", 2_101)).toBe(true);
  });

  it("settles a failure rather than leaving a persistent failed pose", () => {
    const motion = new NoxMotion();
    motion.trigger("failure", 0);
    expect(motion.sample(200).drop).toBeGreaterThan(0);
    expect(motion.sample(511).drop).toBe(0);
  });
});
