# irwin-cli

Scaffold Irwin apps and add feature packs. Generators delegate to **local `ts-rails`** (`irwin g`).

## Monorepo usage (VIZ Framework)

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
| `irwin new <name>` | Minimal HTTP app — install deps + start `dev` |
| `irwin add <feature>` | Enable feature pack (`api`, …) |
| `irwin g <type> <name>` | Wrapper → `node node_modules/ts-rails/dist/cli.js` |
| `irwin list` | Available / enabled features |

### `irwin new` options

- `-pm, --package-manager <pnpm|npm|yarn>` — default: `pnpm`, or infer from `npm_config_user_agent`
- After scaffold: verifies PM is on PATH → `install` → `dev` (blocks until Ctrl+C)
- `--skip-install` — scaffold only; print manual steps
- `--skip-dev` — install dependencies but do not start the server
- `--skip-db` — remove Prisma files
- `--api-only` — JSON home route, no Pug views
- `--ts-rails-version` — semver when publishing (monorepo template uses `file:../irwin-rails`)

### `irwin add` options

- `--dry-run` — preview copies and patches
- `--force` — overwrite existing files

## Feature packs

| Feature | Status |
|---------|--------|
| `api` | `/api/health` + readiness helper |
| `auth`, `admin`, … | Planned — extract from `irwin-framework` |

## Project markers

Base template includes patch markers:

- `// @irwin:routes-imports`
- `// @irwin:routes-draw`
- `// @irwin:initializers`

Registry: `.irwin/features.json`

See [PLAN.md](./PLAN.md) for full roadmap.
