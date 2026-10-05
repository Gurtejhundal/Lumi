export interface OverlayCapabilities {
  session: "wayland" | "x11" | "unknown";
  placement: "native-window-fallback";
  supportsRegionInput: false;
}

export interface DroppedFileInfo {
  path: string;
  name: string;
  kind: string;
  bytes: number;
}

const hasTauriRuntime = (): boolean => "__TAURI_INTERNALS__" in window;

export const isTauriDesktop = hasTauriRuntime();

export async function configureNativeOverlay(): Promise<OverlayCapabilities | null> {
  if (!isTauriDesktop) return null;
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<OverlayCapabilities>("overlay_capabilities");
}

/**
 * Tauri only exposes whole-window cursor passthrough. The frontend uses this
 * during passive states; precise, island-shaped input regions need a native
 * compositor integration and are intentionally not faked here.
 */
export async function setNativeInteraction(
  interactive: boolean,
): Promise<void> {
  if (!isTauriDesktop) return;
  const { invoke } = await import("@tauri-apps/api/core");
  await invoke("set_overlay_interaction", { interactive });
}

export async function setAutostart(enabled: boolean): Promise<void> {
  if (!isTauriDesktop) return;
  const autostart = await import("@tauri-apps/plugin-autostart");
  if (enabled) await autostart.enable();
  else await autostart.disable();
}

export async function isAutostartEnabled(): Promise<boolean> {
  if (!isTauriDesktop) return false;
  const autostart = await import("@tauri-apps/plugin-autostart");
  return autostart.isEnabled();
}

export async function subscribeRuntimeEvents(
  handler: (event: RuntimeEvent) => void,
): Promise<() => void> {
  if (!isTauriDesktop) return () => undefined;
  const { listen } = await import("@tauri-apps/api/event");
  return listen<RuntimeEvent>("nox://event", ({ payload }) => handler(payload));
}

export async function resolveCodexPermission(
  requestId: string,
  decision: "allow" | "deny",
): Promise<void> {
  if (!isTauriDesktop) return;
  const { invoke } = await import("@tauri-apps/api/core");
  await invoke("resolve_codex_permission", { requestId, decision });
}

export async function sendMediaCommand(
  command: "previous" | "play_pause" | "next",
): Promise<void> {
  if (!isTauriDesktop) return;
  const { invoke } = await import("@tauri-apps/api/core");
  await invoke("media_command", { command });
}

export async function inspectDroppedFile(
  path: string,
): Promise<DroppedFileInfo> {
  if (!isTauriDesktop) throw new Error("Native file inspection is unavailable");
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<DroppedFileInfo>("inspect_dropped_file", { path });
}

export async function performFileAction(
  path: string,
  action: "open_containing_folder" | "attach" | "summarize",
): Promise<void> {
  if (!isTauriDesktop) throw new Error("Native file actions are unavailable");
  const { invoke } = await import("@tauri-apps/api/core");
  await invoke("perform_file_action", { path, action });
}

export async function subscribeWindowFileDrops(
  handler: (paths: string[]) => void,
): Promise<() => void> {
  if (!isTauriDesktop) return () => undefined;
  const { getCurrentWindow } = await import("@tauri-apps/api/window");
  return getCurrentWindow().onDragDropEvent((event) => {
    const payload = event.payload as { type: string; paths?: string[] };
    if (payload.type === "drop" && payload.paths?.length)
      handler(payload.paths);
  });
}

export async function requestQuickAssistant(
  requestId: string,
  prompt: string,
  context: { sessionId?: string; filePath?: string },
): Promise<void> {
  if (!isTauriDesktop) throw new Error("The local Codex bridge is unavailable");
  const { invoke } = await import("@tauri-apps/api/core");
  await invoke("request_quick_assistant", { requestId, prompt, context });
}
import type { RuntimeEvent } from "./state-machine";
