import "./styles.css";
import {
  configureNativeOverlay,
  inspectDroppedFile,
  isAutostartEnabled,
  isTauriDesktop,
  performFileAction,
  requestQuickAssistant,
  resolveCodexPermission,
  sendMediaCommand,
  setAutostart,
  subscribeRuntimeEvents,
  subscribeWindowFileDrops,
} from "./desktop";
import { NoxRenderer } from "./nox";
import {
  canDismiss,
  modelForDemo,
  modelForRuntimeEvent,
  type DemoEvent,
  type IslandModel,
} from "./state-machine";

const required = <T extends Element>(selector: string): T => {
  const element = document.querySelector<T>(selector);
  if (!element)
    throw new Error(`Expected ${selector} in the prototype markup.`);
  return element;
};

const island = required<HTMLElement>("#island");
const islandSurface = required<HTMLElement>(".island-surface");
const sensor = required<HTMLButtonElement>("#islandSensor");
const stage = required<HTMLButtonElement>("#noxStage");
const canvas = required<HTMLCanvasElement>("#noxCanvas");
const eyebrow = required<HTMLElement>("#eyebrow");
const headline = required<HTMLElement>("#headline");
const detail = required<HTMLElement>("#detail");
const activity = required<HTMLElement>("#activity");
const activityText = required<HTMLElement>("#activityText");
const artwork = required<HTMLImageElement>("#artwork");
const fileCard = required<HTMLElement>("#fileCard");
const fileName = required<HTMLElement>("#fileName");
const fileInfo = required<HTMLElement>("#fileInfo");
const permissionActions = required<HTMLElement>("#permissionActions");
const mediaActions = required<HTMLElement>("#mediaActions");
const fileActions = required<HTMLElement>("#fileActions");
const fileActionStatus = required<HTMLElement>("#fileActionStatus");
const assistantForm = required<HTMLFormElement>("#assistantForm");
const assistantPrompt = required<HTMLInputElement>("#assistantPrompt");
const assistantResult = required<HTMLOutputElement>("#assistantResult");
const settingsPanel = required<HTMLElement>("#settingsPanel");
const assistantProvider = required<HTMLSelectElement>("#assistantProvider");
const autostart = required<HTMLInputElement>("#autostart");
const allowButton = required<HTMLButtonElement>("#allowButton");
const denyButton = required<HTMLButtonElement>("#denyButton");
const reducedMotion = required<HTMLInputElement>("#reducedMotion");

const renderer = new NoxRenderer(canvas);
let model = modelForDemo("idle");
let hoverTimer = 0;
let clickTimes: number[] = [];
let clickTimer = 0;
let holdTimer = 0;
let holdHandled = false;
let lastTouchInteraction = 0;
const activeTouches = new Map<
  number,
  { x: number; y: number; startedAt: number }
>();
let touchPeak = 0;
let isReducedMotion = window.matchMedia(
  "(prefers-reduced-motion: reduce)",
).matches;
let activeSessionId: string | undefined;
let activeFile:
  { name: string; type: string; size: number; path?: string } | undefined;

const preferenceKey = "nox-island-preferences";
const preferences = {
  provider: "codex_bridge",
  reducedMotion: isReducedMotion,
};
try {
  const saved = JSON.parse(
    localStorage.getItem(preferenceKey) ?? "{}",
  ) as Partial<typeof preferences>;
  Object.assign(preferences, saved);
  isReducedMotion = preferences.reducedMotion;
} catch {
  // A corrupt optional preference must never prevent the island from opening.
}
document.documentElement.dataset.reducedMotion = String(isReducedMotion);

function savePreferences(): void {
  localStorage.setItem(preferenceKey, JSON.stringify(preferences));
}

const isDemoMode =
  new URLSearchParams(window.location.search).get("demo") === "1";
if (isDemoMode) document.documentElement.dataset.demo = "true";

