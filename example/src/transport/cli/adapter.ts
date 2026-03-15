import path from "node:path";

import { createCliAdapter } from "@orria-labs/runtime-citty";

export const cliAdapter = createCliAdapter({
  rootDir: path.resolve(import.meta.dir, "../../.."),
});
