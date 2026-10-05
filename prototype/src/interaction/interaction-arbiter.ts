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

export interface ArbitrationIntent {
  id: string;
  model: IslandModel;
  priority: InteractionPriorityName;
  createdAt?: number;
  expiresAfterMs?: number;
  locks?: boolean;
}

export interface InteractionArbiterOptions {
  apply: (model: IslandModel) => void;
  now?: () => number;
}

interface ActiveIntent extends ArbitrationIntent {
  createdAt: number;
}

export function priorityForRuntimeEvent(
  event: RuntimeEvent,
): InteractionPriorityName {
  switch (event.type) {
    case "permission_requested":
      return "permission";
    case "privacy":
      return "privacy";
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
 * Centralizes visual ownership. High-priority cards are locks, never something
 * a lower-priority gesture or late desktop signal may paint over.
 */
export class InteractionArbiter {
  private readonly now: () => number;
  private active: ActiveIntent | undefined;

  public constructor(private readonly options: InteractionArbiterOptions) {
    this.now = options.now ?? (() => performance.now());
  }

  public dispatch(intent: ArbitrationIntent): boolean {
    const now = this.now();
    this.expire(now);
    const candidate: ActiveIntent = {
      ...intent,
      createdAt: intent.createdAt ?? now,
    };
    if (
      candidate.expiresAfterMs !== undefined &&
      now - candidate.createdAt > candidate.expiresAfterMs
    ) {
      return false;
    }
    if (
      this.active &&
      this.active.locks &&
      InteractionPriority[candidate.priority] <
        InteractionPriority[this.active.priority]
    ) {
      // HUDs are intentionally dropped rather than resurfacing after the
      // meaningful interaction that obscured them has already finished.
      return false;
    }
    if (
      !this.active ||
      candidate.locks ||
      !this.active.locks ||
      InteractionPriority[candidate.priority] >=
        InteractionPriority[this.active.priority]
    ) {
      this.active = candidate;
    }
    this.options.apply(candidate.model);
    return true;
  }

  public release(id: string): void {
    if (this.active?.id === id) this.active = undefined;
  }

  public isBlocked(priority: InteractionPriorityName): boolean {
    this.expire(this.now());
    return Boolean(
      this.active &&
      InteractionPriority[priority] < InteractionPriority[this.active.priority],
    );
  }

  public current(): ActiveIntent | undefined {
    this.expire(this.now());
    return this.active;
  }

  private expire(now: number): void {
    if (
      this.active?.expiresAfterMs !== undefined &&
      now - this.active.createdAt > this.active.expiresAfterMs
    ) {
      this.active = undefined;
    }
  }
}
