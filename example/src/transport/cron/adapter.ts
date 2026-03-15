import path from "node:path";

import { createCronAdapter } from "@orria-labs/runtime-croner";

export const cronAdapter = createCronAdapter({
  rootDir: path.resolve(import.meta.dir, "../../.."),
});
