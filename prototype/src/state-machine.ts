export type SurfaceState = "hidden" | "peek" | "compact" | "expanded" | "modal";

export type DemoEvent =
  | "idle"
  | "thinking"
  | "editing"
  | "running"
  | "permission"
  | "success"
  | "failure"
  | "media"
  | "volume"
  | "brightness"
  | "bluetooth"
  | "battery"
  | "file"
  | "notification"
  | "assistant"
  | "settings";

export type NoxEmotion =
  | "neutral"
  | "curious"
  | "working"
  | "pleased"
  | "annoyed"
  | "worried"
  | "sleepy";

export interface IslandModel {
  surface: SurfaceState;
  event: DemoEvent;
  emotion: NoxEmotion;
  eyebrow: string;
  headline: string;
  detail: string;
  activity?: string;
  showPermission: boolean;
  showFile: boolean;
  showMediaControls: boolean;
  artUrl?: string;
  permissionId?: string;
  showFileActions?: boolean;
  showAssistant?: boolean;
  showSettings?: boolean;
  assistantText?: string;
  assistantBusy?: boolean;
  accent: "neutral" | "violet" | "mint" | "amber" | "red" | "blue";
}

const compact = (
  event: DemoEvent,
  headline: string,
  emotion: NoxEmotion = "neutral",
): IslandModel => ({
  surface: "compact",
  event,
  emotion,
  eyebrow: "Nox",
  headline,
  detail: "",
  showPermission: false,
  showFile: false,
  showMediaControls: false,
  accent: "neutral",
});

export function modelForDemo(
  event: DemoEvent | "hidden" | "peek",
): IslandModel {
  switch (event) {
    case "hidden":
      return { ...compact("idle", "Ready"), surface: "hidden" };
    case "peek":
      return { ...compact("idle", "Ready"), surface: "peek" };
    case "idle":
      return compact("idle", "Ready when you are");
    case "thinking":
      return {
        surface: "expanded",
        event,
        emotion: "working",
        eyebrow: "Codex",
        headline: "Codex is thinking",
        detail: "Considering the next implementation step",
        activity: "Reasoning in progress",
        showPermission: false,
        showFile: false,
        showMediaControls: false,
        accent: "violet",
      };
    case "editing":
      return {
        surface: "expanded",
        event,
        emotion: "working",
        eyebrow: "Codex",
        headline: "Editing extension.ts",
        detail: "Working in ~/Projects/nox",
        activity: "Writing changes",
        showPermission: false,
        showFile: false,
        showMediaControls: false,
        accent: "violet",
      };
    case "running":
      return {
        surface: "expanded",
        event,
        emotion: "working",
        eyebrow: "Codex",
        headline: "Running npm test",
        detail: "Waiting for the command to finish",
        activity: "Command active",
        showPermission: false,
        showFile: false,
        showMediaControls: false,
        accent: "violet",
      };
    case "permission":
      return {
        surface: "modal",
        event,
        emotion: "curious",
        eyebrow: "Permission request",
        headline: "Codex wants to run npm install",
        detail: "Review this command before allowing it.",
        showPermission: true,
        showFile: false,
        showMediaControls: false,
        permissionId: "demo-npm-install",
        accent: "amber",
      };
    case "success":
      return {
        surface: "expanded",
        event,
        emotion: "pleased",
        eyebrow: "Codex",
        headline: "Task finished",
        detail: "The build completed without errors",
        showPermission: false,
        showFile: false,
        showMediaControls: false,
        accent: "mint",
      };
    case "failure":
      return {
        surface: "expanded",
        event,
        emotion: "worried",
        eyebrow: "Codex",
        headline: "Command failed",
        detail: "Exit code 1 · Review the terminal output",
        showPermission: false,
        showFile: false,
        showMediaControls: false,
        accent: "red",
      };
    case "media":
      return {
        surface: "expanded",
        event,
        emotion: "neutral",
        eyebrow: "Now playing",
        headline: "Night drive",
        detail: "Dawn Recorder · MPRIS preview",
        showPermission: false,
        showFile: false,
        showMediaControls: true,
        accent: "blue",
      };
    case "volume":
      return { ...compact(event, "Volume 49%"), accent: "blue" };
    case "brightness":
      return { ...compact(event, "Brightness 72%"), accent: "amber" };
    case "bluetooth":
      return { ...compact(event, "Headphones connected"), accent: "blue" };
    case "battery":
      return { ...compact(event, "Battery 14%", "sleepy"), accent: "amber" };
    case "file":
      return {
        surface: "expanded",
        event,
        emotion: "pleased",
        eyebrow: "File received",
        headline: "prototype-notes.md",
        detail: "Ready for an action · nothing uploaded",
        showPermission: false,
        showFile: true,
        showFileActions: true,
        showMediaControls: false,
        accent: "mint",
      };
    case "notification":
      return {
        surface: "expanded",
        event,
        emotion: "curious",
        eyebrow: "Notification",
        headline: "Build artifacts are ready",
        detail: "Nox Island · just now",
        showPermission: false,
        showFile: false,
        showMediaControls: false,
        accent: "blue",
      };
    case "assistant":
      return {
        surface: "modal",
        event,
        emotion: "curious",
        eyebrow: "Quick assistant",
        headline: "Ask Codex",
        detail: "Requests stay on your local Codex bridge.",
        showPermission: false,
        showFile: false,
        showMediaControls: false,
        showAssistant: true,
        accent: "violet",
      };
    case "settings":
      return {
        surface: "modal",
        event,
        emotion: "neutral",
        eyebrow: "Nox Island",
        headline: "Preferences",
        detail: "Desktop behavior stays local to this device.",
        showPermission: false,
        showFile: false,
        showMediaControls: false,
        showSettings: true,
        accent: "neutral",
      };
  }
}

