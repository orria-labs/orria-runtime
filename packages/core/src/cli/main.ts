#!/usr/bin/env bun
import { runMain } from "citty";

import { orriaRuntimeCommand } from "./command.ts";

await runMain(orriaRuntimeCommand);
