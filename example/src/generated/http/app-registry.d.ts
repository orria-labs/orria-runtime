declare module "@orria-labs/runtime-elysia" {
  interface HttpDiscoveredAppRegistry {
    app: typeof import("./app.ts").app;
  }
}

export {};
