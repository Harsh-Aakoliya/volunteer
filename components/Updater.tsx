import React, {
  useEffect,
  useRef,
  useImperativeHandle,
  forwardRef,
  useCallback,
} from "react";
import { View, Platform } from "react-native";
import * as FileSystem from "expo-file-system";
import { startActivityAsync } from "expo-intent-launcher";
import { API_URL } from "@/constants/api";
import {
  checkApkExists,
  getApkLocalPath,
  clearExistingApk,
  type DownloadStatus,
} from "@/utils/apkDownloadService";

const DOWNLOAD_TASK_ID = "app-update-apk";

export interface UpdaterHandle {
  pause: () => Promise<void>;
  resume: () => Promise<void>;
  retry: () => void;
}

interface UpdaterProps {
  version: string | null;
  onProgress?: (progress: number) => void;
  onDone?: () => void;
  onFileNotFound?: () => void;
  onFailed?: (error: string, canRetry: boolean) => void;
  onStateChange?: (status: DownloadStatus) => void;
  onPaused?: () => void;
  onResumed?: () => void;
  retryCount?: number;
  maxRetries?: number;
}

function createExpoDownloadResumable(
  uri: string,
  localFilePath: string,
  onProgress: (p: number) => void
): FileSystem.DownloadResumable {
  return FileSystem.createDownloadResumable(
    uri,
    localFilePath,
    {},
    (progress) => {
      if (progress.totalBytesExpectedToWrite > 0) {
        const p =
          progress.totalBytesWritten / progress.totalBytesExpectedToWrite;
        onProgress(p);
      }
    }
  );
}

