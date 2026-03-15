import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineCommand, renderUsage, type CommandDef } from "citty";

import { runInstalledAdapterCodegens } from "./codegen.ts";
import {
  initializeProjectScaffold,
  parseInitAdapters,
} from "./init.ts";
import { generateCoreArtifacts } from "../codegen/generate.ts";

interface PackageManifest {
  name?: string;
  version?: string;
}

const runtimePackageName = "@orria-labs/runtime";

const packageVersion = await readPackageVersion();

export const generateCommand = defineCommand({
  meta: {
    name: "generate",
    description: "Generate manifest and typed bus artifacts",
  },
  args: {
    root: {
      type: "string",
      description: "Project root directory",
      valueHint: "dir",
      default: ".",
    },
    modules: {
      type: "string",
      description: "Modules directory to scan",
      valueHint: "dir",
      default: "src/modules",
    },
    out: {
      type: "string",
      description: "Output directory for generated files",
      valueHint: "dir",
      default: "src/generated/core",
    },
  },
  async run({ args }) {
    const manifest = await generateCoreArtifacts({
      rootDir: args.root,
      modulesDir: args.modules,
      outDir: args.out,
    });

    await runInstalledAdapterCodegens(args.root, manifest);

    console.log(`Generated ${manifest.entries.length} declarations into ${args.out}`);
  },
});

export const versionCommand = defineCommand({
  meta: {
    name: "version",
    description: "Print CLI version",
  },
  run() {
    console.log(packageVersion);
  },
});

export const initCommand = defineCommand({
  meta: {
    name: "init",
    description: "Initialize a new Orria Runtime project scaffold",
  },
  args: {
    dir: {
      type: "string",
      description: "Target directory for the scaffold",
      valueHint: "dir",
      default: ".",
    },
    name: {
      type: "string",
      description: "Package name for the generated project",
    },
    adapters: {
      type: "string",
      description: "Comma-separated transport adapters: http,cli,cron or none",
      default: "http,cli,cron",
    },
    force: {
      type: "boolean",
      description: "Overwrite existing scaffold files if they already exist",
      default: false,
    },
  },
  async run({ args }) {
    const result = await initializeProjectScaffold({
      dir: args.dir,
      name: args.name,
      adapters: parseInitAdapters(args.adapters),
      force: Boolean(args.force),
      version: packageVersion,
    });

    console.log(`Initialized ${result.packageName} in ${result.rootDir}`);
    console.log(`Adapters: ${result.adapters.join(", ") || "none"}`);
    console.log(`Created ${result.createdFiles.length} files`);
    console.log("Next steps:");
    console.log("  bun install");
    console.log("  bun run generate");
    console.log("  bun run typecheck");
  },
});

export const helpCommand = defineCommand({
  meta: {
    name: "help",
    description: "Show help for the CLI or a command",
  },
  args: {
    command: {
      type: "positional",
      description: "Command name",
      required: false,
    },
  },
  async run({ args }) {
    const { command, parent } = resolveUsageTarget(args.command);
    console.log(await renderUsage(command, parent));
  },
});

export const orriaRuntimeCommand = defineCommand({
  meta: {
    name: "orria-runtime",
    version: packageVersion,
    description: "Orria Runtime CLI",
  },
  subCommands: {
    generate: generateCommand,
    help: helpCommand,
    init: initCommand,
    version: versionCommand,
  },
  async run({ cmd, rawArgs }) {
    const hasSubCommand = rawArgs.some((arg) => !arg.startsWith("-"));

    if (hasSubCommand) {
      return;
    }

    console.log(await renderUsage(cmd));
  },
});

export async function readPackageVersion(importMetaUrlValue: string = import.meta.url): Promise<string> {
  const manifest = await readRuntimePackageManifest(importMetaUrlValue);

  return manifest.version ?? "0.0.0";
}

async function readRuntimePackageManifest(importMetaUrlValue: string): Promise<PackageManifest> {
  let currentDir = path.dirname(fileURLToPath(importMetaUrlValue));

  while (true) {
    const packageFilePath = path.join(currentDir, "package.json");

    try {
      const source = await readFile(packageFilePath, "utf8");
      const manifest = JSON.parse(source) as PackageManifest;

      if (manifest.name === runtimePackageName) {
        return manifest;
      }
    } catch (error) {
      const nodeError = error as NodeJS.ErrnoException;

      if (nodeError.code !== "ENOENT") {
        throw error;
      }
    }

    const parentDir = path.dirname(currentDir);

    if (parentDir === currentDir) {
      break;
    }

    currentDir = parentDir;
  }

  throw new Error(`Unable to locate package.json for ${runtimePackageName}`);
}

function resolveUsageTarget(name?: string): { command: CommandDef<any>; parent?: CommandDef<any> } {
  if (!name) {
    return {
      command: orriaRuntimeCommand,
      parent: undefined,
    };
  }

  if (name === "generate") {
    return {
      command: generateCommand,
      parent: orriaRuntimeCommand,
    };
  }

  if (name === "help") {
    return {
      command: helpCommand,
      parent: orriaRuntimeCommand,
    };
  }

  if (name === "init") {
    return {
      command: initCommand,
      parent: orriaRuntimeCommand,
    };
  }

  if (name === "version") {
    return {
      command: versionCommand,
      parent: orriaRuntimeCommand,
    };
  }

  return {
    command: orriaRuntimeCommand,
    parent: undefined,
  };
}
