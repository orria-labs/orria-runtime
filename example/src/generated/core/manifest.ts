import type { GeneratedManifest } from "@orria-labs/runtime";
import type { GeneratedBusTypes } from "./bus";
import actionUserCreate from "../../modules/user/create.action.ts";
import eventUserRegistered from "../../modules/user/registered.event.ts";
import queryUserGet from "../../modules/user/get.query.ts";
import workflowUserRegistration from "../../modules/user/registration.workflow.ts";

export const manifest: GeneratedManifest<GeneratedBusTypes> = {
  version: 1,
  generatedAt: "2026-03-15T09:37:14.934Z",
  entries: [
    {
      key: "action.user.create",
      kind: "action",
      logicalName: "user.create",
      modulePath: "src/modules/user/create.action.ts",
      declaration: actionUserCreate,
    },
    {
      key: "event.user.registered",
      kind: "event",
      logicalName: "user.registered",
      modulePath: "src/modules/user/registered.event.ts",
      declaration: eventUserRegistered,
    },
    {
      key: "query.user.get",
      kind: "query",
      logicalName: "user.get",
      modulePath: "src/modules/user/get.query.ts",
      declaration: queryUserGet,
    },
    {
      key: "workflow.user.registration",
      kind: "workflow",
      logicalName: "user.registration",
      modulePath: "src/modules/user/registration.workflow.ts",
      declaration: workflowUserRegistration,
    },
  ],
};

export default manifest;
