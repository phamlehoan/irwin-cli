import { createApp } from "vue";
import RoleDetailPermissions from "../components/admin/RoleDetailPermissions.vue";
import { getI18n } from "../i18n";

const i18n = getI18n();

const rolePermissionsEl = document.getElementById("rolePermissionsApp");
if (rolePermissionsEl) {
  const dataEl = document.getElementById("rolePermissionsData");
  const data = JSON.parse(dataEl ? dataEl.textContent || "{}" : "{}") as {
    formAction?: string;
    features?: unknown[];
    initialPermissionIds?: string[];
    isReadOnly?: boolean;
  };
  const app = createApp(RoleDetailPermissions, {
    formAction: data.formAction ?? "",
    features: Array.isArray(data.features) ? data.features : [],
    initialPermissionIds: Array.isArray(data.initialPermissionIds)
      ? data.initialPermissionIds
      : [],
    isReadOnly: Boolean(data.isReadOnly),
  });
  app.provide("t", i18n.t);
  app.mount("#rolePermissionsApp");
}
