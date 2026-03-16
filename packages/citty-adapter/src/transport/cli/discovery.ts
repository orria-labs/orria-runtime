import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { importFreshModule, isOrriaTempModulePath } from "@orria-labs/runtime";

import type {
  CliCommandDefinition,
  CliCommandMeta,
  DiscoverCliCommandsOptions,
  ResolvedCliCommandModule,
} from "./types.ts";
import { isCliCommandDefinition } from "./command/shared.ts";

const DEFAULT_COMMANDS_DIR = path.join("src", "transport", "cli", "command");
const SUPPORTED_FILE_EXTENSIONS = new Set([".ts", ".mts", ".js", ".mjs"]);

export async function discoverCliCommands(
  options: DiscoverCliCommandsOptions,
): Promise<CliCommandDefinition[]> {
  const modules = await discoverCliCommandModules(options);
  return modules.map((entry) => ({
    ...entry.command,
    path: entry.path,
  }));
}

export async function discoverCliCommandModules(
  options: DiscoverCliCommandsOptions,
): Promise<ResolvedCliCommandModule[]> {
  const commandsRootDir = path.resolve(
    options.rootDir,
    options.commandsDir ?? DEFAULT_COMMANDS_DIR,
  );

  const filePaths = await collectCommandFiles(commandsRootDir);
  return Promise.all(
    filePaths.map(async (filePath) => {
      const moduleExports = await importFreshModule<Record<string, unknown>>(filePath);
      const command = extractCommandFromModule(moduleExports, filePath);

      return {
      filePath,
      path: resolveCommandPath(commandsRootDir, filePath, command),
      command,
      };
    }),
  );
}

export function normalizeCommandSegment(segment: string): string {
  return segment
    .trim()
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/[^a-zA-Z0-9-]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
}

export function validateCliCommands(commands: CliCommandDefinition[]): void {
  const fullPaths = new Set<string>();

  for (const command of commands) {
    const pathSegments = normalizeCommandPath(command.path ?? command.name ?? "");
    const aliases = command.aliases ?? command.meta?.aliases ?? [];
    const pathKey = pathSegments.join(" ");

    if (pathSegments.length === 0 && (command.run || command.setup || command.cleanup)) {
      continue;
    }

    if (pathSegments.length === 0) {
      throw new Error("CLI command must define a path or name");
    }

    if (fullPaths.has(pathKey)) {
      throw new Error(`Duplicate CLI command path "${pathKey}"`);
    }

    fullPaths.add(pathKey);

    const aliasSet = new Set<string>();
    for (const alias of aliases) {
      const normalizedAlias = normalizeCommandSegment(alias);

      if (!normalizedAlias) {
        throw new Error(`CLI command "${pathKey}" has an empty alias`);
      }

      if (aliasSet.has(normalizedAlias)) {
        throw new Error(`CLI command "${pathKey}" has duplicate alias "${normalizedAlias}"`);
      }

      aliasSet.add(normalizedAlias);
    }
  }
}

export async function resolveCliPackageMeta(
  rootDir: string,
): Promise<CliCommandMeta | undefined> {
  const packageFilePath = path.join(rootDir, "package.json");

  try {
    const packageJson = JSON.parse(await readFile(packageFilePath, "utf8")) as {
      name?: string;
      version?: string;
      description?: string;
    };

    return {
      name: packageJson.name,
      version: packageJson.version,
      description: packageJson.description,
    };
  } catch (error) {
    const nodeError = error as NodeJS.ErrnoException;

    if (nodeError.code === "ENOENT") {
      return undefined;
    }

    throw error;
  }
}

function resolveCommandPath(
  commandsRootDir: string,
  filePath: string,
  command: CliCommandDefinition,
): string[] {
  if (command.path) {
    return normalizeCommandPath(command.path);
  }

  if (command.name && command.name.includes("/")) {
    return normalizeCommandPath(command.name);
  }

  const relativePath = path.relative(commandsRootDir, filePath);
  const fileSegments = relativePath
    .replace(path.extname(relativePath), "")
    .split(path.sep)
    .map((segment) => normalizeCommandSegment(segment))
    .filter(Boolean);

  if (fileSegments[fileSegments.length - 1] === "index") {
    fileSegments.pop();
  }

  if (command.name) {
    const explicitName = normalizeCommandSegment(command.name);
    if (explicitName) {
      fileSegments[fileSegments.length - 1] = explicitName;
    }
  }

  return fileSegments;
}

function normalizeCommandPath(pathOrName: string | string[]): string[] {
  const rawSegments = Array.isArray(pathOrName)
    ? pathOrName
    : pathOrName.split("/");

  return rawSegments
    .flatMap((segment) => segment.split(" "))
    .map((segment) => normalizeCommandSegment(segment))
    .filter(Boolean);
}

async function collectCommandFiles(rootDir: string): Promise<string[]> {
  let entries;

  try {
    entries = await readdir(rootDir, { withFileTypes: true });
  } catch (error) {
    const nodeError = error as NodeJS.ErrnoException;

    if (nodeError.code === "ENOENT") {
      return [];
    }

    throw error;
  }

  const filePaths: string[] = [];

  for (const entry of entries) {
    const absolutePath = path.join(rootDir, entry.name);

    if (entry.isDirectory()) {
      filePaths.push(...await collectCommandFiles(absolutePath));
      continue;
    }

    if (!entry.isFile()) {
      continue;
    }

    if (isOrriaTempModulePath(absolutePath)) {
      continue;
    }

    const extension = path.extname(entry.name);
    if (!SUPPORTED_FILE_EXTENSIONS.has(extension) || entry.name.endsWith(".d.ts")) {
      continue;
    }

    filePaths.push(absolutePath);
  }

  return filePaths.sort((left, right) => left.localeCompare(right));
}

function extractCommandFromModule(
  moduleExports: Record<string, unknown>,
  filePath: string,
): CliCommandDefinition {
  for (const value of Object.values(moduleExports)) {
    if (isCliCommandDefinition(value)) {
      return value as CliCommandDefinition;
    }
  }

  throw new Error(`CLI command module "${filePath}" does not export a command`);
}
