# irwin-cli

Scaffold Irwin apps and add feature packs. Generators delegate to **local `ts-rails`** (`irwin g`).

## Create app (npm)

```bash
npm create irwin@latest my-app
# same CLI binary as: npx irwin new my-app (package exposes both `irwin` and `create-irwin` bins)
```

## Local development (VIZ Framework)

```bash
cd irwin-cli
npm install
npm run build

# Create app (auto: check PM → install → dev)
cd ..
node irwin-cli/dist/cli.js new my-app --package-manager pnpm
# or: -pm npm | -pm yarn

# Skip auto dev (install only):
node irwin-cli/dist/cli.js new my-app -pm npm --skip-dev
```

## Commands

| Command | Description |
|---------|-------------|
| `irwin new <name>` | Minimal HTTP app + main layout shell — install deps + start `dev` |
| `irwin add <feature>` | Enable feature pack (`api`, …) |
| `irwin g <type> <name>` | Wrapper → `node node_modules/ts-rails/dist/cli.js` |
| `irwin list` | Available / enabled features |
| `irwin doctor` | Check project setup (deps, env, markers) |
| `irwin remove <feature>` | Revert patches, delete copied files, update registry (`--keep-files` = registry only) |
| `irwin upgrade` | Bump `ts-rails` in package.json + registry |

### `irwin new` options

- `-pm, --package-manager <pnpm|npm|yarn>` — default: `pnpm`, or infer from `npm_config_user_agent`
- After scaffold: verifies PM is on PATH → `install` → `dev` (blocks until Ctrl+C)
- `--skip-install` — scaffold only; print manual steps
- `--skip-dev` — install dependencies but do not start the server
- `--api-only` — JSON home route, no Pug views
- No database in `new` — run `irwin add database` when you need Prisma
- `--ts-rails-version` — semver when publishing (monorepo template uses `file:../irwin-rails`)

### `irwin add` options

- `--dry-run` — preview copies and patches
- `--force` — overwrite existing files

## Feature packs

| Feature | Status |
|---------|--------|
| `api` | `/api/health` + readiness helper |
| `database` | Prisma SQLite + User/Password + seed |
| `session` | express-session + flash + bcrypt |
| `auth` | Login, register, profile, i18n en/vi + locale switcher (`requires`: database, session) |
| `admin` | Dashboard + user CRUD (`requires`: auth) |
| `admin-rbac` | Feature RBAC (AM/USM/RAP), route guards, roles/features admin (`requires`: admin) |
| `auth-oauth` | Google OAuth web login (`requires`: auth) |
| `mailer` | Nodemailer adapters + `ApplicationMailer` (test log / SMTP) |
| `notifications` | In-app alerts: DB + SSE + `/notifications` (`requires`: database, auth) |
| `notifications-push` | FCM push helper (`requires`: notifications) |
| `swagger` | OpenAPI UI at `/docs` (development) |
| `dev-tools` | Dev playground at `/dev` (development) |
| `storage` | Local image upload → `public/uploads` |
| `storage-cloud` | Cloudinary + Supabase adapters (`requires`: storage) |
| `jobs` | node-cron + BullMQ (Redis) |
| `socket` | Socket.IO + floating chat demo on main layout |
| `vue` | Vite bundle + `/vue-demo` |
| `turso` | libSQL adapter + `db:deploy:turso` (`requires`: database) |
| `netlify` | `netlify.toml` + serverless function |
| `serverless` | `serverless.yml` + `lambda.ts` handler |
| `ai` | Google Gemini chat API (`requires`: api) |

```bash
pnpm exec irwin add database
pnpm exec irwin add session
pnpm exec irwin add auth   # includes en/vi i18n + header locale switcher
pnpm exec irwin add admin
pnpm exec irwin add mailer
pnpm exec irwin add notifications
pnpm db:push && pnpm db:seed
```

### CI / E2E

```bash
cd irwin-cli
npm test
npm run test:e2e   # new → database → session → auth → doctor → g scaffold
```

## Project markers

Base template includes patch markers:

- `// @irwin:routes-imports`
- `// @irwin:routes-draw`
- `// @irwin:initializers`

Registry: `.irwin/features.json`

See [PLAN.md](./PLAN.md) for full roadmap. Feature plugins: [docs/PLUGIN.md](./docs/PLUGIN.md).

## Release

Publish from this repo only — see [docs/PUBLISH.md](./docs/PUBLISH.md) (npm 2FA, tokens, `npm publish`).