export const Updater = forwardRef<UpdaterHandle, UpdaterProps>(function Updater(
  {
    version,
    onProgress,
    onDone,
    onFileNotFound,
    onFailed,
    onStateChange,
    onPaused,
    onResumed,
    retryCount = 0,
    maxRetries = 3,
  },
  ref
) {
  const downloadTaskRef = useRef<any>(null);
  const expoDownloadRef = useRef<FileSystem.DownloadResumable | null>(null);
  const isStartingRef = useRef(false);

  const installApk = useCallback(async (localFilePath: string) => {
    try {
      const localUri = await FileSystem.getContentUriAsync(localFilePath);
      await startActivityAsync("android.intent.action.INSTALL_PACKAGE", {
        data: localUri,
        flags: 1,
      });
      await FileSystem.deleteAsync(localFilePath, { idempotent: true });
      onDone?.();
    } catch (e: any) {
      console.error("Install error:", e);
      onFailed?.(e?.message || "Installation failed", false);
    }
  }, [onDone, onFailed]);

  const runExpoFallback = useCallback(
    async (
      uri: string,
      localFilePath: string,
      onProg: (p: number) => void,
      install: (path: string) => Promise<void>,
      done?: () => void,
      failed?: (err: string, canRetry: boolean) => void,
      retries = 0,
      max = 3,
      stateChange?: (s: DownloadStatus) => void
    ) => {
      await clearExistingApk();
      const resumable = createExpoDownloadResumable(
        uri,
        localFilePath,
        onProg
      );
      expoDownloadRef.current = resumable;
      try {
        const result = await resumable.downloadAsync();
        expoDownloadRef.current = null;
        if (result?.uri) {
          stateChange?.("completed");
          await install(result.uri);
          done?.();
        } else {
          stateChange?.("failed");
          failed?.("Download incomplete", retries < max);
        }
      } catch (e: any) {
        expoDownloadRef.current = null;
        stateChange?.("failed");
        failed?.(e?.message || "Download failed", retries < max);
      } finally {
        isStartingRef.current = false;
      }
    },
    []
  );

  const startDownload = useCallback(async () => {
    if (!version || isStartingRef.current) return;

    const apiUrl = String(API_URL);
    const uri = `${apiUrl}/media/${version}.apk`;
    const localFilePath = getApkLocalPath();

    isStartingRef.current = true;
    onStateChange?.("checking");

    // 1. Check file exists
    const exists = await checkApkExists(apiUrl, version);
    if (!exists) {
      onStateChange?.("fileNotFound");
      onFileNotFound?.();
      isStartingRef.current = false;
      return;
    }

    onStateChange?.("downloading");

    if (Platform.OS === "android") {
      try {
        const RNBD = require("@kesha-antonov/react-native-background-downloader");
        const {
          createDownloadTask,
          directories,
          getExistingDownloadTasks,
          completeHandler,
        } = RNBD;

        const dest = `${directories.documents}/update.apk`;
        await clearExistingApk();

        // Re-attach to existing task if app was restarted
        const existing = await getExistingDownloadTasks();
        const existingTask = existing.find((t: { id: string }) => t.id === DOWNLOAD_TASK_ID);
        let task = existingTask;

        if (!task) {
          task = createDownloadTask({
            id: DOWNLOAD_TASK_ID,
            url: uri,
            destination: dest,
          })
            .begin(() => {})
            .progress(({ bytesDownloaded, bytesTotal }: { bytesDownloaded: number; bytesTotal: number }) => {
              if (bytesTotal > 0) {
                onProgress?.(bytesDownloaded / bytesTotal);
              }
            })
            .done(async ({ location }: { location: string }) => {
              downloadTaskRef.current = null;
              onStateChange?.("completed");
              await completeHandler(DOWNLOAD_TASK_ID);
              await installApk(location);
            })
            .error(({ error, errorCode }: { error?: string; errorCode?: number }) => {
              downloadTaskRef.current = null;
              onStateChange?.("failed");
              const canRetry = retryCount < maxRetries;
              onFailed?.(
                error || `Download failed (code: ${errorCode})`,
                canRetry
              );
            });
        } else {
          task
            .progress(({ bytesDownloaded, bytesTotal }: { bytesDownloaded: number; bytesTotal: number }) => {
              if (bytesTotal > 0) {
                onProgress?.(bytesDownloaded / bytesTotal);
              }
            })
            .done(async ({ location }: { location: string }) => {
              downloadTaskRef.current = null;
              onStateChange?.("completed");
              await completeHandler(DOWNLOAD_TASK_ID);
              await installApk(location);
            })
            .error(({ error, errorCode }: { error?: string; errorCode?: number }) => {
              downloadTaskRef.current = null;
              onStateChange?.("failed");
              const canRetry = retryCount < maxRetries;
              onFailed?.(
                error || `Download failed (code: ${errorCode})`,
                canRetry
              );
            });
        }

        downloadTaskRef.current = task;
        task.start();
      } catch (err: any) {
        console.warn("Background downloader failed, fallback to expo:", err);
        downloadTaskRef.current = null;
        await runExpoFallback(
          uri,
          localFilePath,
          onProgress || (() => {}),
          installApk,
          onDone,
          onFailed,
          retryCount,
          maxRetries,
          onStateChange
        );
        return;
      }
      isStartingRef.current = false;
    } else {
      await runExpoFallback(
        uri,
        localFilePath,
        onProgress || (() => {}),
        installApk,
        onDone,
        onFailed,
        retryCount,
        maxRetries,
        onStateChange
      );
    }
  }, [
    version,
    onProgress,
    onDone,
    onFileNotFound,
    onFailed,
    onStateChange,
    retryCount,
    maxRetries,
    installApk,
    runExpoFallback,
  ]);

  useImperativeHandle(
    ref,
    () => ({
      pause: async () => {
        const task = downloadTaskRef.current;
        if (task?.pause) {
          await task.pause();
          onStateChange?.("paused");
          onPaused?.();
        } else if (expoDownloadRef.current?.pauseAsync) {
          await expoDownloadRef.current.pauseAsync();
          onStateChange?.("paused");
          onPaused?.();
        }
      },
      resume: async () => {
        const task = downloadTaskRef.current;
        if (task?.resume) {
          await task.resume();
          onStateChange?.("downloading");
          onResumed?.();
        } else if (expoDownloadRef.current?.resumeAsync) {
          const result = await expoDownloadRef.current.resumeAsync();
          if (result?.uri) {
            onStateChange?.("completed");
            await installApk(result.uri);
          } else {
            onStateChange?.("downloading");
            onResumed?.();
          }
        }
      },
      retry: () => {
        downloadTaskRef.current = null;
        expoDownloadRef.current = null;
        startDownload();
      },
    }),
    [onStateChange, onPaused, onResumed, installApk, startDownload]
  );

  useEffect(() => {
    if (version) {
      startDownload();
    }
    return () => {
      isStartingRef.current = false;
    };
  }, [version]);

  return <View />;
});
