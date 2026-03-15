import type { AdapterCodegen } from "@orria-labs/runtime";

import { generateHttpPluginRegistryArtifacts } from "./generate-plugin-registry.ts";

export const orriaAdapterCodegen: AdapterCodegen = {
  name: "http-plugin-registry",
  async generate({ rootDir }) {
    const result = await generateHttpPluginRegistryArtifacts({ rootDir });

    return {
      name: "http-plugin-registry",
      outputs: [result.outFile],
    };
  },
};
