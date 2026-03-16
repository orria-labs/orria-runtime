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

export interface ActionRegistryEntry extends RegistryEntryBase {
  kind: "action";
  declaration: AnyExecutableDeclaration;
}

export interface QueryRegistryEntry extends RegistryEntryBase {
  kind: "query";
  declaration: AnyExecutableDeclaration;
}

export interface WorkflowRegistryEntry extends RegistryEntryBase {
  kind: "workflow";
  declaration: AnyExecutableDeclaration;
}

export type ExecutableRegistryEntry =
  | ActionRegistryEntry
  | QueryRegistryEntry
  | WorkflowRegistryEntry;

export type RegistryEntry = EventRegistryEntry | ExecutableRegistryEntry;

export interface CoreRegistry {
  manifest: GeneratedManifest;
  entries: RegistryEntry[];
  byKey: Map<string, RegistryEntry>;
  byKind: {
    action: ActionRegistryEntry[];
    query: QueryRegistryEntry[];
    workflow: WorkflowRegistryEntry[];
    event: EventRegistryEntry[];
  };
  eventSubscribers: Map<string, WorkflowRegistryEntry[]>;
}
