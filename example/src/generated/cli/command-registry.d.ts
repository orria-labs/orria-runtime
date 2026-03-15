declare module "@orria-labs/runtime-citty" {
  interface CliCommandRegistry {
    "system": ["system", ...string[]];
    "system.info": ["system", "info", ...string[]];
    "user": ["user", ...string[]];
    "user.create": ["user", "create", ...string[]];
  }

  interface CliCommandAliasRegistry {
    "user.new": ["user", "new", ...string[]];
  }
}

export {};