if (isTauriDesktop) {
  document.documentElement.dataset.host = "tauri";
  void configureNativeOverlay().catch(() => {
    document.documentElement.dataset.nativeOverlay = "unavailable";
  });
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function applyModel(next: IslandModel): void {
  model = next;
  island.dataset.surface = next.surface;
  island.dataset.event = next.event;
  eyebrow.textContent = next.eyebrow;
  headline.textContent = next.headline;
  detail.textContent = next.detail;
  activity.hidden = !next.activity;
  activityText.textContent = next.activity ?? "";
  fileCard.hidden = !next.showFile;
  fileActions.hidden = !next.showFileActions;
  fileActionStatus.hidden = !next.showFile;
  permissionActions.hidden = !next.showPermission;
  mediaActions.hidden = !next.showMediaControls;
  assistantForm.hidden = !next.showAssistant;
  settingsPanel.hidden = !next.showSettings;
  if (next.showAssistant) {
    assistantResult.hidden = !next.assistantText;
    assistantResult.value = next.assistantText ?? "";
    assistantPrompt.disabled = Boolean(next.assistantBusy);
  }
  artwork.hidden = !next.artUrl;
  if (next.artUrl) artwork.src = next.artUrl;
  sensor.tabIndex = next.surface === "hidden" ? 0 : -1;
  renderer.update({
    visible: next.surface !== "hidden" && next.surface !== "peek",
    emotion: next.emotion,
    activity: Boolean(next.activity),
    celebrate: next.event === "success" || next.event === "file",
    fail: next.event === "failure",
    fileDrop: next.event === "file",
    reducedMotion: isReducedMotion,
  });
}

function show(event: DemoEvent | "hidden" | "peek"): void {
  window.clearTimeout(hoverTimer);
  applyModel(modelForDemo(event));
}

function revealFromEdge(): void {
  if (model.surface !== "hidden") return;
  show("peek");
  hoverTimer = window.setTimeout(() => show("idle"), 165);
}

function showDroppedFile(file: File): void {
  show("file");
  activeFile = {
    name: file.name,
    type: file.type || "Unknown type",
    size: file.size,
  };
  updateFileCard();
}

function updateFileCard(): void {
  if (!activeFile) return;
  fileName.textContent = activeFile.name;
  fileInfo.textContent = `${activeFile.type} · ${formatBytes(activeFile.size)}`;
  fileActions.hidden = false;
  fileActionStatus.hidden = true;
  model = { ...model, showFileActions: true };
}

function setFileActionStatus(message: string): void {
  fileActionStatus.textContent = message;
  fileActionStatus.hidden = false;
}

async function showNativeDroppedFile(path: string): Promise<void> {
  show("file");
  try {
    const file = await inspectDroppedFile(path);
    activeFile = {
      path: file.path,
      name: file.name,
      type: file.kind,
      size: file.bytes,
    };
    updateFileCard();
  } catch {
    setFileActionStatus("That file is no longer available to inspect.");
  }
}

document
  .querySelectorAll<HTMLButtonElement>("[data-demo]")
  .forEach((button) => {
    button.addEventListener("click", () =>
      show(button.dataset.demo as DemoEvent | "hidden" | "peek"),
    );
  });

sensor.addEventListener("mouseenter", revealFromEdge);
sensor.addEventListener("focus", revealFromEdge);
island.addEventListener("mouseenter", () => {
  renderer.setPointer(0, 0, true);
  if (model.surface === "hidden") revealFromEdge();
});
island.addEventListener("mouseleave", () => {
  renderer.setPointer(0, 0, false);
  if (model.surface === "peek") show("hidden");
});

window.addEventListener("pointermove", (event) => {
  const bounds = island.getBoundingClientRect();
  const nearby =
    event.clientY < Math.max(112, bounds.bottom + 42) &&
    Math.abs(event.clientX - (bounds.left + bounds.width / 2)) < 250;
  renderer.setPointer(
    event.clientX,
    event.clientY,
    nearby && model.surface !== "hidden" && model.surface !== "peek",
  );
});

function runIslandGesture(
  gesture: "assistant" | "media" | "settings" | "system" | "hide",
): void {
  if (gesture === "hide") {
    show("hidden");
    return;
  }
  if (gesture === "system") {
    show("volume");
    return;
  }
  show(gesture);
}

function queueStageClick(): void {
  const now = performance.now();
  clickTimes = clickTimes.filter((time) => now - time < 650);
  clickTimes.push(now);
  window.clearTimeout(clickTimer);
  clickTimer = window.setTimeout(() => {
    if (clickTimes.length >= 3) {
      renderer.reactToClick(true);
    } else if (clickTimes.length === 2) {
      runIslandGesture("media");
    } else {
      runIslandGesture("assistant");
    }
    clickTimes = [];
  }, 300);
}

function clearHold(): void {
  window.clearTimeout(holdTimer);
  holdTimer = 0;
}

function targetIsControl(target: EventTarget | null): boolean {
  if (target instanceof Node && stage.contains(target)) return false;
  return (
    target instanceof Element &&
    Boolean(target.closest("button, input, select, form"))
  );
}

stage.addEventListener("pointerdown", (event) => {
  holdHandled = false;
  clearHold();
  holdTimer = window.setTimeout(() => {
    holdHandled = true;
    clickTimes = [];
    runIslandGesture("settings");
  }, 560);
  stage.setPointerCapture?.(event.pointerId);
});

stage.addEventListener("pointerup", clearHold);
stage.addEventListener("pointercancel", clearHold);
stage.addEventListener("click", () => {
  if (holdHandled || performance.now() - lastTouchInteraction < 450) return;
  renderer.reactToClick(false);
  queueStageClick();
});

islandSurface.addEventListener("click", (event) => {
  if (event.target instanceof Node && stage.contains(event.target)) return;
  if (targetIsControl(event.target)) return;
  if (performance.now() - lastTouchInteraction < 450) return;
  runIslandGesture("assistant");
});

island.addEventListener("contextmenu", (event) => {
  event.preventDefault();
  runIslandGesture("settings");
});

island.addEventListener("wheel", (event) => {
  if (Math.abs(event.deltaY) < 3) return;
  event.preventDefault();
  runIslandGesture("system");
});

island.addEventListener("pointerdown", (event) => {
  if (event.pointerType !== "touch" || targetIsControl(event.target)) return;
  activeTouches.set(event.pointerId, {
    x: event.clientX,
    y: event.clientY,
    startedAt: performance.now(),
  });
  touchPeak = Math.max(touchPeak, activeTouches.size);
  if (activeTouches.size === 1) {
    clearHold();
    holdHandled = false;
    holdTimer = window.setTimeout(() => {
      holdHandled = true;
      runIslandGesture("settings");
    }, 560);
  }
});

island.addEventListener("pointerup", (event) => {
  const touch = activeTouches.get(event.pointerId);
  if (!touch) return;
  activeTouches.delete(event.pointerId);
  if (activeTouches.size) return;
  clearHold();
  lastTouchInteraction = performance.now();
  const dx = event.clientX - touch.x;
  const dy = event.clientY - touch.y;
  const distance = Math.hypot(dx, dy);
  const fingers = touchPeak;
  touchPeak = 0;
  if (holdHandled) return;
  if (fingers === 1 && distance > 42) {
    if (Math.abs(dx) > Math.abs(dy)) {
      runIslandGesture(dx < 0 ? "media" : "settings");
    } else {
      runIslandGesture(dy < 0 ? "assistant" : "hide");
    }
    return;
  }
  if (fingers === 1) runIslandGesture("assistant");
  else if (fingers === 2) runIslandGesture("media");
  else if (fingers === 3) runIslandGesture("system");
  else runIslandGesture("settings");
});

island.addEventListener("pointercancel", () => {
  activeTouches.clear();
  touchPeak = 0;
  clearHold();
});

async function resolvePermission(decision: "allow" | "deny"): Promise<void> {
  if (!model.permissionId || !isTauriDesktop) {
    show(decision === "allow" ? "success" : "idle");
    return;
  }
  try {
    await resolveCodexPermission(model.permissionId, decision);
    applyModel(
      modelForRuntimeEvent({
        type: "permission_resolved",
        sessionId: "local",
        requestId: model.permissionId,
        decision,
      }),
    );
  } catch {
    applyModel(modelForDemo("failure"));
  }
}

allowButton.addEventListener("click", () => void resolvePermission("allow"));
denyButton.addEventListener("click", () => void resolvePermission("deny"));

document
  .querySelectorAll<HTMLButtonElement>("[data-media-command]")
  .forEach((button) => {
    button.addEventListener("click", () => {
      const command = button.dataset.mediaCommand as
        "previous" | "play_pause" | "next";
      void sendMediaCommand(command).catch(() =>
        applyModel(modelForDemo("failure")),
      );
    });
  });

document.addEventListener("keydown", (event) => {
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
    event.preventDefault();
    show("assistant");
    window.setTimeout(() => assistantPrompt.focus(), 0);
    return;
  }
  if ((event.ctrlKey || event.metaKey) && event.key === ",") {
    event.preventDefault();
    show("settings");
    return;
  }
  if (event.key === "Escape" && canDismiss(model)) show("idle");
});

