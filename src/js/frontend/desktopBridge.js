export function isDesktopBuild() {
  return typeof LOCAL_DESKTOP_APP !== "undefined" && LOCAL_DESKTOP_APP === true;
}

export function isDesktopApp() {
  return typeof window !== "undefined" && window.f1DbDesktop?.isDesktop === true;
}

export function shouldUseDesktopMode() {
  return isDesktopBuild() || isDesktopApp();
}

function getBridge() {
  return window.f1DbDesktop;
}

function bytesToUint8Array(bytes) {
  if (bytes instanceof Uint8Array) {
    return bytes;
  }

  if (bytes instanceof ArrayBuffer) {
    return new Uint8Array(bytes);
  }

  if (ArrayBuffer.isView(bytes)) {
    return new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  }

  if (bytes?.type === "Buffer" && Array.isArray(bytes.data)) {
    return new Uint8Array(bytes.data);
  }

  if (Array.isArray(bytes)) {
    return new Uint8Array(bytes);
  }

  throw new Error("Unsupported byte payload from desktop bridge");
}

function payloadToFile(payload) {
  if (!payload || payload.canceled) return null;

  const bytes = bytesToUint8Array(payload.bytes);
  const file = new File([bytes], payload.name, { type: "application/binary" });

  Object.defineProperty(file, "desktopPath", {
    value: payload.path,
    configurable: false,
    enumerable: false,
  });

  return file;
}

async function blobLikeToArrayBuffer(data) {
  if (data instanceof Blob) {
    return data.arrayBuffer();
  }

  if (data instanceof ArrayBuffer) {
    return data;
  }

  if (ArrayBuffer.isView(data)) {
    return data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);
  }

  if (data?.type === "Buffer" && Array.isArray(data.data)) {
    return new Uint8Array(data.data).buffer;
  }

  if (Array.isArray(data)) {
    return new Uint8Array(data).buffer;
  }

  throw new Error("Unsupported data for desktop save dialog");
}

export async function openDesktopSaveFile() {
  if (!isDesktopApp()) return null;

  const payload = await getBridge().openSaveFile();
  return payloadToFile(payload);
}

export async function readDesktopRecentFile(recent) {
  if (!isDesktopApp() || !recent?.path) return null;

  const payload = await getBridge().readRecentFile(recent.path);
  return payloadToFile(payload);
}

export async function saveDesktopFile(defaultName, data) {
  if (!isDesktopApp()) return { canceled: true };

  const bytes = await blobLikeToArrayBuffer(data);
  return getBridge().saveFile({ defaultName, bytes });
}

export async function rememberDesktopFile(fileOrPath) {
  if (!isDesktopApp()) return;

  const filePath =
    typeof fileOrPath === "string"
      ? fileOrPath
      : fileOrPath?.desktopPath || fileOrPath?.path;

  if (filePath) {
    await getBridge().rememberRecent(filePath);
  }
}

export function getDesktopTier() {
  return {
    paidMember: true,
    tier: "Founder",
    tierNumber: 3,
    whitelisted: true,
    isLoggedIn: true,
    user: { fullName: "Local Mac App" },
  };
}
