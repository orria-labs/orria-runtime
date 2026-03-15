import { describe, expect, it } from "bun:test";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const cliPath = path.join(import.meta.dir, "main.ts");
const packageVersion = await readCliPackageVersion();

describe("orria-runtime CLI", () => {
  it("shows commands and version on default launch", async () => {
    const result = await runCli([]);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("Orria Runtime CLI");
    expect(result.stdout).toContain(`v${packageVersion}`);
    expect(result.stdout).toContain("COMMANDS");
    expect(result.stdout).toContain("generate");
    expect(result.stdout).toContain("help");
    expect(result.stdout).toContain("init");
    expect(result.stdout).toContain("version");
  });

  it("prints package version", async () => {
    const result = await runCli(["--version"]);

    expect(result.exitCode).toBe(0);
    expect(result.stdout.trim()).toBe(packageVersion);
  });

  it("supports version as a subcommand", async () => {
    const result = await runCli(["version"]);

    expect(result.exitCode).toBe(0);
    expect(result.stdout.trim()).toBe(packageVersion);
  });

  it("supports help as a subcommand", async () => {
    const result = await runCli(["help"]);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("COMMANDS");
    expect(result.stdout).toContain("generate");
    expect(result.stdout).toContain("help");
    expect(result.stdout).toContain("init");
    expect(result.stdout).toContain("version");
  });

  it("shows command help through help subcommand", async () => {
    const result = await runCli(["help", "generate"]);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("orria-runtime generate");
    expect(result.stdout).toContain("--root");
    expect(result.stdout).toContain("--modules");
    expect(result.stdout).toContain("--out");
  });

  it("initializes a scaffolded project", async () => {
    const rootDir = await mkdtemp(path.join(os.tmpdir(), "orria-init-"));

    try {
      const result = await runCli([
        "init",
        "--dir",
        rootDir,
        "--name",
        "demo-app",
        "--adapters",
        "http,cli",
      ]);
      const packageJson = await readFile(path.join(rootDir, "package.json"), "utf8");
      const indexSource = await readFile(path.join(rootDir, "src/index.ts"), "utf8");
      const httpAdapterSource = await readFile(
        path.join(rootDir, "src/transport/http/adapter.ts"),
        "utf8",
      );
      const healthRouteSource = await readFile(
        path.join(rootDir, "src/transport/http/router/health.get.ts"),
        "utf8",
      );

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("Initialized demo-app");
      expect(result.stdout).toContain("Adapters: http, cli");
      expect(packageJson).toContain('"name": "demo-app"');
      expect(packageJson).toContain('"@orria-labs/runtime-elysia"');
      expect(packageJson).toContain('"@orria-labs/runtime-citty"');
      expect(packageJson).not.toContain('"@orria-labs/runtime-croner"');
      expect(indexSource).not.toContain("CreateApplicationOptions");
      expect(indexSource).toContain("http: httpAdapter");
      expect(indexSource).toContain("cli: cliAdapter");
      expect(indexSource).not.toContain("cron: cronAdapter");
      expect(httpAdapterSource).toContain("defineHttpAdapter");
      expect(httpAdapterSource).toContain("defineHandler");
      expect(healthRouteSource).toContain('import { defineHandler } from "../adapter.ts";');
      expect(result.stderr).toBe("");
    } finally {
      await rm(rootDir, { recursive: true, force: true });
    }
  });
});

async function readCliPackageVersion(): Promise<string> {
  const packageJsonPath = path.join(import.meta.dir, "..", "..", "package.json");
  const packageJson = JSON.parse(await readFile(packageJsonPath, "utf8")) as {
    version: string;
  };

  return packageJson.version;
}

async function runCli(args: string[]) {
  const proc = Bun.spawn(["bun", cliPath, ...args], {
    cwd: path.join(import.meta.dir, "..", "..", ".."),
    stdout: "pipe",
    stderr: "pipe",
    env: {
      ...process.env,
      NO_COLOR: "1",
    },
  });

  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);

  return { stdout, stderr, exitCode };
}
