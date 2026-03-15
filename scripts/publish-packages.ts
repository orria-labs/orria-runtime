import path from "node:path";

import { readPackageManifest, releasePackages } from "./release/workspace.ts";

const rootDir = path.resolve(import.meta.dir, "..");
const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const tag = readFlagValue(args, "--tag");
const otp = readFlagValue(args, "--otp");

for (const entry of releasePackages) {
  const packageDir = path.join(rootDir, entry.dir);
  const distDir = path.join(packageDir, "dist");
  const manifest = await readPackageManifest(distDir);
  const packageId = `${manifest.name}@${manifest.version}`;

  // Повторный запуск publish-скрипта должен быть безопасным: уже опубликованные
  // версии пропускаются, чтобы можно было дозавершить релиз после частичного сбоя.
  if (await isPublished(manifest.name, manifest.version)) {
    console.log(`Skipping ${packageId}: already published`);
    continue;
  }

  const command = ["npm", "publish", distDir, "--access", "public"];

  if (dryRun) {
    command.push("--dry-run");
  }

  if (tag) {
    command.push("--tag", tag);
  }

  if (otp) {
    command.push("--otp", otp);
  }

  console.log(`${dryRun ? "Dry-running" : "Publishing"} ${packageId}`);

  const proc = Bun.spawn(command, {
    cwd: rootDir,
    stdout: "inherit",
    stderr: "inherit",
    stdin: "inherit",
  });

  const exitCode = await proc.exited;

  if (exitCode !== 0) {
    throw new Error(`npm publish failed for ${packageId}`);
  }
}

function readFlagValue(args: string[], flagName: string): string | undefined {
  const index = args.indexOf(flagName);

  if (index >= 0) {
    return args[index + 1];
  }

  const prefixed = args.find((entry) => entry.startsWith(`${flagName}=`));
  return prefixed?.slice(flagName.length + 1);
}

async function isPublished(packageName: string, version: string): Promise<boolean> {
  const proc = Bun.spawn(["npm", "view", `${packageName}@${version}`, "version", "--json"], {
    cwd: rootDir,
    stdout: "pipe",
    stderr: "pipe",
  });

  const exitCode = await proc.exited;
  return exitCode === 0;
}