island.addEventListener("dragover", (event) => event.preventDefault());
island.addEventListener("dragenter", (event) => {
  event.preventDefault();
  if (model.event !== "file") show("file");
});
island.addEventListener("drop", (event) => {
  event.preventDefault();
  const [file] = Array.from(event.dataTransfer?.files ?? []);
  if (file) showDroppedFile(file);
});

async function copyText(value: string): Promise<void> {
  if (!navigator.clipboard) throw new Error("Clipboard access is unavailable");
  await navigator.clipboard.writeText(value);
}

function newRequestId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `nox-${Date.now()}`;
}

async function requestAssistant(
  prompt: string,
  filePath?: string,
): Promise<void> {
  if (preferences.provider !== "codex_bridge") {
    throw new Error("Quick assistant is disabled in Preferences.");
  }
  const requestId = newRequestId();
  applyModel({
    ...modelForDemo("assistant"),
    assistantText: "Sending to the local Codex bridge…",
    assistantBusy: true,
  });
  await requestQuickAssistant(requestId, prompt, {
    sessionId: activeSessionId,
    filePath,
  });
}

async function handleFileAction(
  action:
    "copy_path" | "open_containing_folder" | "attach" | "inspect" | "summarize",
): Promise<void> {
  if (!activeFile) return;
  if (action === "copy_path") {
    if (!activeFile.path) {
      setFileActionStatus("Browser previews do not expose a disk path.");
      return;
    }
    try {
      await copyText(activeFile.path);
      setFileActionStatus("Path copied locally.");
    } catch {
      setFileActionStatus("Could not copy the path.");
    }
    return;
  }
  if (!activeFile.path) {
    setFileActionStatus("This action needs the native desktop shell.");
    return;
  }
  try {
    if (action === "inspect") {
      await showNativeDroppedFile(activeFile.path);
      setFileActionStatus(
        "Metadata inspected locally; contents were not read.",
      );
      return;
    }
    if (action === "open_containing_folder" || action === "attach") {
      await performFileAction(activeFile.path, action);
      setFileActionStatus(
        action === "attach"
          ? "Attachment request sent to the local bridge."
          : "Opened the containing folder.",
      );
      return;
    }
    await requestAssistant(
      `Summarize the user-selected file ${activeFile.name}.`,
      activeFile.path,
    );
  } catch {
    setFileActionStatus("The local bridge is unavailable.");
  }
}

