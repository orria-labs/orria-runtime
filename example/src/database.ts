import { defineDatabaseAdapter } from "@orria-labs/runtime";

export interface UserRecord {
  id: string;
  email: string;
}

export interface ExampleDatabaseClient {
  users: Map<string, UserRecord>;
  auditLog: string[];
}

export function createExampleDatabaseClient(): ExampleDatabaseClient {
  return {
    users: new Map(),
    auditLog: [],
  };
}

export const databaseClient = createExampleDatabaseClient();

export const database = defineDatabaseAdapter({
  default: "primary",
  clients: {
    primary: databaseClient,
  },
  aliases: {
    default: "primary",
  },
  normalizeRegion: (region) => region.trim().toLowerCase(),
});

export type ExampleDatabaseAdapter = typeof database;
