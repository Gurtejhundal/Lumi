import type { IslandModel, RuntimeEvent } from "../state-machine";

export const InteractionPriority = {
  idle: 0,
  hover: 100,
  media: 200,
  systemHud: 300,
  activeAgent: 400,
  failure: 500,
  fileDrop: 600,
  privacy: 700,
  permission: 800,
} as const;

export type InteractionPriorityName = keyof typeof InteractionPriority;
export type InteractionKind = "permission" | "privacy" | "fileDrop" | "failure";

export interface ArbitrationIntent {
  id: string;
  model: IslandModel;
  priority: InteractionPriorityName;
  kind?: InteractionKind;
  ownerKey?: string;
  createdAt?: number;
  expiresAfterMs?: number;
  locks?: boolean;
}

export interface InteractionArbiterOptions {
  apply: (model: IslandModel) => void;
  fallback: () => IslandModel;
  now?: () => number;
}

interface ActiveIntent extends ArbitrationIntent {
  createdAt: number;
  returnTo?: ActiveIntent;
}

export function priorityForRuntimeEvent(
  event: RuntimeEvent,
): InteractionPriorityName {
  switch (event.type) {
    case "permission_requested":
      return "permission";
    case "privacy":
      return event.active ? "privacy" : "systemHud";
    case "file_read":
    case "file_edit":
      return "activeAgent";
    case "command_finished":
      return event.exitCode === 0 ? "activeAgent" : "failure";
    case "session_finished":
      return event.outcome === "success" ? "activeAgent" : "failure";
    case "thinking":
    case "command_started":
    case "session_started":
    case "assistant_status":
    case "assistant_response":
      return "activeAgent";
    case "volume":
    case "brightness":
    case "battery":
    case "bluetooth":
    case "network":
      return "systemHud";
    case "media":
      return "media";
    case "permission_resolved":
      return "activeAgent";
  }
}

/**
 * Keeps a single visual owner. Background events obey priority; explicit user
 * navigation is separate and cannot dismiss a hard permission/privacy lock.
 * Transient owners return to the last meaningful state on expiry.
 */
export class InteractionArbiter {
  private readonly now: () => number;
  private active: ActiveIntent | undefined;
  private expiryTimer: ReturnType<typeof setTimeout> | undefined;

  public constructor(private readonly options: InteractionArbiterOptions) {
    this.now = options.now ?? (() => performance.now());
  }

  public dispatch(intent: ArbitrationIntent): boolean {
    const now = this.now();
    this.expire(now);
    const candidate = this.candidate(intent, now);
    if (this.isStale(candidate, now)) return false;
    if (
      this.active &&
      InteractionPriority[candidate.priority] <
        InteractionPriority[this.active.priority]
    ) {
      return false;
    }
    this.activate(candidate);
    return true;
  }

  /** Explicit navigation has user intent, but never bypasses a hard lock. */
  public navigate(intent: ArbitrationIntent): boolean {
    const now = this.now();
    this.expire(now);
    if (this.active?.locks) return false;
    const candidate = this.candidate(intent, now);
    if (this.isStale(candidate, now)) return false;
    this.activate(candidate);
    return true;
  }

  public releaseByKind(kind: InteractionKind, ownerKey?: string): boolean {
    if (
      !this.active ||
      this.active.kind !== kind ||
      (ownerKey !== undefined && this.active.ownerKey !== ownerKey)
    ) {
      return false;
    }
    this.clearExpiryTimer();
    this.active = undefined;
    return true;
  }

  public isBlocked(priority: InteractionPriorityName): boolean {
    this.expire(this.now());
    return Boolean(
      this.active &&
      InteractionPriority[priority] < InteractionPriority[this.active.priority],
    );
  }

  public current(): Readonly<ActiveIntent> | undefined {
    this.expire(this.now());
    return this.active;
  }

  public destroy(): void {
    this.clearExpiryTimer();
    this.active = undefined;
  }

  private candidate(intent: ArbitrationIntent, now: number): ActiveIntent {
    return { ...intent, createdAt: intent.createdAt ?? now };
  }

  private isStale(intent: ActiveIntent, now: number): boolean {
    return (
      intent.expiresAfterMs !== undefined &&
      now - intent.createdAt >= intent.expiresAfterMs
    );
  }

  private activate(candidate: ActiveIntent): void {
    const previous = this.active;
    candidate.returnTo =
      candidate.expiresAfterMs !== undefined
        ? previous?.id === candidate.id
          ? previous.returnTo
          : previous
        : undefined;
    this.active = candidate;
    this.scheduleExpiry(candidate);
    this.options.apply(candidate.model);
  }

  private scheduleExpiry(intent: ActiveIntent): void {
    this.clearExpiryTimer();
    if (intent.expiresAfterMs === undefined) return;
    const elapsed = this.now() - intent.createdAt;
    this.expiryTimer = setTimeout(
      () => this.expire(this.now()),
      Math.max(0, intent.expiresAfterMs - elapsed),
    );
  }

  private clearExpiryTimer(): void {
    if (this.expiryTimer) clearTimeout(this.expiryTimer);
    this.expiryTimer = undefined;
  }

  private expire(now: number): void {
    if (!this.active || !this.isStale(this.active, now)) return;
    const expired = this.active;
    this.clearExpiryTimer();
    this.active = expired.returnTo;
    if (this.active) {
      this.scheduleExpiry(this.active);
      this.options.apply(this.active.model);
    } else {
      this.options.apply(this.options.fallback());
    }
  }
}