document
  .querySelectorAll<HTMLButtonElement>("[data-file-action]")
  .forEach((button) => {
    button.addEventListener("click", () => {
      void handleFileAction(
        button.dataset.fileAction as
          | "copy_path"
          | "open_containing_folder"
          | "attach"
          | "inspect"
          | "summarize",
      );
    });
  });

assistantForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const prompt = assistantPrompt.value.trim();
  if (!prompt) return;
  void requestAssistant(prompt, activeFile?.path).catch((error: unknown) => {
    applyModel({
      ...modelForDemo("assistant"),
      assistantText:
        error instanceof Error
          ? error.message
          : "The local bridge is unavailable.",
      assistantBusy: false,
    });
  });
});

reducedMotion.checked = isReducedMotion;
reducedMotion.addEventListener("change", () => {
  isReducedMotion = reducedMotion.checked;
  preferences.reducedMotion = isReducedMotion;
  savePreferences();
  document.documentElement.dataset.reducedMotion = String(isReducedMotion);
  renderer.update({ reducedMotion: isReducedMotion });
});

assistantProvider.value = preferences.provider;
assistantProvider.addEventListener("change", () => {
  preferences.provider = assistantProvider.value;
  savePreferences();
});

autostart.addEventListener("change", () => {
  void setAutostart(autostart.checked).catch(() => {
    autostart.checked = false;
  });
});

if (isTauriDesktop) {
  void isAutostartEnabled().then((enabled) => {
    autostart.checked = enabled;
  });
  void subscribeWindowFileDrops((paths) => {
    if (paths[0]) void showNativeDroppedFile(paths[0]);
  });
}

window.addEventListener("beforeunload", () => renderer.destroy(), {
  once: true,
});
applyModel(model);
void subscribeRuntimeEvents((event) => {
  if ("sessionId" in event) activeSessionId = event.sessionId;
  if (event.type === "file_read" || event.type === "file_edit") {
    activeFile = {
      name: event.path.split("/").at(-1) ?? event.path,
      type: "Active workspace file",
      size: 0,
      path: event.path,
    };
  }
  applyModel(modelForRuntimeEvent(event));
});
