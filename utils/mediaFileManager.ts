/**
 * Media File Manager
 * Handles local caching of chat media files with background download support.
 * Files are stored in: documentDirectory/media_cache/<fileName>
 *
 * Usage:
 *   import { getLocalUri, startDownload, useMediaDownload } from '@/utils/mediaFileManager';
 *
 *   const localUri = await getLocalUri(fileName);       // null if not cached
 *   startDownload(fileName, remoteUrl);                  // fire-and-forget
 *   const { state, progress } = useMediaDownload(fileName); // react hook
 */

import * as FileSystem from "expo-file-system";
import { create } from "zustand";
import { getApiUrl } from "@/stores/apiStore";

// ─── Constants ────────────────────────────────────────────────────────────────

const CACHE_DIR = `${FileSystem.documentDirectory}media_cache/`;

export function getRemoteMediaUrl(fileName: string): string {
  return `${getApiUrl()}/media/chat/${fileName}`;
}

export function getLocalPath(fileName: string): string {
  return `${CACHE_DIR}${fileName}`;
}

// ─── Directory bootstrap ──────────────────────────────────────────────────────

let dirReady = false;
async function ensureCacheDir(): Promise<void> {
  if (dirReady) return;
  const info = await FileSystem.getInfoAsync(CACHE_DIR);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(CACHE_DIR, { intermediates: true });
  }
  dirReady = true;
}

// ─── Public helpers ───────────────────────────────────────────────────────────

/** Returns a file:// URI if the file is already downloaded, otherwise null. */
export async function getLocalUri(fileName: string): Promise<string | null> {
  await ensureCacheDir();
  const path = getLocalPath(fileName);
  try {
    const info = await FileSystem.getInfoAsync(path);
    return info.exists ? path : null;
  } catch {
    return null;
  }
}

/** Synchronous check using the zustand store (no I/O). */
export function isDownloaded(fileName: string): boolean {
  return useMediaStore.getState().files[fileName]?.state === "done";
}

// ─── Zustand store ────────────────────────────────────────────────────────────

export type MediaFileState = "idle" | "downloading" | "done" | "error";

interface FileEntry {
  state: MediaFileState;
  progress: number; // 0‑1
}

interface MediaStoreState {
  files: Record<string, FileEntry>;
  setFile: (fileName: string, entry: Partial<FileEntry>) => void;
  markScanned: (fileName: string, exists: boolean) => void;
}

export const useMediaStore = create<MediaStoreState>((set) => ({
  files: {},
  setFile: (fileName, entry) =>
    set((s) => ({
      files: {
        ...s.files,
        [fileName]: { ...({ state: "idle", progress: 0 } as FileEntry), ...s.files[fileName], ...entry },
      },
    })),
  markScanned: (fileName, exists) =>
    set((s) => ({
      files: {
        ...s.files,
        [fileName]: { state: exists ? "done" : "idle", progress: exists ? 1 : 0 },
      },
    })),
}));

// ─── Scan (check local FS once per file) ──────────────────────────────────────

const scannedSet = new Set<string>();

/** Check if file exists on disk and update the store. Deduplicates. */
export async function scanFile(fileName: string): Promise<boolean> {
  if (scannedSet.has(fileName)) {
    const entry = useMediaStore.getState().files[fileName];
    return entry?.state === "done";
  }
  scannedSet.add(fileName);
  const uri = await getLocalUri(fileName);
  const exists = uri !== null;
  useMediaStore.getState().markScanned(fileName, exists);
  return exists;
}

// ─── Download ─────────────────────────────────────────────────────────────────

const activeDownloads = new Map<string, FileSystem.DownloadResumable>();

export async function startDownload(fileName: string): Promise<string | null> {
  const store = useMediaStore.getState();
  const current = store.files[fileName];
  if (current?.state === "downloading" || current?.state === "done") return null;

  await ensureCacheDir();
  const remoteUrl = getRemoteMediaUrl(fileName);
  const localPath = getLocalPath(fileName);

  // Ensure parent directories exist (fileName may contain subdirectories)
  const lastSlash = localPath.lastIndexOf("/");
  if (lastSlash > 0) {
    const parentDir = localPath.substring(0, lastSlash);
    const parentInfo = await FileSystem.getInfoAsync(parentDir);
    if (!parentInfo.exists) {
      await FileSystem.makeDirectoryAsync(parentDir, { intermediates: true });
    }
  }

  store.setFile(fileName, { state: "downloading", progress: 0 });

  const downloadResumable = FileSystem.createDownloadResumable(
    remoteUrl,
    localPath,
    {},
    ({ totalBytesWritten, totalBytesExpectedToWrite }) => {
      const p = totalBytesExpectedToWrite > 0 ? totalBytesWritten / totalBytesExpectedToWrite : 0;
      useMediaStore.getState().setFile(fileName, { progress: p });
    }
  );

  activeDownloads.set(fileName, downloadResumable);

  try {
    const result = await downloadResumable.downloadAsync();
    activeDownloads.delete(fileName);
    if (result?.uri) {
      useMediaStore.getState().setFile(fileName, { state: "done", progress: 1 });
      return result.uri;
    }
    useMediaStore.getState().setFile(fileName, { state: "error", progress: 0 });
    return null;
  } catch (err) {
    activeDownloads.delete(fileName);
    console.error("[MediaFileManager] Download failed:", fileName, err);
    useMediaStore.getState().setFile(fileName, { state: "error", progress: 0 });
    return null;
  }
}

export function cancelDownload(fileName: string): void {
  const dl = activeDownloads.get(fileName);
  if (dl) {
    dl.pauseAsync().catch(() => {});
    activeDownloads.delete(fileName);
  }
  useMediaStore.getState().setFile(fileName, { state: "idle", progress: 0 });
  FileSystem.deleteAsync(getLocalPath(fileName), { idempotent: true }).catch(() => {});
}

/** Download multiple files sequentially. Returns count of successful downloads. */
export async function startBatchDownload(fileNames: string[]): Promise<number> {
  let success = 0;
  for (const fn of fileNames) {
    const result = await startDownload(fn);
    if (result) success++;
  }
  return success;
}

export function cancelBatchDownload(fileNames: string[]): void {
  for (const fn of fileNames) {
    cancelDownload(fn);
  }
}

// ─── React hook ───────────────────────────────────────────────────────────────

/** Returns the download state and progress for a single file. */
export function useMediaDownload(fileName: string): FileEntry {
  return useMediaStore((s) => s.files[fileName] ?? { state: "idle" as const, progress: 0 });
}

// ─── Resolve URI (local preferred, remote fallback) ───────────────────────────

/** Returns local file:// URI if downloaded, otherwise the remote URL. */
export function resolveMediaUri(fileName: string): string {
  const entry = useMediaStore.getState().files[fileName];
  if (entry?.state === "done") {
    return getLocalPath(fileName);
  }
  return getRemoteMediaUrl(fileName);
}
