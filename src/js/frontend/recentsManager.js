import { get, set } from 'idb-keyval';
import { isDesktopApp } from './desktopBridge.js';

const DB_NAME = "SaveEditorDB";
const STORE_NAME = "recentFileHandles";
const DB_VERSION = 1; 

function openDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = (e) => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME, { keyPath: "name" });
            }
        };
        request.onsuccess = (e) => resolve(e.target.result);
        request.onerror = (e) => reject("Error opening DB");
    });
}

export async function saveHandleToRecents(handle) {
    if (isDesktopApp()) {
        const filePath = handle?.desktopPath || handle?.path;
        if (filePath) {
            await window.f1DbDesktop.rememberRecent(filePath);
        }
        return;
    }

    let recents = (await get('recentFiles')) || [];
    
    recents = recents.filter(r => r.name !== handle.name);
    
    recents.unshift({
        name: handle.name,
        handle: handle, 
        lastOpened: new Date()
    });

    await set('recentFiles', recents);
}

export async function getRecentHandles() {
    if (isDesktopApp()) {
        return await window.f1DbDesktop.listRecents();
    }

    return (await get('recentFiles')) || [];
}

export async function removeRecentHandle(name) {
    if (isDesktopApp()) {
        return await window.f1DbDesktop.forgetRecent(name);
    }

    let recents = (await get('recentFiles')) || [];
    recents = recents.filter(r => r.name !== name);
    await set('recentFiles', recents);
}
