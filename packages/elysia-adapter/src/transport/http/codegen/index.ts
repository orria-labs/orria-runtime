import type { AdapterCodegen } from "@orria-labs/runtime";

import { generateHttpAppRegistryArtifacts } from "./generate-app-registry.ts";
import { generateHttpPluginRegistryArtifacts } from "./generate-plugin-registry.ts";

export const orriaAdapterCodegen: AdapterCodegen[] = [{
  name: "http-plugin-registry",
  async generate({ rootDir }) {
    const result = await generateHttpPluginRegistryArtifacts({ rootDir });

    return {
      name: "http-plugin-registry",
      outputs: [result.outFile],
    };
  },
}, {
  name: "http-app-registry",
  async generate({ rootDir }) {
    const result = await generateHttpAppRegistryArtifacts({ rootDir });

    return {
      name: "http-app-registry",
      outputs: [result.outFile, result.registryOutFile],
    };
  },
}];
