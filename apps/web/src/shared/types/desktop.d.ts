import type { DesktopBridge } from "@oh-my-canvas/contracts";

export {};

declare global {
  interface Window {
    ohMyCanvas?: DesktopBridge;
  }
}
