const { app, BrowserWindow, dialog, ipcMain, net, protocol, shell } = require("electron");
const fs = require("fs/promises");
const path = require("path");
const { pathToFileURL } = require("url");

protocol.registerSchemesAsPrivileged([
  {
    scheme: "app",
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
      stream: true,
    },
  },
]);

const APP_HOST = "local";

function getAppRoot() {
  return path.join(__dirname, "..");
}

function getDistPath() {
  return path.join(getAppRoot(), "dist");
}

function getRecentsPath() {
  return path.join(app.getPath("userData"), "recent-files.json");
}

function safeDistPath(urlPathname) {
  const requestedPath = decodeURIComponent(urlPathname === "/" ? "/index.html" : urlPathname);
  const relativePath = requestedPath.replace(/^\/+/, "");
  const resolvedPath = path.normalize(path.join(getDistPath(), relativePath));
  const distRoot = path.normalize(getDistPath());

  if (!resolvedPath.startsWith(distRoot)) {
    return path.join(distRoot, "index.html");
  }

  return resolvedPath;
}

async function readRecents() {
  try {
    const raw = await fs.readFile(getRecentsPath(), "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writeRecents(recents) {
  await fs.mkdir(path.dirname(getRecentsPath()), { recursive: true });
  await fs.writeFile(getRecentsPath(), JSON.stringify(recents.slice(0, 12), null, 2));
}

async function rememberRecent(filePath) {
  if (!filePath) return [];

  const absolutePath = path.resolve(filePath);
  await fs.access(absolutePath);

  const recents = (await readRecents()).filter((item) => item.path !== absolutePath);
  recents.unshift({
    name: path.basename(absolutePath),
    path: absolutePath,
    lastOpened: new Date().toISOString(),
  });

  await writeRecents(recents);
  return recents;
}

async function listExistingRecents() {
  const recents = await readRecents();
  const existing = [];

  for (const item of recents) {
    if (!item?.path) continue;
    try {
      await fs.access(item.path);
      existing.push(item);
    } catch {
      // Drop stale paths from the stored list.
    }
  }

  if (existing.length !== recents.length) {
    await writeRecents(existing);
  }

  return existing;
}

function filePayload(filePath, bytes) {
  return {
    name: path.basename(filePath),
    path: filePath,
    bytes,
  };
}

async function readFilePayload(filePath) {
  const absolutePath = path.resolve(filePath);
  const bytes = await fs.readFile(absolutePath);
  await rememberRecent(absolutePath);
  return filePayload(absolutePath, bytes);
}

function registerAppProtocol() {
  protocol.handle("app", async (request) => {
    const url = new URL(request.url);

    if (url.host !== APP_HOST) {
      return new Response("Not found", { status: 404 });
    }

    const filePath = safeDistPath(url.pathname);
    return net.fetch(pathToFileURL(filePath).toString());
  });
}

function createWindow() {
  const window = new BrowserWindow({
    width: 1440,
    height: 960,
    minWidth: 1120,
    minHeight: 760,
    title: "F1 Manager Database Editor",
    backgroundColor: "#0f0f10",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  window.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });

  window.webContents.on("will-navigate", (event, url) => {
    if (!url.startsWith(`app://${APP_HOST}/`)) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });

  window.loadURL(`app://${APP_HOST}/index.html`);
}

function registerIpc() {
  ipcMain.handle("desktop:open-save-file", async () => {
    const result = await dialog.showOpenDialog({
      title: "Open F1 Manager save",
      properties: ["openFile"],
      filters: [
        { name: "F1 Manager saves", extensions: ["sav"] },
        { name: "All files", extensions: ["*"] },
      ],
    });

    if (result.canceled || result.filePaths.length === 0) {
      return { canceled: true };
    }

    return readFilePayload(result.filePaths[0]);
  });

  ipcMain.handle("desktop:read-recent-file", async (_event, filePath) => {
    return readFilePayload(filePath);
  });

  ipcMain.handle("desktop:save-file", async (_event, payload) => {
    const defaultName = payload?.defaultName || "save.sav";
    const result = await dialog.showSaveDialog({
      title: "Save exported file",
      defaultPath: defaultName,
    });

    if (result.canceled || !result.filePath) {
      return { canceled: true };
    }

    const bytes = payload?.bytes;
    const buffer = Buffer.isBuffer(bytes)
      ? bytes
      : Buffer.from(bytes instanceof ArrayBuffer ? new Uint8Array(bytes) : bytes);

    await fs.writeFile(result.filePath, buffer);
    return { canceled: false, path: result.filePath };
  });

  ipcMain.handle("desktop:list-recents", async () => {
    return listExistingRecents();
  });

  ipcMain.handle("desktop:remember-recent", async (_event, filePath) => {
    return rememberRecent(filePath);
  });

  ipcMain.handle("desktop:forget-recent", async (_event, filePath) => {
    const recents = (await readRecents()).filter((item) => item.path !== filePath);
    await writeRecents(recents);
    return recents;
  });
}

app.whenReady().then(() => {
  registerAppProtocol();
  registerIpc();
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
