import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import type { AdapterCodegen } from "@orria-labs/runtime";

import { discoverCronSchedules } from "../discovery.ts";

export interface GenerateCronScheduleRegistryOptions {
  rootDir?: string;
  schedulesDir?: string;
  outFile?: string;
}

export async function generateCronScheduleRegistryArtifacts(
  options: GenerateCronScheduleRegistryOptions = {},
): Promise<{ scheduleNames: string[]; outFile: string }> {
  const rootDir = options.rootDir ?? process.cwd();
  const outFile = options.outFile ?? path.join("src", "generated", "cron", "schedule-registry.d.ts");
  const schedules = await discoverCronSchedules({
    rootDir,
    schedulesDir: options.schedulesDir,
  });
  const absoluteOutFile = path.join(rootDir, outFile);
  const scheduleNames = Array.from(new Set(schedules.map((schedule) => schedule.name)))
    .sort((left, right) => left.localeCompare(right));

  await mkdir(path.dirname(absoluteOutFile), { recursive: true });
  await writeFile(
    absoluteOutFile,
    renderCronScheduleRegistry(scheduleNames),
    "utf8",
  );

  return {
    scheduleNames,
    outFile,
  };
}

export const orriaAdapterCodegen: AdapterCodegen = {
  name: "cron-schedule-registry",
  async generate({ rootDir }) {
    const result = await generateCronScheduleRegistryArtifacts({ rootDir });

    return {
      name: "cron-schedule-registry",
      outputs: [result.outFile],
    };
  },
};

function renderCronScheduleRegistry(scheduleNames: string[]): string {
  const entries = scheduleNames
    .map((name) => `    ${JSON.stringify(name)}: true;`)
    .join("\n");

  return `declare module "@orria-labs/runtime-croner" {
  interface CronScheduleRegistry {
${entries}
  }
}

export {};
`;
}
