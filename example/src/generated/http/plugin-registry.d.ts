declare module "@orria-labs/runtime-elysia" {
  interface HttpPluginRegistry {
    "openapi": typeof import("../../transport/http/plugins/openapi.ts").default;
    "spec": typeof import("../../transport/http/plugins/openapi.ts").default;
    "request-source": typeof import("../../transport/http/plugins/request-source.ts").default;
  }
}

export {};
