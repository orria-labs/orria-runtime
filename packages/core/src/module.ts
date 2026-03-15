import { createHash } from "node:crypto";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

const ORRIA_TEMP_MARKER = ".orria-";

// Bun кеширует file-модули даже когда меняется query в URL.
// Поэтому мы загружаем переписанную временную копию из системного temp-dir,
// а не создаём файл рядом с исходником: так `bun --watch` не принимает наши
// внутренние импорты за пользовательские изменения и не уходит в цикл рестартов.
//
// Важно: временный файл должен оставаться на диске и после import.
// В watch-режиме Bun может подписаться на зависимость чуть позже, и если
// удалить файл слишком рано, рантайм увидит «пропавший import» и начнёт
// бесконечно перезапускать процесс.
export async function importFreshModule<TModule = Record<string, unknown>>(
  filePath: string,
): Promise<TModule> {
  const fileStats = await stat(filePath);
  const fileSource = await readFile(filePath, "utf8");
  const filePathHash = createHash("sha1").update(filePath).digest("hex").slice(0, 12);
  const sourceHash = createHash("sha1").update(fileSource).digest("hex");
  const rewrittenSource = rewriteRelativeImports(fileSource, filePath);
  const parsedPath = path.parse(filePath);
  const cacheDir = path.join(os.tmpdir(), "orria-runtime-imports");
  const tempFilePath = path.join(
    cacheDir,
    `${parsedPath.name}.${filePathHash}${ORRIA_TEMP_MARKER}${fileStats.mtimeMs}-${sourceHash}${parsedPath.ext}`,
  );

  await mkdir(cacheDir, { recursive: true });
  await ensureCachedModuleFile(tempFilePath, rewrittenSource);

  return await import(pathToFileURL(tempFilePath).href) as TModule;
}

export function isOrriaTempModulePath(filePath: string): boolean {
  return path.basename(filePath).includes(ORRIA_TEMP_MARKER);
}

function rewriteRelativeImports(source: string, fromFilePath: string): string {
  const replaceSpecifier = (_match: string, prefix: string, specifier: string, suffix: string) => {
    const importUrl = resolveImportSpecifier(specifier, fromFilePath);

    return `${prefix}${importUrl}${suffix}`;
  };

  return source
    .replace(/(\bfrom\s+["'])(\.[^"']+)(["'])/g, replaceSpecifier)
    .replace(/(\bimport\s*\(\s*["'])(\.[^"']+)(["']\s*\))/g, replaceSpecifier)
    .replace(/(\bfrom\s+["'])([^"'.][^"']*)(["'])/g, replaceSpecifier)
    .replace(/(\bimport\s*\(\s*["'])([^"'.][^"']*)(["']\s*\))/g, replaceSpecifier);
}

function resolveImportSpecifier(specifier: string, fromFilePath: string): string {
  if (specifier.startsWith("node:") || /^[a-zA-Z][a-zA-Z\d+.-]*:/.test(specifier)) {
    return specifier;
  }

  const resolvedPath = specifier.startsWith(".")
    ? path.resolve(path.dirname(fromFilePath), specifier)
    : Bun.resolveSync(specifier, fromFilePath);

  return pathToFileURL(resolvedPath).href;
}

async function ensureCachedModuleFile(filePath: string, source: string): Promise<void> {
  // Если такая версия временного модуля уже есть, повторно не трогаем файл:
  // это уменьшает шум для watch-режима и убирает лишние записи на диск.
  try {
    await stat(filePath);
    return;
  } catch (error) {
    const nodeError = error as NodeJS.ErrnoException;

    if (nodeError.code !== "ENOENT") {
      throw error;
    }
  }

  await writeFile(filePath, source, "utf8");
}