export function canDismiss(model: IslandModel): boolean {
  return model.surface !== "modal" || !model.showPermission;
}

export type RuntimeEvent =
  | { type: "session_started"; sessionId: string; cwd?: string }
  | { type: "thinking"; sessionId: string; summary?: string }
  | { type: "file_read"; sessionId: string; path: string }
  | { type: "file_edit"; sessionId: string; path: string }
  | { type: "command_started"; sessionId: string; command: string }
  | { type: "command_finished"; sessionId: string; exitCode: number }
  | {
      type: "permission_requested";
      sessionId: string;
      requestId: string;
      label: string;
    }
  | {
      type: "permission_resolved";
      sessionId: string;
      requestId: string;
      decision: "allow" | "deny";
    }
  | {
      type: "session_finished";
      sessionId: string;
      outcome: "success" | "failed" | "cancelled";
    }
  | { type: "volume"; level: number; muted: boolean }
  | { type: "brightness"; level: number }
  | {
      type: "battery";
      percentage: number;
      charging: boolean;
      critical: boolean;
    }
  | { type: "bluetooth"; connected: boolean; device?: string }
  | { type: "network"; connected: boolean; ssid?: string }
  | { type: "privacy"; kind: "microphone" | "camera"; active: boolean }
  | {
      type: "media";
      player: string;
      title: string;
      artist?: string;
      artUrl?: string;
      playback: "playing" | "paused" | "stopped";
    }
  | { type: "assistant_status"; requestId: string; status: string }
  | { type: "assistant_response"; requestId: string; text: string };

const compactRuntime = (
  event: RuntimeEvent,
  headline: string,
  emotion: NoxEmotion = "neutral",
  accent: IslandModel["accent"] = "neutral",
): IslandModel => ({
  ...compact(event.type as DemoEvent, headline, emotion),
  accent,
});

