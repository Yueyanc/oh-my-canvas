import { app, BrowserWindow, dialog, ipcMain, session, shell } from "electron";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { desktopIpcChannels } from "@oh-my-canvas/contracts";

const developmentUrl = process.env.ELECTRON_RENDERER_URL;
let applicationServer: ReturnType<typeof import("@hono/node-server").serve> | null = null;
let applicationUrl: string | null = null;
let mainWindow: BrowserWindow | null = null;

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (!mainWindow) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
  });

  app.whenReady().then(startApplication).catch(showStartupError);
}

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("before-quit", () => {
  applicationServer?.close();
  applicationServer = null;
});

async function startApplication() {
  registerDesktopHandlers();
  session.defaultSession.setPermissionRequestHandler((_webContents, _permission, callback) => callback(false));

  if (developmentUrl) {
    const apiPort = Number(process.env.ELECTRON_API_PORT ?? 8787);
    await startApplicationServer({ port: apiPort, serveRenderer: false });
    applicationUrl = await waitForUrl(developmentUrl);
  } else {
    applicationUrl = await startApplicationServer({ useUserDataDefaults: true });
  }

  createMainWindow(applicationUrl);
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0 && applicationUrl) createMainWindow(applicationUrl);
  });
}

function createMainWindow(url: string) {
  const allowedOrigin = new URL(url).origin;
  mainWindow = new BrowserWindow({
    width: 1360,
    height: 860,
    minWidth: 960,
    minHeight: 640,
    show: false,
    title: "Oh My Canvas",
    backgroundColor: "#f5f6f3",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: join(__dirname, "preload.cjs"),
      sandbox: true
    }
  });

  mainWindow.once("ready-to-show", () => mainWindow?.show());
  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  mainWindow.webContents.setWindowOpenHandler(({ url: targetUrl }) => {
    if (isSafeExternalUrl(targetUrl)) void shell.openExternal(targetUrl);
    return { action: "deny" };
  });
  mainWindow.webContents.on("will-navigate", (event, targetUrl) => {
    if (new URL(targetUrl).origin === allowedOrigin) return;
    event.preventDefault();
    if (isSafeExternalUrl(targetUrl)) void shell.openExternal(targetUrl);
  });

  void mainWindow.loadURL(url);
}

async function startApplicationServer(
  options: { port?: number; serveRenderer?: boolean; useUserDataDefaults?: boolean } = {}
) {
  if (options.useUserDataDefaults) {
    const userDataDirectory = app.getPath("userData");
    process.env.DATABASE_URL ??= `file:${join(userDataDirectory, "oh-my-canvas.sqlite")}`;
    process.env.LOG_DIR ??= join(userDataDirectory, "logs");
  }

  const [{ Hono }, { serve }, { serveStatic }, { createApiApp }, { createNodeDb }] = await Promise.all([
    import("hono"),
    import("@hono/node-server"),
    import("@hono/node-server/serve-static"),
    import("../../api/src/app"),
    import("../../../packages/db/src/node-client")
  ]);

  const desktopApp = new Hono();
  desktopApp.use("*", async (context, next) => {
    await next();
    context.header(
      "Content-Security-Policy",
      "default-src 'self'; img-src 'self' data: https:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'; font-src 'self' data:"
    );
  });
  desktopApp.route("/", createApiApp(createNodeDb(), { includeNotFound: false }));
  desktopApp.all("/api/*", (context) => context.json({ error: "Not found" }, 404));

  if (options.serveRenderer !== false) {
    const webRoot = join(app.getAppPath(), "apps", "web", "dist");
    const indexHtml = join(webRoot, "index.html");
    desktopApp.use("*", serveStatic({ root: webRoot }));
    desktopApp.get("*", async (context) => context.html(await readFile(indexHtml, "utf8")));
  }

  const server = serve({
    fetch: desktopApp.fetch,
    hostname: "127.0.0.1",
    port: options.port ?? 0
  });
  applicationServer = server;

  await new Promise<void>((resolve, reject) => {
    server.once("listening", resolve);
    server.once("error", reject);
  });

  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Electron application server did not bind to a TCP port");
  }
  return `http://127.0.0.1:${address.port}`;
}

function registerDesktopHandlers() {
  ipcMain.handle(desktopIpcChannels.getAppInfo, () => ({
    name: app.getName(),
    version: app.getVersion()
  }));
  ipcMain.handle(desktopIpcChannels.openExternal, async (_event, url: string) => {
    if (!isSafeExternalUrl(url)) throw new Error("Unsupported external URL");
    await shell.openExternal(url);
  });
}

async function waitForUrl(url: string) {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.ok) return url;
    } catch {
      // The renderer is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error(`Timed out waiting for the renderer at ${url}`);
}

function isSafeExternalUrl(url: string) {
  try {
    return ["https:", "http:", "mailto:"].includes(new URL(url).protocol);
  } catch {
    return false;
  }
}

async function showStartupError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  await dialog.showMessageBox({
    type: "error",
    title: "Oh My Canvas",
    message: "应用启动失败",
    detail: message
  });
  app.quit();
}
