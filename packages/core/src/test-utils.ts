import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

export async function createTempProject(
  files: Record<string, string>,
): Promise<{ rootDir: string; cleanup: () => Promise<void> }> {
  const rootDir = await mkdtemp(path.join(os.tmpdir(), "orria-runtime-"));

  for (const [relativeFilePath, content] of Object.entries(files)) {
    const absoluteFilePath = path.join(rootDir, relativeFilePath);
    await mkdir(path.dirname(absoluteFilePath), { recursive: true });
    await writeFile(absoluteFilePath, content, "utf8");
  }

  return {
    rootDir,
    cleanup: () => rm(rootDir, { recursive: true, force: true }),
  };
}

export function toImportPath(fromFile: string, targetFile: string): string {
  const relativePath = path
    .relative(path.dirname(fromFile), targetFile)
    .split(path.sep)
    .join("/");
  return relativePath.startsWith(".") ? relativePath : `./${relativePath}`;
}
