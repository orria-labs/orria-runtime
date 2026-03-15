import type { WorkflowDeclaration } from "../types.ts";
import type {
  CoreRegistry,
  ExecutableRegistryEntry,
  GeneratedManifest,
  RegistryEntry,
  RegistrySubscriber,
} from "./types.ts";

const KINDS = ["action", "query", "workflow", "event"] as const;

export function createRegistry(manifest: GeneratedManifest): CoreRegistry {
  const byKey = new Map<string, RegistryEntry>();
  const byKind: CoreRegistry["byKind"] = {
    action: [],
    query: [],
    workflow: [],
    event: [],
  };
  const logicalNames = new Map<string, string>();

  for (const entry of manifest.entries) {
    if (!KINDS.includes(entry.kind)) {
      throw new Error(`Unsupported declaration kind "${entry.kind}" for "${entry.key}"`);
    }

    if (byKey.has(entry.key)) {
      throw new Error(`Duplicate handler key "${entry.key}"`);
    }

    const conflict = logicalNames.get(entry.logicalName);
    if (conflict && conflict !== entry.kind) {
      throw new Error(
        `Cross-kind handler conflict for "${entry.logicalName}" between "${conflict}" and "${entry.kind}"`,
      );
    }

    logicalNames.set(entry.logicalName, entry.kind);

    const registryEntry: RegistryEntry = {
      ...entry,
      declaration: entry.declaration as RegistryEntry["declaration"],
      segments: entry.logicalName.split("."),
    } as RegistryEntry;

    byKey.set(entry.key, registryEntry);
    byKind[entry.kind].push(registryEntry as never);
  }

  const eventSubscribers = new Map<string, RegistrySubscriber[]>();
  const eventKeys = new Set(byKind.event.map((entry) => entry.key));

  registerSubscribers(byKind.workflow, eventKeys, eventSubscribers);

  for (const kind of KINDS) {
    byKind[kind].sort((left, right) => left.key.localeCompare(right.key));
  }

  return {
    manifest,
    entries: [...byKey.values()].sort((left, right) => left.key.localeCompare(right.key)),
    byKey,
    byKind,
    eventSubscribers,
  };
}

function registerSubscribers(
  entries: ExecutableRegistryEntry[],
  eventKeys: Set<string>,
  eventSubscribers: Map<string, RegistrySubscriber[]>,
): void {
  for (const entry of entries) {
    const declaration = entry.declaration as WorkflowDeclaration<unknown, unknown, any>;
    const subscribesTo = declaration.subscribesTo ?? [];

    for (const eventKey of subscribesTo) {
      if (!eventKeys.has(eventKey)) {
        throw new Error(`Handler "${entry.key}" subscribes to unknown event "${eventKey}"`);
      }

      const subscribers = eventSubscribers.get(eventKey) ?? [];
      subscribers.push({ key: entry.key, kind: "workflow" });
      eventSubscribers.set(eventKey, subscribers);
    }
  }
}

export function getRegistryEntry(registry: CoreRegistry, key: string): RegistryEntry {
  const entry = registry.byKey.get(key);
  if (!entry) {
    throw new Error(`Handler "${key}" is not registered`);
  }

  return entry;
}
