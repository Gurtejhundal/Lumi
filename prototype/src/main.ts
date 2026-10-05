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
  setNativeInteraction,
  setNativeSurface,
  subscribeRuntimeEvents,
  subscribeWindowFileDrops,
} from "./desktop";
import { NoxRenderer } from "./nox";
import {
  GestureController,
  type Gesture,
  type GestureTarget,
} from "./interaction/gesture-controller";
import {
  InteractionArbiter,
  type InteractionPriorityName,
  priorityForRuntimeEvent,
} from "./interaction/interaction-arbiter";
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
let collapseTimer = 0;
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

function applyModelDirect(next: IslandModel): void {
  const previous = model;
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
    reducedMotion: isReducedMotion,
  });
  if (next.event !== previous.event) {
    if (next.event === "success") renderer.trigger("success");
    if (next.event === "failure") renderer.trigger("failure");
    if (next.event === "file") renderer.trigger("fileCatch");
  }
  if (isTauriDesktop) {
    const focusable = Boolean(next.showAssistant || next.showSettings);
    const interactive = next.surface !== "hidden" && next.surface !== "peek";
    void setNativeSurface(next.surface);
    void setNativeInteraction(interactive, focusable);
    if (next.showAssistant) window.setTimeout(() => assistantPrompt.focus(), 0);
  }
}

const arbiter = new InteractionArbiter({ apply: applyModelDirect });

function requestModel(
  next: IslandModel,
  priority: InteractionPriorityName = "idle",
  id: string = next.event,
): void {
  arbiter.dispatch({
    id,
    model: next,
    priority,
    locks:
      priority === "permission" ||
      priority === "privacy" ||
      priority === "fileDrop" ||
      priority === "failure",
    expiresAfterMs:
      priority === "systemHud" || priority === "media" ? 1200 : undefined,
  });
}

function priorityForDemoEvent(
  event: DemoEvent | "hidden" | "peek",
): InteractionPriorityName {
  switch (event) {
    case "permission":
      return "permission";
    case "file":
      return "fileDrop";
    case "failure":
      return "failure";
    case "thinking":
    case "editing":
    case "running":
    case "assistant":
    case "settings":
    case "home":
      return "activeAgent";
    case "media":
      return "media";
    case "volume":
    case "brightness":
    case "bluetooth":
    case "battery":
      return "systemHud";
    default:
      return "idle";
  }
}

function show(event: DemoEvent | "hidden" | "peek"): void {
  window.clearTimeout(hoverTimer);
  requestModel(
    modelForDemo(event),
    priorityForDemoEvent(event),
    `demo-${event}`,
  );
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
  requestModel({ ...model, showFileActions: true }, "fileDrop", "active-file");
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
  if (model.surface === "petit") {
    window.clearTimeout(hoverTimer);
    hoverTimer = window.setTimeout(() => show("home"), 180);
  }
});
island.addEventListener("mouseleave", () => {
  renderer.setPointer(0, 0, false);
  window.clearTimeout(hoverTimer);
  if (model.surface === "peek") show("hidden");
  if (model.surface === "compact" && !model.showPermission) {
    window.clearTimeout(collapseTimer);
    collapseTimer = window.setTimeout(() => show("idle"), 720);
  }
});

island.addEventListener("pointermove", (event) => {
  const bounds = island.getBoundingClientRect();
  renderer.setPointer(
    event.clientX,
    event.clientY,
    event.clientX >= bounds.left &&
      event.clientX <= bounds.right &&
      event.clientY >= bounds.top &&
      event.clientY <= bounds.bottom &&
      model.surface !== "hidden" &&
      model.surface !== "peek",
  );
});

function gestureTarget(target: EventTarget | null): GestureTarget {
  if (target instanceof Node && stage.contains(target)) return "nox";
  if (
    target instanceof Element &&
    target.closest("button, input, select, form, [contenteditable='true']")
  ) {
    return "control";
  }
  return target instanceof Node && islandSurface.contains(target)
    ? "island"
    : "background";
}

function expandContext(): void {
  if (model.surface === "petit") {
    show("home");
    return;
  }
  requestModel(
    {
      ...model,
      surface: "expanded",
      showMediaControls: model.event === "media",
    },
    "activeAgent",
    "user-expand",
  );
}

function handleGesture(gesture: Gesture): void {
  switch (gesture.kind) {
    case "tap":
      if (gesture.target === "nox") {
        if (gesture.touchCount === 2 && model.event === "media") {
          expandContext();
        } else if (model.surface === "petit") {
          show("home");
        } else {
          renderer.trigger("attention");
        }
      } else if (gesture.target === "island") {
        if (model.surface === "compact") expandContext();
        else if (model.surface === "expanded") {
          requestModel(
            { ...model, surface: "compact" },
            "activeAgent",
            "user-collapse",
          );
        }
      }
      return;
    case "doubleTap":
      if (gesture.target === "nox") {
        renderer.trigger("annoyed");
        if (model.event === "media") expandContext();
      }
      return;
    case "tripleTap":
      if (gesture.target === "nox") renderer.trigger("dizzy");
      return;
    case "longPress":
      if (gesture.target === "nox" || gesture.target === "island")
        show("settings");
      return;
    case "secondaryTap":
      if (gesture.target !== "control") show("settings");
      return;
    case "swipe":
      if (gesture.direction === "up") {
        expandContext();
      } else if (gesture.direction === "down") {
        show("idle");
      } else if (model.event === "media") {
        void sendMediaCommand(
          gesture.direction === "left" ? "previous" : "next",
        );
      } else {
        renderer.trigger("annoyed");
      }
      return;
    case "wheelIntent":
      // Wheel input has no global meaning. Context-specific controls consume it.
      return;
  }
}

const gestures = new GestureController({
  onGesture: handleGesture,
  onPress: (target) => {
    if (target === "nox") renderer.trigger("press");
  },
  onRelease: (target) => {
    if (target === "nox") renderer.trigger("release");
  },
});
const detachGestures = gestures.attach(island, gestureTarget);

async function resolvePermission(decision: "allow" | "deny"): Promise<void> {
  if (!model.permissionId || !isTauriDesktop) {
    show(decision === "allow" ? "success" : "idle");
    return;
  }
  try {
    await resolveCodexPermission(model.permissionId, decision);
    arbiter.release("permission");
    requestModel(
      modelForRuntimeEvent({
        type: "permission_resolved",
        sessionId: "local",
        requestId: model.permissionId,
        decision,
      }),
      "activeAgent",
      "permission-resolved",
    );
  } catch {
    requestModel(modelForDemo("failure"), "failure", "permission-failed");
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
        requestModel(modelForDemo("failure"), "failure", "media-failed"),
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
  requestModel(
    {
      ...modelForDemo("assistant"),
      assistantText: "Sending to the local Codex bridge…",
      assistantBusy: true,
    },
    "activeAgent",
    "assistant-request",
  );
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
    requestModel(
      {
        ...modelForDemo("assistant"),
        assistantText:
          error instanceof Error
            ? error.message
            : "The local bridge is unavailable.",
        assistantBusy: false,
      },
      "activeAgent",
      "assistant-result",
    );
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

window.addEventListener(
  "beforeunload",
  () => {
    detachGestures();
    window.clearTimeout(hoverTimer);
    window.clearTimeout(collapseTimer);
    renderer.destroy();
  },
  {
    once: true,
  },
);
applyModelDirect(model);
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
  if (event.type === "permission_resolved") arbiter.release("permission");
  requestModel(
    modelForRuntimeEvent(event),
    priorityForRuntimeEvent(event),
    `runtime-${event.type}`,
  );
});
