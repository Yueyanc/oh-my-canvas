import { contextBridge, ipcRenderer } from "electron";
import { desktopIpcChannels, type DesktopBridge, type DesktopPlatform } from "@oh-my-canvas/contracts";

const supportedPlatforms = new Set<DesktopPlatform>(["darwin", "win32", "linux"]);
const platform = supportedPlatforms.has(process.platform as DesktopPlatform)
  ? (process.platform as DesktopPlatform)
  : "unknown";

const bridge: DesktopBridge = Object.freeze({
  platform,
  versions: Object.freeze({
    chrome: process.versions.chrome,
    electron: process.versions.electron
  }),
  getAppInfo: () => ipcRenderer.invoke(desktopIpcChannels.getAppInfo),
  openExternal: (url: string) => ipcRenderer.invoke(desktopIpcChannels.openExternal, url)
});

contextBridge.exposeInMainWorld("ohMyCanvas", bridge);
