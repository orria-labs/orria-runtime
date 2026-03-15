import type {
  ApplicationAdapterFactory,
  BusTypesContract,
  DatabaseAdapter,
  EmptyBusTypes,
} from "./types.ts";

export function defineTransportAdapter<
  TInstance,
  TBuses extends BusTypesContract = EmptyBusTypes,
  TDatabase extends DatabaseAdapter = DatabaseAdapter,
>(
  factory: ApplicationAdapterFactory<TInstance, TBuses, TDatabase>,
): ApplicationAdapterFactory<TInstance, TBuses, TDatabase> {
  return factory;
}
