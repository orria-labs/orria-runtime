import z from "zod";
import { defineHandler } from "../../contract.ts";

export default defineHandler({
  handle: ({ ctx, query }) =>
    ctx.query.user.get({
      userId: query.userId,
    }),
  options: {
    query: z.object({
      userId: z.string(),
    }),
    detail: {
      summary: "Reads a user status",
      description: "Reads a user status from the example in-memory database",
    },
  },
});

/// Пример того, как этот ctx выглядел бы в сыром Elysia router

// const c = {} as ApplicationContext<
//   GeneratedBusTypes,
//   TypedDatabaseAdapter<
//     {
//       primary: ExampleDatabaseClient;
//     },
//     "primary"
//   >
// >;

// new Elysia().decorate("ctx", c).route(
//   "GET",
//   "/user-status",
//   ({ ctx, query }) =>
//     ctx.query.user.get({
//       userId: String(query.userId ?? ""),
//     }),
//   {
//     body: z.object({
//       userId: z.string(),
//     }),
//     query: z.unknown(),
//     params: z.unknown(),
//     detail: {
//       summary: "Reads a user status",
//       description: "Reads a user status from the example in-memory database",
//     },
//   },
// );
