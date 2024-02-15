export * from "./application.service";
import { ApplicationAPIService } from "./application.service";
export * from "./assignment.service";
import { AssignmentAPIService } from "./assignment.service";
export * from "./permission.service";
import { PermissionAPIService } from "./permission.service";
export * from "./role.service";
import { RoleAPIService } from "./role.service";
export * from "./workspace.service";
import { WorkspaceAPIService } from "./workspace.service";
export const APIS = [
  ApplicationAPIService,
  AssignmentAPIService,
  PermissionAPIService,
  RoleAPIService,
  WorkspaceAPIService,
];
