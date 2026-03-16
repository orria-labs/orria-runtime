import { createHash } from "node:crypto";
import { readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";

export interface PollingFileWatcherOptions {
  roots: string[];
  intervalMs?: number;
  includeFile?(filePath: string): boolean;
  onChange(): Promise<void> | void;
  onError?(error: unknown): void;
}

export interface PollingFileWatcher {
  readonly active: boolean;
  start(): Promise<void>;
  stop(): void;
}

interface FileFingerprint {
  statSignature: string;
  hash: string;
}

interface DirectorySnapshot {
  signature: string;
  files: Map<string, FileFingerprint>;
}

export function createPollingFileWatcher(
  options: PollingFileWatcherOptions,
): PollingFileWatcher {
  const intervalMs = options.intervalMs ?? 250;
  let timer: ReturnType<typeof setInterval> | undefined;
  let currentSignature = "";
  let currentFiles = new Map<string, FileFingerprint>();
  let polling = false;

  const refresh = async () => {
    if (polling) {
      return;
    }

    polling = true;

    try {
      const nextSnapshot = await collectRootsSnapshot(
        options.roots,
        options.includeFile,
        currentFiles,
      );
      const nextSignature = nextSnapshot.signature;

      if (!currentSignature) {
        currentSignature = nextSignature;
        currentFiles = nextSnapshot.files;
        return;
      }

      if (nextSignature !== currentSignature) {
        currentSignature = nextSignature;
        currentFiles = nextSnapshot.files;
        await options.onChange();
        return;
      }

      currentFiles = nextSnapshot.files;
    } catch (error) {
      options.onError?.(error);
    } finally {
      polling = false;
    }
  };

  return {
    get active() {
      return Boolean(timer);
    },
    async start() {
      if (timer) {
        return;
      }

      const snapshot = await collectRootsSnapshot(options.roots, options.includeFile, currentFiles);
      currentSignature = snapshot.signature;
      currentFiles = snapshot.files;
      timer = setInterval(() => {
        void refresh();
      }, intervalMs);
    },
    stop() {
      if (timer) {
        clearInterval(timer);
        timer = undefined;
      }
    },
  };
}

async function collectRootsSnapshot(
  roots: string[],
  includeFile?: (filePath: string) => boolean,
  previousFiles: Map<string, FileFingerprint> = new Map(),
): Promise<DirectorySnapshot> {
  const snapshots = await Promise.all(
    roots.map((root) => collectDirectorySnapshot(root, includeFile, previousFiles)),
  );
  const files = new Map<string, FileFingerprint>();

  for (const snapshot of snapshots) {
    for (const [filePath, fingerprint] of snapshot.files) {
      files.set(filePath, fingerprint);
    }
  }

  return {
    signature: snapshots.map((snapshot) => snapshot.signature).join("|"),
    files,
  };
}

async function collectDirectorySnapshot(
  rootDir: string,
  includeFile?: (filePath: string) => boolean,
  previousFiles: Map<string, FileFingerprint> = new Map(),
): Promise<DirectorySnapshot> {
  let entries;

  try {
    entries = await readdir(rootDir, { withFileTypes: true });
  } catch (error) {
    const nodeError = error as NodeJS.ErrnoException;

    if (nodeError.code === "ENOENT") {
      return {
        signature: "",
        files: new Map(),
      };
    }

    throw error;
  }

  const parts: string[] = [];
  const files = new Map<string, FileFingerprint>();

  for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
    const absolutePath = path.join(rootDir, entry.name);

    if (entry.isDirectory()) {
      const snapshot = await collectDirectorySnapshot(absolutePath, includeFile, previousFiles);
      parts.push(snapshot.signature);

      for (const [filePath, fingerprint] of snapshot.files) {
        files.set(filePath, fingerprint);
      }

      continue;
    }

    if (!entry.isFile()) {
      continue;
    }

    if (includeFile && !includeFile(absolutePath)) {
      continue;
    }

    const fileStats = await stat(absolutePath);
    const statSignature = `${fileStats.mtimeMs}:${fileStats.size}`;
    const previousFingerprint = previousFiles.get(absolutePath);
    const fingerprint = previousFingerprint?.statSignature === statSignature
      ? previousFingerprint
      : {
        statSignature,
        hash: await hashFile(absolutePath),
      };

    files.set(absolutePath, fingerprint);
    parts.push(`${absolutePath}:${fingerprint.statSignature}:${fingerprint.hash}`);
  }

  return {
    signature: parts.join("|"),
    files,
  };
}

async function hashFile(filePath: string): Promise<string> {
  const source = await readFile(filePath, "utf8");
  return createHash("sha1").update(source).digest("hex");
}
