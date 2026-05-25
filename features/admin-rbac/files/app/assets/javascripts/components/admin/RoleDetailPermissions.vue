<template>
  <section class="admin-card admin-role-perms">
    <header class="admin-card__head">
      <h2 class="admin-card__title">{{ t("admin.permission_information") }}</h2>
      <button
        type="button"
        class="admin-btn admin-btn-primary"
        :disabled="isReadOnly"
        @click="submitPermissions"
      >
        {{ t("admin.apply_permissions") }}
      </button>
    </header>

    <div v-if="hasMenuGroups" class="admin-role-perms__grid">
      <div class="admin-role-perms__col">
        <p class="admin-role-perms__label">{{ t("admin.modules_list") }}</p>
        <p class="admin-role-perms__hint">{{ t("admin.modules_list_hint") }}</p>
        <label class="admin-check admin-check--row">
          <input
            ref="selectAllModulesEl"
            type="checkbox"
            :checked="allModulesSelected"
            :disabled="isReadOnly"
            @change="onSelectAllModules"
          />
          <span>{{ t("select_all") }}</span>
        </label>
        <ul class="admin-module-list">
          <li
            v-for="g in menuGroups"
            :key="g.id"
            class="admin-module-list__item"
            :class="{ 'admin-module-list__item--active': selectedMenuGroupId === g.id }"
          >
            <label class="admin-check" @click.stop>
              <input
                type="checkbox"
                :checked="moduleCheckedMenuGroup(g)"
                :disabled="isReadOnly"
                @change="onMenuGroupCheck(g, $event)"
              />
            </label>
            <button
              type="button"
              class="admin-module-list__btn"
              @click="selectedMenuGroupId = g.id"
            >
              {{ g.name }}
            </button>
          </li>
        </ul>
      </div>

      <div class="admin-role-perms__col">
        <p class="admin-role-perms__label">{{ t("admin.functions_components") }}</p>
        <p class="admin-role-perms__hint">{{ t("admin.role_perm_functions_intro") }}</p>
        <label class="admin-check admin-check--row">
          <input
            ref="selectAllPermsEl"
            type="checkbox"
            :checked="allPermsInPanelSelected"
            :disabled="!selectedMenuGroupId || isReadOnly"
            @change="onSelectAllPerms"
          />
          <span>{{ t("select_all") }}</span>
        </label>
        <p v-if="!selectedMenuGroupId" class="admin-empty-hint">
          {{ t("admin.perm_pick_menu_group") }}
        </p>
        <p v-else-if="featuresInSelectedGroup.length === 0" class="admin-empty-hint">
          {{ t("admin.perm_no_child_features") }}
        </p>
        <div v-else class="admin-acc">
          <div
            v-for="f in featuresInSelectedGroup"
            :key="f.id"
            class="admin-acc__item"
          >
            <button
              type="button"
              class="admin-acc__trigger"
              :aria-expanded="featureExpanded(f.id)"
              @click="toggleFeature(f.id)"
            >
              <span>{{ f.name }}</span>
              <span class="admin-acc__chevron" :class="{ 'is-open': featureExpanded(f.id) }">▾</span>
            </button>
            <div v-show="featureExpanded(f.id)" class="admin-acc__panel">
              <label
                v-for="p in f.permissions || []"
                :key="p.id"
                class="admin-check admin-check--row"
              >
                <input
                  type="checkbox"
                  :checked="permissionIds.includes(p.id)"
                  :disabled="isReadOnly"
                  @change="togglePerm(p.id, ($event.target as HTMLInputElement).checked)"
                />
                <span class="admin-perm-code">{{ p.code }}</span>
              </label>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div v-else class="admin-role-perms__grid">
      <div class="admin-role-perms__col">
        <p class="admin-role-perms__label">{{ t("admin.modules_list") }}</p>
        <label class="admin-check admin-check--row">
          <input
            ref="legacySelectAllModulesEl"
            type="checkbox"
            :checked="allLegacyModulesSelected"
            :disabled="isReadOnly"
            @change="onLegacySelectAllModules"
          />
          <span>{{ t("select_all") }}</span>
        </label>
        <label
          v-for="f in features"
          :key="'mod-' + f.id"
          class="admin-check admin-check--row admin-check--bordered"
        >
          <input
            type="checkbox"
            :checked="moduleCheckedFeature(f)"
            :disabled="isReadOnly"
            @change="onLegacyModuleCheck(f, $event)"
          />
          <span>{{ f.name }}</span>
        </label>
      </div>
      <div class="admin-role-perms__col">
        <p class="admin-role-perms__label">{{ t("admin.functions_components") }}</p>
        <p class="admin-role-perms__hint">{{ t("admin.functions_components_hint") }}</p>
        <label class="admin-check admin-check--row">
          <input
            ref="legacySelectAllPermsEl"
            type="checkbox"
            :checked="allLegacyPermsSelected"
            :disabled="isReadOnly"
            @change="onLegacySelectAllPerms"
          />
          <span>{{ t("select_all") }}</span>
        </label>
        <div class="admin-acc">
          <div v-for="f in features" :key="'acc-' + f.id" class="admin-acc__item">
            <button
              type="button"
              class="admin-acc__trigger"
              :aria-expanded="featureExpanded(f.id)"
              @click="toggleFeature(f.id)"
            >
              <span>{{ f.name }}</span>
              <span class="admin-acc__chevron" :class="{ 'is-open': featureExpanded(f.id) }">▾</span>
            </button>
            <div v-show="featureExpanded(f.id)" class="admin-acc__panel">
              <label
                v-for="p in f.permissions || []"
                :key="p.id"
                class="admin-check admin-check--row"
              >
                <input
                  type="checkbox"
                  :checked="permissionIds.includes(p.id)"
                  :disabled="isReadOnly"
                  @change="togglePerm(p.id, ($event.target as HTMLInputElement).checked)"
                />
                <span class="admin-perm-code">{{ p.code }}</span>
              </label>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<script lang="ts">
