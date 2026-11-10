# Changelog

## Unreleased (0.1.0)

v1.2 of `irwin-cli`: bug-fix release. The CLI remains a **scaffolder** — packs are opt-in; unused packs are not added to a product app.

- Manifests are validated; a broken pack no longer hides the others (`irwin list`) (IRW-FIX-030).
- `features/serverless/files/lambda.ts` compiles (IRW-FIX-031).
- Version compares use semver, not string order (IRW-FIX-032).
- Patch engine is idempotent (LF matching, EOL preserved, content already present counts as present); two-phase preflight so a missing marker writes nothing (IRW-FIX-034, 035).
- `remove` deletes only unmodified created files, restores overwritten originals by checksum, reverses inserted blocks; shared files stay (IRW-FIX-036).
- `--skip-install` also skips `postInstall.scripts` (IRW-FIX-037).
- `.env` < `.env.local`; jobs detection ignores comments (IRW-FIX-038).
- Project root order: `--cwd` > cwd > `INIT_CWD` (warn) (IRW-FIX-040).
- `doctor` is read-only unless `--fix` (IRW-FIX-044 partial).
- Template gitignore is published as `_gitignore` (IRW-FIX-046).
- `irwin g` forwards `--force` / `--skip` / `--dry-run` to local `ts-rails`.

### Completed in the second pass (all backward compatible)

- **IRW-FIX-033 (T-033)** New pack `hash` is the single source of `initializeHash`. `session` (1.1.0) and `auth-api` (1.1.0) now `requires` it; they no longer define/export/call it themselves, so `lib/index.ts`-style duplicate `export *` and a double call cannot happen in any install order. Apps installed before keep working (`doctor` warns, not fails, about the new requirement).
- **IRW-FIX-039 (T-039)** The "feature store" home page is off by default: `irwin new` writes a plain home page and no `lib/irwin/homeFeatures.ts` / catalog. `irwin new --with-home` opts in (`withHome: true` in the registry). Apps that already have `homeFeatures.ts` keep it in sync as before. `add`/`remove`/`doctor` only touch the catalog when the store is enabled.
- **IRW-FIX-041 (T-041)** `irwin new <dir> [--name @scope/pkg] [--no-start]`: `<dir>` may be a path, the package name is separate and may be scoped. The dev server is not started when the app is inside a workspace.
- **IRW-FIX-042 (T-042)** Workspace aware: inside a pnpm workspace, install runs from the workspace root as `pnpm install --filter <pkg>...` (only the target package and its dependencies); under `CI` `--no-frozen-lockfile` is added so the install the CLI itself caused cannot fail on the lockfile; `pnpm.overrides` (vue pin and pack overrides) are written to the workspace `pnpm-workspace.yaml` (a package-level override is ignored by pnpm). npm workspaces use `npm install --workspace`.
- **IRW-FIX-043 (T-043)** `process.cwd()` removed from generated code: `locale-fallback`, the `auth` i18n plugin use `rootPath()`; `migrateTurso` resolves the project root from its own location.
- **IRW-FIX-044 (T-044) completed** `doctor` finds `ts-rails`/`tsx` through `require.resolve` and ancestor `node_modules` (hoisted workspaces); `@irwin/*` plugins are discovered through symlinks and ancestors; it verifies every block and file each pack recorded (not just two markers); still read-only without `--fix`.
- **IRW-FIX-045 (T-045)** Registry v2: `schemaVersion`, structural validation with readable errors (legacy v1 files without `schemaVersion` are read as before and upgraded on the next write), atomic write (temp file + rename), exclusive project lock for `add`/`remove` (a second concurrent command fails with a clear message; stale locks from dead processes are recovered), overwritten originals stored in `.irwin/backups/<pack>/` instead of base64 inside `features.json` (legacy base64 still restores), added npm entries recorded (`addedDeps`). Pack-specific `manifest.id` checks moved into the manifest (`stackSync`, `postInstall.createEnvFile`); duplicated `walkAllFiles`/`copyTree` merged into `utils/fs.ts`. Manifests keep the existing hand-written validator (no `zod` dependency added).
- **IRW-FIX-047 (T-047)** Secure defaults in pack code: no `JWT_SECRET` fallback to `SESSION_SECRET` or to a public string (read lazily, fails closed); no public `SESSION_SECRET` default (`irwin new`/`irwin add session|auth-api` generate a random value into `.env`, `postInstall.generateSecrets`); CORS in `auth-api` is an allow-list from `CORS_ORIGIN`/`CLIENT_APP_URL` (empty = no cross-origin) instead of `origin: true` + credentials; refresh tokens are stored as SHA-256 hashes, several devices may be signed in (only tokens older than 7 days are pruned), old raw tokens still refresh once and are replaced; no seeded `admin@...`/`password123`: `db:seed` needs `SEED_ADMIN_EMAIL` + `SEED_ADMIN_PASSWORD` (password generated into `.env` on `irwin add database`) and never prints the password; `ai` now `requires` `auth-api`.
- Cleaned legacy-project traces from README, PLAN.md, `scripts/e2e-smoke.mjs` and the `admin-rbac` role controller/view (neutral names).
- Package version 0.0.4 -> 0.1.0.

### Upgrading from 0.0.x

- Safe to upgrade in place; existing `.irwin/features.json` files are read as is.
- `irwin add session` / `irwin add auth-api` now ask for `irwin add hash` first. Projects that already have `session`/`auth-api` do nothing.
- Existing projects that still have the old `JWT_SECRET`/`SESSION_SECRET` placeholders in `.env` should replace them with random values.
- Will become default in 2.0: nothing here is opt-in except `--with-home` (the inverse of the old behavior, deliberately).

### Known limitations (deferred to 2.0)

- Hash/secret/seed/refresh-token logic still lives as copied pack code. The single maintained implementation is `@irwin/auth` + `@irwin/config` + `irwin admin:bootstrap` (IRW-FEAT-013, 007, 028); until then these packs are patched, not replaced. Risk left: apps that already copied the old pack code must apply the fix by re-running `irwin add <pack> --force` and reviewing the diff.
- `irwin new` at the workspace level (`irwin init`, `--filter`, `-r`, catalog:/workspace:* versions, shared `tsconfig.base`) needs the workspace commands of 2.0; 1.x only detects an enclosing workspace.
- Registry per package (`.irwin/workspace.json`, `doctor --all`) is not implemented in 1.x.
- Refresh-token rotation detection (reuse of a rotated token revokes the family) and per-device listing need the `@irwin/auth` data model.
- `loadDotenv` still lets a `.env` in the process cwd override the project `.env`; changing it would alter behaviour of running apps.
