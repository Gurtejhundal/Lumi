import { describe, expect, it } from "vitest";
import {
  canDismiss,
  modelForDemo,
  modelForRuntimeEvent,
} from "../src/state-machine";

describe("island state models", () => {
  it("keeps a permission request modal and non-dismissible", () => {
    const model = modelForDemo("permission");
    expect(model.surface).toBe("modal");
    expect(model.showPermission).toBe(true);
    expect(canDismiss(model)).toBe(false);
  });

  it("uses a compact surface for short-lived HUD events", () => {
    const volume = modelForDemo("volume");
    expect(volume.surface).toBe("compact");
    expect(volume.headline).toContain("Volume");
  });

  it("maps a dropped file to a rich, non-uploading state", () => {
    const file = modelForDemo("file");
    expect(file.surface).toBe("expanded");
    expect(file.showFile).toBe(true);
    expect(file.showFileActions).toBe(true);
    expect(file.detail).toContain("nothing uploaded");
  });

  it("maps hidden and peek to their prescribed shallow surfaces", () => {
    expect(modelForDemo("hidden").surface).toBe("hidden");
    expect(modelForDemo("peek").surface).toBe("peek");
  });

  it("rests in the Nox-only petit surface before compact home", () => {
    expect(modelForDemo("idle").surface).toBe("petit");
    expect(modelForDemo("home").surface).toBe("compact");
  });

  it("keeps a real Codex request open with its request ID", () => {
    const model = modelForRuntimeEvent({
      type: "permission_requested",
      sessionId: "session-1",
      requestId: "request-7",
      label: "Codex wants to run npm install",
    });
    expect(model.permissionId).toBe("request-7");
    expect(canDismiss(model)).toBe(false);
  });

  it("keeps actual media compact until the user explicitly expands it", () => {
    const model = modelForRuntimeEvent({
      type: "media",
      player: "Spotify",
      title: "A track",
      artist: "An artist",
      playback: "playing",
    });
    expect(model.surface).toBe("compact");
    expect(model.showMediaControls).toBe(false);
    expect(model.headline).toBe("A track");
    expect(model.detail).toBe("An artist");
  });

  it("keeps quick-assistant replies in the local bridge UI", () => {
    const model = modelForRuntimeEvent({
      type: "assistant_response",
      requestId: "local-1",
      text: "A local reply",
    });
    expect(model.showAssistant).toBe(true);
    expect(model.assistantText).toBe("A local reply");
    expect(model.assistantBusy).toBe(false);
  });

  it("exposes assistant preferences without a secret field", () => {
    const model = modelForDemo("settings");
    expect(model.surface).toBe("modal");
    expect(model.showSettings).toBe(true);
  });
});
