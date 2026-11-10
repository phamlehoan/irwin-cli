# irwin-cli

CLI to **scaffold** Irwin apps (Express + TypeScript, Rails-like structure) and optionally add **feature packs**.

This tool exists so a person can start a project quickly. It is not the product. A generated app should only contain the packs that project actually uses — never add a pack "just in case". Bugs that belong in the runtime (`ts-rails`) are fixed there; unused packs are simply not installed.

Runtime and code generators live in the npm package **[ts-rails](https://www.npmjs.com/package/ts-rails)**. Each app installs its own `ts-rails`; `irwin g` always delegates to that local copy.

**Requires:** Node.js **≥ 20**

---

## Installation

### Global (recommended)

Install once, use `irwin` from any directory:

```bash
npm install -g irwin-cli

irwin --version
```

### One-off (no global install)

```bash
npm create irwin@latest my-app
# equivalent to: npx irwin new my-app
```

---

## Quick start

Create a new app (scaffold → install deps → start dev server):

```bash
irwin new my-app            # a path works too: irwin new services/inv --name @org/inv
                            # --no-start: skip the dev server; --with-home: feature-store home page
cd my-app
```

The dev server runs automatically after scaffold. Press **Ctrl+C** to stop.

Install only, without starting the server:

```bash
irwin new my-app --skip-dev
```

Scaffold only (print manual steps):

```bash
irwin new my-app --skip-install
```

Add features inside the project:

```bash
cd my-app
irwin add database
irwin add api
irwin add swagger
irwin add auth-api    # JWT API (SPA / mobile)
# — or web UI:
irwin add hash       # shared bcrypt hasher (session and auth-api require it)
irwin add session
irwin add auth
pnpm db:push && pnpm db:seed
pnpm dev
```

---

## Commands


| Command                  | Description                                                      |
| ------------------------ | ---------------------------------------------------------------- |
| `irwin new <name>`       | Create minimal HTTP app (Pug layout, Express, `ts-rails`)        |
| `irwin add <feature>`    | Enable a feature pack (`api`, `auth`, …)                         |
| `irwin g <type> <name>`  | Run local `ts-rails` generators (`scaffold`, `resource`, …)      |
| `irwin list`             | Show available / enabled features                                |
| `irwin doctor`           | Check deps, env, registry, `ts-rails` version                    |
| `irwin remove <feature>` | Revert patches and copied files (`--keep-files` = registry only) |
| `irwin upgrade`          | Bump `ts-rails` in `package.json` and `.irwin/features.json`     |


### `irwin new` options


| Option                                   | Description                                                  |
| ---------------------------------------- | ------------------------------------------------------------ |
| `-pm, --package-manager <pnpm|npm|yarn>` | Default: `pnpm`, or infer from environment                   |
| `--skip-install`                         | Scaffold only                                                |
| `--skip-dev`                             | Install dependencies but do not start `dev`                  |
| `--api-only`                             | JSON home route, no Pug views                                |
| `--ts-rails-version <semver>`            | Override default `ts-rails` pin (default: `^1.1.3` from npm) |


No database is included in `new` — run `irwin add database` when you need Prisma.

### `irwin add` options


| Option           | Description                                              |
| ---------------- | -------------------------------------------------------- |
| `--dry-run`      | Preview copies and patches                               |
| `--force`        | Overwrite existing files                                 |
| `--skip-install` | Do not install npm deps or run post-install scripts      |

`irwin g` forwards `--api`, `--force`, `--skip`, and `--dry-run` to the local `ts-rails` generator (which never overwrites existing files unless `--force`).


---

## How this fits Irwin (read this before adding packs)

- `irwin new` creates a **minimal** HTTP app. Database, auth, admin, jobs, AI, serverless, … are **opt-in**.
- `irwin add <pack>` copies that pack into the app. If the product does not need it, do not add it. Do not copy every folder under `features/` into IrwinERP or any customer app.
- Packs that look unused in the ERP (`serverless`, `netlify`, `turso`, `vue`, `ai`, …) stay in this CLI so other Irwin apps can still `irwin add` them. Their presence here is not a requirement to ship them.
- If a pack (or the runtime it relies on) is actually broken, **patch it** in `irwin-cli` / `irwin-rails` / the template. Do not delete a pack because the current customer does not use it.
- The `ai` pack is Gemini chat (`POST /api/v1/ai/chat`). The SQL assistant lives in the sample app (`irwin-framework_ts-on-rails`); it is kept, hardened (tokenizer SQL guard), and remains optional.

## Feature packs


| Feature              | Description                                                              |
| -------------------- | ------------------------------------------------------------------------ |
| `api`                | `/api/health` + readiness helper                                         |
| `database`           | Prisma SQLite + User/Password + seed                                     |
| `hash`               | bcrypt hasher, single source of `initializeHash`                         |
| `session`            | express-session + flash (`requires`: hash)                               |
| `auth`               | Web login, register, profile, i18n en/vi (`requires`: database, session) |
| `auth-api`           | JWT REST auth `/api/v1/auth/*` (`requires`: database, api, swagger, hash) |
| `admin`              | Dashboard + user CRUD (`requires`: auth)                                 |
| `admin-rbac`         | Feature RBAC, roles/features admin UI (`requires`: admin, vue)             |
| `admin-rbac-api`     | RBAC REST `/api/v1/admin/*` — no UI (`requires`: auth-api)                 |
| `auth-oauth`         | Google OAuth web login (`requires`: auth)                                |
| `mailer`             | Nodemailer adapters + `ApplicationMailer`                                |
| `notifications`      | In-app alerts: DB + SSE + `/notifications` (`requires`: database, auth)  |
| `notifications-push` | FCM push helper (`requires`: notifications)                              |
| `swagger`            | OpenAPI UI at `/docs` (development)                                      |
| `dev-tools`          | Dev playground at `/dev` (development)                                   |
| `storage`            | Local image upload → `public/uploads`                                    |
| `storage-cloud`      | Cloudinary + Supabase (`requires`: storage)                              |
| `jobs`               | Job runtime (queue, cron, workers)                                       |
| `socket`             | Socket.IO + floating chat demo                                           |
| `vue`                | Vite bundle + `/vue-demo`                                                |
| `turso`              | libSQL adapter + `db:deploy:turso` (`requires`: database)                |
| `netlify`            | `netlify.toml` + serverless function                                     |
| `serverless`         | `serverless.yml` + `lambda.ts` handler                                   |
| `ai`                 | Google Gemini chat API (`requires`: api)                                 |


When `jobs` is installed together with `admin-rbac`, the admin UI includes `/admin/jobs`.

`admin-rbac` and `admin-rbac-api` share **admin-rbac-stack** (middleware, permissions, seed) — install in any order without overwriting each other. Same pattern as `auth` + `auth-api`.

---

## Local development (monorepo)

When working inside an Irwin monorepo:

```bash
cd irwin-cli
npm install
npm run build

# from repo root
node irwin-cli/dist/cli.js new my-app -pm pnpm
node irwin-cli/dist/cli.js new my-app -pm npm --skip-dev
```

---

## Project markers

The base template uses patch markers for feature packs:

- `// @irwin:routes-imports`
- `// @irwin:routes-draw`
- `// @irwin:initializers`

Installed features are tracked in `.irwin/features.json`.

---

## Tests

```bash
cd irwin-cli
npm test
npm run test:e2e   # new → database → session → auth → doctor → g scaffold
```

---

## Docs

- [PLAN.md](./PLAN.md) — roadmap and architecture
- [docs/PLUGIN.md](./docs/PLUGIN.md) — authoring feature packs
- [docs/PUBLISH.md](./docs/PUBLISH.md) — publish to npm (2FA, tokens)

## License

MIT