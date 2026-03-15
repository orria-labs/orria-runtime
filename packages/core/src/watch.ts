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

export function createPollingFileWatcher(
  options: PollingFileWatcherOptions,
): PollingFileWatcher {
  const intervalMs = options.intervalMs ?? 250;
  let timer: ReturnType<typeof setInterval> | undefined;
  let currentSignature = "";
  let polling = false;

  const refresh = async () => {
    if (polling) {
      return;
    }

    polling = true;

    try {
      const nextSignature = await collectRootsSignature(options.roots, options.includeFile);

      if (!currentSignature) {
        currentSignature = nextSignature;
        return;
      }

      if (nextSignature !== currentSignature) {
        currentSignature = nextSignature;
        await options.onChange();
      }
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

      currentSignature = await collectRootsSignature(options.roots, options.includeFile);
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

async function collectRootsSignature(
  roots: string[],
  includeFile?: (filePath: string) => boolean,
): Promise<string> {
  const parts = await Promise.all(
    roots.map((root) => collectDirectorySignature(root, includeFile)),
  );

  return parts.join("|");
}

async function collectDirectorySignature(
  rootDir: string,
  includeFile?: (filePath: string) => boolean,
): Promise<string> {
  let entries;

  try {
    entries = await readdir(rootDir, { withFileTypes: true });
  } catch (error) {
    const nodeError = error as NodeJS.ErrnoException;

    if (nodeError.code === "ENOENT") {
      return "";
    }

    throw error;
  }

  const parts: string[] = [];

  for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
    const absolutePath = path.join(rootDir, entry.name);

    if (entry.isDirectory()) {
      parts.push(await collectDirectorySignature(absolutePath, includeFile));
      continue;
    }

    if (!entry.isFile()) {
      continue;
    }

    if (includeFile && !includeFile(absolutePath)) {
      continue;
    }

    const fileStats = await stat(absolutePath);
    const fileHash = await hashFile(absolutePath);
    parts.push(`${absolutePath}:${fileStats.mtimeMs}:${fileStats.size}:${fileHash}`);
  }

  return parts.join("|");
}

async function hashFile(filePath: string): Promise<string> {
  const source = await readFile(filePath, "utf8");
  return createHash("sha1").update(source).digest("hex");
}
