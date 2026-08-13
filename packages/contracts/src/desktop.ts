export const desktopIpcChannels = Object.freeze({
  getAppInfo: "desktop:get-app-info",
  openExternal: "desktop:open-external"
});

export type DesktopPlatform = "darwin" | "win32" | "linux" | "unknown";

export type DesktopAppInfo = {
  name: string;
  version: string;
};

export type DesktopBridge = Readonly<{
  platform: DesktopPlatform;
  versions: Readonly<{
    chrome: string;
    electron: string;
  }>;
  getAppInfo(): Promise<DesktopAppInfo>;
  openExternal(url: string): Promise<void>;
}>;
