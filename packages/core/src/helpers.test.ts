import { describe, expect, it } from "bun:test";

import { defineDatabaseAdapter } from "./helpers.ts";

describe("defineDatabaseAdapter", () => {
  it("returns typed default client and resolves aliases", () => {
    const primary = { kind: "primary" as const };
    const analytics = { kind: "analytics" as const };

    const database = defineDatabaseAdapter({
      default: "primary",
      clients: {
        primary,
        analytics,
      },
      aliases: {
        default: "primary",
      },
      normalizeRegion: (region) => region.trim().toLowerCase(),
    });

    expect(database.client()).toBe(primary);
    expect(database.client("primary")).toBe(primary);
    expect(database.client("analytics")).toBe(analytics);
    expect(database.client("DEFAULT")).toBe(primary);
  });

  it("throws on unknown region", () => {
    const database = defineDatabaseAdapter({
      default: "primary",
      clients: {
        primary: { kind: "primary" as const },
      },
      normalizeRegion: (region) => region.trim().toLowerCase(),
    });

    expect(() => database.client("missing")).toThrow(
      'Database client for region "missing" is not defined.',
    );
  });
});