import { defineComponent, inject, PropType, nextTick } from "vue";

type Feature = {
  id: string;
  code: string;
  name: string;
  type?: string;
  parentId?: string | null;
  sortOrder?: number;
  permissions?: { id: string; code: string }[];
};

export default defineComponent({
  name: "RoleDetailPermissions",
  props: {
    formAction: { type: String, required: true },
    features: { type: Array as PropType<Feature[]>, default: () => [] },
    initialPermissionIds: {
      type: Array as PropType<string[]>,
      default: () => [],
    },
    isReadOnly: { type: Boolean, default: false },
  },
  setup() {
    const t = inject<
      (key: string, opts?: Record<string, string | number>) => string
    >("t", (k) => k);
    return { t };
  },
  data() {
    return {
      permissionIds: [...(this.initialPermissionIds || [])] as string[],
      selectedMenuGroupId: "" as string,
      expandedFeatureIds: [] as string[],
    };
  },
  computed: {
    menuGroups(): Feature[] {
      return (this.features || [])
        .filter((f) => f.type === "MENU_GROUP")
        .sort(
          (a, b) =>
            (a.sortOrder ?? 0) - (b.sortOrder ?? 0) ||
            String(a.code).localeCompare(String(b.code)),
        );
    },
    hasMenuGroups(): boolean {
      return this.menuGroups.length > 0;
    },
    featuresInSelectedGroup(): Feature[] {
      if (!this.selectedMenuGroupId) return [];
      return this.childFeaturesUnderGroup(this.selectedMenuGroupId);
    },
    visiblePermIdsInPanel(): string[] {
      const list = this.hasMenuGroups
        ? this.featuresInSelectedGroup
        : this.features;
      const ids: string[] = [];
      for (const f of list) {
        for (const p of f.permissions || []) ids.push(p.id);
      }
      return ids;
    },
    allPermsInPanelSelected(): boolean {
      const vis = this.visiblePermIdsInPanel;
      return (
        vis.length > 0 && vis.every((id) => this.permissionIds.includes(id))
      );
    },
    allModulesSelected(): boolean {
      if (this.hasMenuGroups) {
        const groups = this.menuGroups.filter(
          (g) => this.menuGroupPermIds(g).length > 0,
        );
        if (groups.length === 0) return false;
        return groups.every((g) => this.moduleCheckedMenuGroup(g));
      }
      const mods = this.features.filter((f) => this.featurePermIds(f).length > 0);
      if (mods.length === 0) return false;
      return mods.every((f) => this.moduleCheckedFeature(f));
    },
    someModulesSelected(): boolean {
      if (this.hasMenuGroups) {
        return this.menuGroups.some((g) => {
          const ids = this.menuGroupPermIds(g);
          if (ids.length === 0) return false;
          const hasSome = ids.some((id) => this.permissionIds.includes(id));
          const hasAll = ids.every((id) => this.permissionIds.includes(id));
          return hasSome && !hasAll;
        });
      }
      return this.features.some((f) => {
        const ids = this.featurePermIds(f);
        if (ids.length === 0) return false;
        return (
          ids.some((id) => this.permissionIds.includes(id)) &&
          !this.moduleCheckedFeature(f)
        );
      });
    },
    allLegacyPermsSelected(): boolean {
      const all = this.allLegacyPermissionIds;
      return (
        all.length > 0 && all.every((id) => this.permissionIds.includes(id))
      );
    },
    allLegacyModulesSelected(): boolean {
      const mods = this.features.filter((f) => this.featurePermIds(f).length > 0);
      if (mods.length === 0) return false;
      return mods.every((f) => this.moduleCheckedFeature(f));
    },
    allLegacyPermissionIds(): string[] {
      const ids: string[] = [];
      for (const f of this.features) {
        for (const p of f.permissions || []) ids.push(p.id);
      }
      return ids;
    },
  },
  watch: {
    permissionIds: {
      deep: true,
      handler() {
        void this.syncCheckboxIndeterminates();
      },
    },
    selectedMenuGroupId() {
      this.expandedFeatureIds = [];
      void this.syncCheckboxIndeterminates();
    },
    hasMenuGroups: {
      immediate: true,
      handler(v: boolean) {
        if (v && this.menuGroups.length && !this.selectedMenuGroupId) {
          this.selectedMenuGroupId = this.menuGroups[0].id;
        }
      },
    },
  },
  mounted() {
    void this.syncCheckboxIndeterminates();
  },
  methods: {
    featureExpanded(id: string): boolean {
      return this.expandedFeatureIds.includes(id);
    },
    toggleFeature(id: string) {
      const idx = this.expandedFeatureIds.indexOf(id);
      if (idx >= 0) this.expandedFeatureIds.splice(idx, 1);
      else this.expandedFeatureIds.push(id);
    },
    childFeaturesUnderGroup(groupId: string): Feature[] {
      if (!groupId) return [];
      return (this.features || [])
        .filter(
          (f) => f.parentId === groupId && f.type !== "MENU_GROUP",
        )
        .sort(
          (a, b) =>
            (a.sortOrder ?? 0) - (b.sortOrder ?? 0) ||
            String(a.code).localeCompare(String(b.code)),
        );
    },
    getChildrenByParent(): Map<string, Feature[]> {
      const m = new Map<string, Feature[]>();
      for (const f of this.features || []) {
        if (!f.parentId) continue;
        const arr = m.get(f.parentId) || [];
        arr.push(f);
        m.set(f.parentId, arr);
      }
      return m;
    },
    descendantsOfFeature(rootId: string): Feature[] {
      const m = this.getChildrenByParent();
      const out: Feature[] = [];
      const stack = [...(m.get(rootId) || [])];
      while (stack.length) {
        const f = stack.pop()!;
        out.push(f);
        for (const c of m.get(f.id) || []) stack.push(c);
      }
      return out;
    },
    menuGroupPermIds(g: Feature): string[] {
      const ids: string[] = [];
      for (const f of this.descendantsOfFeature(g.id)) {
        for (const p of f.permissions || []) ids.push(p.id);
      }
      return ids;
    },
    featurePermIds(f: Feature): string[] {
      return (f.permissions || []).map((p) => p.id);
    },
    allManagedMenuPermIds(): string[] {
      const s = new Set<string>();
      for (const g of this.menuGroups) {
        for (const id of this.menuGroupPermIds(g)) s.add(id);
      }
      return [...s];
    },
    moduleCheckedMenuGroup(g: Feature): boolean {
      const ids = this.menuGroupPermIds(g);
      return (
        ids.length > 0 && ids.every((id) => this.permissionIds.includes(id))
      );
    },
    moduleCheckedFeature(f: Feature): boolean {
      const ids = this.featurePermIds(f);
      return (
        ids.length > 0 && ids.every((id) => this.permissionIds.includes(id))
      );
    },
    togglePerm(id: string, on: boolean) {
      if (this.isReadOnly) return;
      if (on) {
        if (!this.permissionIds.includes(id)) this.permissionIds.push(id);
      } else {
        this.permissionIds = this.permissionIds.filter((x) => x !== id);
      }
    },
    onMenuGroupCheck(g: Feature, e: Event) {
      const on = (e.target as HTMLInputElement).checked;
      const ids = this.menuGroupPermIds(g);
      if (on) {
        this.permissionIds = [...new Set([...this.permissionIds, ...ids])];
      } else {
        this.permissionIds = this.permissionIds.filter((x) => !ids.includes(x));
      }
    },
    onSelectAllModules(e: Event) {
      if (this.isReadOnly) return;
      const on = (e.target as HTMLInputElement).checked;
      const managed = this.hasMenuGroups
        ? this.allManagedMenuPermIds()
        : this.allLegacyPermissionIds;
      const set = new Set(managed);
      if (on) {
        this.permissionIds = [...new Set([...this.permissionIds, ...managed])];
      } else {
        this.permissionIds = this.permissionIds.filter((id) => !set.has(id));
      }
    },
    onSelectAllPerms(e: Event) {
      if (this.isReadOnly) return;
      const on = (e.target as HTMLInputElement).checked;
      const vis = this.visiblePermIdsInPanel;
      const set = new Set(vis);
      if (on) {
        this.permissionIds = [...new Set([...this.permissionIds, ...vis])];
      } else {
        this.permissionIds = this.permissionIds.filter((id) => !set.has(id));
      }
    },
    onLegacySelectAllModules(e: Event) {
      this.onSelectAllModules(e);
    },
    onLegacySelectAllPerms(e: Event) {
      if (this.isReadOnly) return;
      const on = (e.target as HTMLInputElement).checked;
      const all = this.allLegacyPermissionIds;
      if (on) {
        this.permissionIds = [...all];
      } else {
        this.permissionIds = [];
      }
    },
    onLegacyModuleCheck(f: Feature, e: Event) {
      const on = (e.target as HTMLInputElement).checked;
      const ids = this.featurePermIds(f);
      if (on) {
        this.permissionIds = [...new Set([...this.permissionIds, ...ids])];
      } else {
        this.permissionIds = this.permissionIds.filter((x) => !ids.includes(x));
      }
    },
    async syncCheckboxIndeterminates() {
      await nextTick();
      const m = this.$refs.selectAllModulesEl as HTMLInputElement | undefined;
      if (m) {
        m.indeterminate = this.someModulesSelected && !this.allModulesSelected;
      }
      const p = this.$refs.selectAllPermsEl as HTMLInputElement | undefined;
      if (p && this.hasMenuGroups) {
        const vis = this.visiblePermIdsInPanel;
        const c = vis.filter((id) => this.permissionIds.includes(id)).length;
        p.indeterminate = c > 0 && c < vis.length;
      }
      const lm = this.$refs.legacySelectAllModulesEl as HTMLInputElement | undefined;
      if (lm && !this.hasMenuGroups) {
        lm.indeterminate =
          this.someModulesSelected && !this.allLegacyModulesSelected;
      }
      const lp = this.$refs.legacySelectAllPermsEl as HTMLInputElement | undefined;
      if (lp && !this.hasMenuGroups) {
        const all = this.allLegacyPermissionIds;
        const c = all.filter((id) => this.permissionIds.includes(id)).length;
        lp.indeterminate = c > 0 && c < all.length;
      }
    },
    submitPermissions() {
      if (this.isReadOnly) return;
      const form = document.createElement("form");
      form.method = "POST";
      form.action = this.formAction;
      this.permissionIds.forEach((id) => {
        const input = document.createElement("input");
        input.type = "hidden";
        input.name = "permissionIds";
        input.value = id;
        form.appendChild(input);
      });
      document.body.appendChild(form);
      form.submit();
    },
  },
});
</script>