export function modelForRuntimeEvent(event: RuntimeEvent): IslandModel {
  switch (event.type) {
    case "session_started":
      return compactRuntime(
        event,
        "Codex session started",
        "curious",
        "violet",
      );
    case "thinking":
      return {
        surface: "expanded",
        event: "thinking",
        emotion: "working",
        eyebrow: "Codex",
        headline: "Codex is thinking",
        detail: event.summary ?? "Considering the next implementation step",
        activity: "Reasoning in progress",
        showPermission: false,
        showFile: false,
        showMediaControls: false,
        accent: "violet",
      };
    case "file_read":
      return {
        surface: "expanded",
        event: "editing",
        emotion: "working",
        eyebrow: "Codex",
        headline: `Reading ${event.path.split("/").at(-1) ?? event.path}`,
        detail: event.path,
        activity: "Inspecting file",
        showPermission: false,
        showFile: false,
        showMediaControls: false,
        accent: "violet",
      };
    case "file_edit":
      return {
        surface: "expanded",
        event: "editing",
        emotion: "working",
        eyebrow: "Codex",
        headline: `Editing ${event.path.split("/").at(-1) ?? event.path}`,
        detail: event.path,
        activity: "Writing changes",
        showPermission: false,
        showFile: false,
        showMediaControls: false,
        accent: "violet",
      };
    case "command_started":
      return {
        surface: "expanded",
        event: "running",
        emotion: "working",
        eyebrow: "Codex",
        headline: `Running ${event.command}`,
        detail: "Waiting for the command to finish",
        activity: "Command active",
        showPermission: false,
        showFile: false,
        showMediaControls: false,
        accent: "violet",
      };
    case "command_finished":
      return event.exitCode === 0
        ? modelForDemo("success")
        : {
            ...modelForDemo("failure"),
            detail: `Exit code ${event.exitCode} · Review the terminal output`,
          };
    case "permission_requested":
      return {
        surface: "modal",
        event: "permission",
        emotion: "curious",
        eyebrow: "Permission request",
        headline: event.label,
        detail: "This request stays open until you allow or deny it.",
        showPermission: true,
        showFile: false,
        showMediaControls: false,
        permissionId: event.requestId,
        accent: "amber",
      };
    case "permission_resolved":
      return event.decision === "allow"
        ? modelForDemo("success")
        : modelForDemo("idle");
    case "session_finished":
      return event.outcome === "success"
        ? modelForDemo("success")
        : modelForDemo("failure");
    case "volume":
      return compactRuntime(
        event,
        event.muted ? "Volume muted" : `Volume ${event.level}%`,
        "neutral",
        "blue",
      );
    case "brightness":
      return compactRuntime(
        event,
        `Brightness ${event.level}%`,
        "neutral",
        "amber",
      );
    case "battery":
      return compactRuntime(
        event,
        `Battery ${Math.round(event.percentage)}%${event.charging ? " · charging" : ""}`,
        event.critical ? "sleepy" : "neutral",
        event.critical ? "amber" : "mint",
      );
    case "bluetooth":
      return compactRuntime(
        event,
        event.connected
          ? `${event.device ?? "Bluetooth device"} connected`
          : "Bluetooth disconnected",
        "neutral",
        "blue",
      );
    case "network":
      return compactRuntime(
        event,
        event.connected
          ? `Wi-Fi · ${event.ssid ?? "connected"}`
          : "Wi-Fi disconnected",
        event.connected ? "neutral" : "worried",
        "blue",
      );
    case "privacy":
      return compactRuntime(
        event,
        `${event.kind === "microphone" ? "Microphone" : "Camera"} ${event.active ? "active" : "inactive"}`,
        event.active ? "curious" : "neutral",
        event.active ? "mint" : "neutral",
      );
    case "media":
      return {
        surface: "expanded",
        event: "media",
        emotion: event.playback === "playing" ? "working" : "neutral",
        eyebrow: event.player,
        headline: event.title,
        detail: event.artist ?? "Unknown artist",
        showPermission: false,
        showFile: false,
        showMediaControls: true,
        artUrl: event.artUrl,
        accent: "blue",
      };
    case "assistant_status":
      return {
        ...modelForDemo("assistant"),
        assistantText: event.status,
        assistantBusy: true,
      };
    case "assistant_response":
      return {
        ...modelForDemo("assistant"),
        headline: "Codex replied",
        detail: "Local bridge response",
        assistantText: event.text,
        assistantBusy: false,
      };
  }
}
