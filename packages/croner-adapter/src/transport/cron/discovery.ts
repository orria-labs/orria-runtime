import { readdir } from "node:fs/promises";
import path from "node:path";
import { importFreshModule, isOrriaTempModulePath } from "@orria-labs/runtime";

import type {
  CronScheduleDefinition,
  DiscoverCronSchedulesOptions,
  ResolvedCronScheduleModule,
} from "./types.ts";
import {
  isBrandedCronScheduleDefinition,
  isCronScheduleDefinition,
} from "./schedules/shared.ts";

const DEFAULT_SCHEDULES_DIR = path.join("src", "transport", "cron", "schedules");
const SUPPORTED_FILE_EXTENSIONS = new Set([".ts", ".mts", ".js", ".mjs"]);

export async function discoverCronSchedules(
  options: DiscoverCronSchedulesOptions,
): Promise<Array<CronScheduleDefinition<any, any>>> {
  const modules = await discoverCronScheduleModules(options);
  return modules.flatMap((moduleEntry) => moduleEntry.schedules);
}

export async function discoverCronScheduleModules(
  options: DiscoverCronSchedulesOptions,
): Promise<ResolvedCronScheduleModule[]> {
  const schedulesRootDir = path.resolve(
    options.rootDir,
    options.schedulesDir ?? DEFAULT_SCHEDULES_DIR,
  );

  const filePaths = await collectScheduleFiles(schedulesRootDir);
  const modules: ResolvedCronScheduleModule[] = [];

  for (const filePath of filePaths) {
    const moduleExports = await importFreshModule<Record<string, unknown>>(filePath);
    const schedules = extractSchedulesFromModule(moduleExports, filePath);

    modules.push({
      filePath,
      schedules,
    });
  }

  return modules;
}

export function validateCronSchedules(
  schedules: Array<Pick<CronScheduleDefinition<any, any>, "name" | "schedule">>,
): void {
  const names = new Set<string>();

  for (const schedule of schedules) {
    if (!schedule.name.trim()) {
      throw new Error("Cron schedule name must not be empty");
    }

    if (!schedule.schedule.trim()) {
      throw new Error(`Cron schedule "${schedule.name}" must define a schedule expression`);
    }

    if (names.has(schedule.name)) {
      throw new Error(`Duplicate cron schedule name "${schedule.name}"`);
    }

    names.add(schedule.name);
  }
}

async function collectScheduleFiles(rootDir: string): Promise<string[]> {
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
      filePaths.push(...await collectScheduleFiles(absolutePath));
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

function extractSchedulesFromModule(
  moduleExports: Record<string, unknown>,
  filePath: string,
): CronScheduleDefinition[] {
  const schedules: CronScheduleDefinition[] = [];
  const seen = new Set<unknown>();

  for (const value of Object.values(moduleExports)) {
    collectSchedules(value, schedules, seen);
  }

  if (schedules.length === 0) {
    throw new Error(`Cron schedules module "${filePath}" does not export any schedules`);
  }

  return schedules;
}

function collectSchedules(
  value: unknown,
  schedules: CronScheduleDefinition[],
  seen: Set<unknown>,
): void {
  if (seen.has(value)) {
    return;
  }

  if (Array.isArray(value)) {
    seen.add(value);
    for (const entry of value) {
      collectSchedules(entry, schedules, seen);
    }
    return;
  }

  if (isBrandedCronScheduleDefinition(value) || isCronScheduleDefinition(value)) {
    seen.add(value);
    schedules.push(value as CronScheduleDefinition<any, any>);
  }
}
