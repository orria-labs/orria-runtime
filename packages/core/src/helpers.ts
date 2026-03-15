import type { ConfigStore, DatabaseAdapter } from "./types.ts";

type DatabaseClientsMap = Record<string, unknown>;

export interface TypedDatabaseAdapter<
  TClients extends DatabaseClientsMap,
  TDefault extends keyof TClients,
> extends DatabaseAdapter<TClients[TDefault]> {
  client(): TClients[TDefault];
  client<TKey extends keyof TClients>(region: TKey): TClients[TKey];
  client(region: string): TClients[keyof TClients];
  has(region: string): region is Extract<keyof TClients, string>;
  regions(): Array<Extract<keyof TClients, string>>;
}

export interface DefineDatabaseAdapterOptions<
  TClients extends DatabaseClientsMap,
  TDefault extends keyof TClients,
> {
  clients: TClients;
  default: TDefault;
  aliases?: Partial<Record<string, keyof TClients>>;
  normalizeRegion?: (region: string) => string;
}

export function createConfig(values: Record<string, unknown>): ConfigStore {
  return {
    get(key) {
      if (!(key in values)) {
        throw new Error(`Config key "${key}" is not defined`);
      }

      return values[key];
    },
    has(key) {
      return key in values;
    },
    all() {
      return Object.freeze({ ...values });
    },
  };
}

export function createDatabase<TClient>(
  clientFactory: (region?: string) => TClient,
): DatabaseAdapter<TClient> {
  return {
    client(region?: string) {
      return clientFactory(region);
    },
  };
}

export function defineDatabaseAdapter<
  TClients extends DatabaseClientsMap,
  TDefault extends keyof TClients,
>(
  options: DefineDatabaseAdapterOptions<TClients, TDefault>,
): TypedDatabaseAdapter<TClients, TDefault> {
  const normalize = options.normalizeRegion ?? ((value: string) => value);
  const regionKeys = Object.keys(options.clients) as Array<Extract<keyof TClients, string>>;
  const aliasMap = new Map<string, keyof TClients>();

  for (const region of regionKeys) {
    aliasMap.set(normalize(region), region);
  }

  for (const [alias, region] of Object.entries(options.aliases ?? {})) {
    if (region) {
      aliasMap.set(normalize(alias), region);
    }
  }

  const resolveRegion = (region: string): keyof TClients => {
    const normalized = normalize(region);
    const key = aliasMap.get(normalized);
    if (!key) {
      throw new Error(
        `Database client for region "${region}" is not defined. Available regions: ${regionKeys.join(", ")}`,
      );
    }

    return key;
  };

  return {
    client(region?: string) {
      if (!region) {
        return options.clients[options.default];
      }

      return options.clients[resolveRegion(region)];
    },
    has(region: string): region is Extract<keyof TClients, string> {
      return aliasMap.has(normalize(region));
    },
    regions() {
      return [...regionKeys];
    },
  } as TypedDatabaseAdapter<TClients, TDefault>;
}
