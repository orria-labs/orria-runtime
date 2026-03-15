import type {
  AnyExecutableDeclaration,
  BusTypesContract,
  CoreDeclaration,
  EventDeclaration,
  HandlerKind,
} from "../types.ts";

export interface GeneratedManifestEntry {
  key: string;
  kind: HandlerKind;
  logicalName: string;
  modulePath: string;
  declaration: CoreDeclaration;
}

export interface GeneratedManifest<
  TBuses extends BusTypesContract = BusTypesContract,
> {
  version: number;
  generatedAt: string;
  entries: GeneratedManifestEntry[];
  // Это phantom-type поле не участвует в runtime, но позволяет выводить
  // bus-контракт из generated manifest прямо в `createApplication(...)`.
  readonly __buses__?: TBuses;
}

export interface RegistrySubscriber {
  key: string;
  kind: "workflow";
}

export interface RegistryEntryBase {
  key: string;
  kind: HandlerKind;
  logicalName: string;
  modulePath: string;
  segments: string[];
}

export interface EventRegistryEntry extends RegistryEntryBase {
  kind: "event";
  declaration: EventDeclaration<unknown>;
}

export interface ExecutableRegistryEntry extends RegistryEntryBase {
  kind: "action" | "query" | "workflow";
  declaration: AnyExecutableDeclaration;
}

export type RegistryEntry = EventRegistryEntry | ExecutableRegistryEntry;

export interface CoreRegistry {
  manifest: GeneratedManifest;
  entries: RegistryEntry[];
  byKey: Map<string, RegistryEntry>;
  byKind: {
    action: ExecutableRegistryEntry[];
    query: ExecutableRegistryEntry[];
    workflow: ExecutableRegistryEntry[];
    event: EventRegistryEntry[];
  };
  eventSubscribers: Map<string, RegistrySubscriber[]>;
}
