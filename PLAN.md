# Irwin CLI — Kế hoạch triển khai

Tài liệu này mô tả repo **`irwin-cli`** (package `@irwin/cli` hoặc `create-irwin`) — lớp **scaffold dự án + feature packs**, tách khỏi **`ts-rails`** (runtime + generator trong app).

**Nguyên tắc:** `ts-rails` chỉ chạy **local** trong project (`node_modules`). `irwin` CLI có thể cài global cho `new`, nhưng mọi lệnh trong app dùng `pnpm exec irwin` / script và luôn delegate `g` sang `ts-rails` local.

---

## 1. Phân tách trách nhiệm

| Thành phần | Trách nhiệm | Không làm |
|------------|-------------|-----------|
| **ts-rails** | `RailsApplication`, routing, controller/job/mailer/channel base, `rails g:*`, `routes`, `console` | `new project`, copy template Irwin, `add auth`, patch toàn repo |
| **irwin-cli** | `irwin new`, `irwin add <feature>`, manifest, registry, wrapper `irwin g` | Implement lại toàn bộ logic `g scaffold` (delegate) |
| **irwin-framework** | Reference app “full features”; nguồn extract feature packs | Không phải output mặc định của `irwin new` |

---

## 2. Danh mục feature pack (inventory `irwin-framework`)

Phân tích repo **`irwin-framework`** hiện tại (monolith). Khi tách CLI, mỗi dòng dưới đây tương ứng một (hoặc gộp) lệnh **`irwin add <id>`**.  
**Mục tiêu sản phẩm:** `irwin new` chỉ còn **HTTP request/response cơ bản** (giống `rails new`), không socket, job, mailer, auth, admin, v.v.

### 2.1 Tổng số lệnh `irwin add` (ước lượng)

| Cách đếm | Số lượng |
|----------|-----------|
| Tách đủ nhỏ (mọi khối trong bảng §2.2) | **~20** pack |
| Gộp hợp lý (khuyến nghị cho CLI) | **~15** lệnh `add` |
| Chỉ trong `irwin new` (`core` + tuỳ chọn DB/Pug) | **1** lệnh `new` |

### 2.2 Bảng thành phần → `irwin add` đề xuất

| `irwin add …` | Trạng thái trong framework | Ghi chú / gộp |
|---------------|----------------------------|----------------|
| *(built-in)* **`core`** | `ts-rails`, Express, `configs/application`, `HomeController`, `/` | **`irwin new`** — chỉ HTTP |
| `database` | Prisma, migrations, `app/models`, seed scripts | Có thể **gộp vào `new`** (như Rails có Active Record) |
| `i18n` | `configs/plugins/i18n`, `configs/locales/*` | |
| `session` | `express-session`, `express-flash`, `initializeSession` | Web; API path stateless bỏ qua session |
| `auth` | `/auth`, `app/services/auth/*`, validators, views, JWT | Gộp: `/users` đăng ký, `/me`, Google OAuth |
| `api` | `/api`, `/api/v1`, health, `ApiResponse` | Lớp JSON API |
| `admin` | `/admin`, users/roles/features, permission middleware | **`requires: ["auth"]`** |
| `vue` | Vite, Vue islands trong admin (`bundle.js`) | Thường sau `admin` |
| `notifications` | Web + API, SSE, FCM (`firebase-admin`), `AppNotification` | |
| `ai` | `/api/v1/ai`, `lib/ai/*`, Gemini | |
| `mailer` | Mailer init, SMTP/Gmail adapters, `user.mailer` | Framework **đang** `initializeMailer()` |
| `jobs` | `app/jobs/*`, BullMQ, `node-cron`, `initializers/jobs` | Code có; **`initializeJobs()` đang comment** |
| `socket` | `socket.io`, `app/channels/*` | **`channelClasses` đang đăng ký** trong `application.ts` |
| `storage` | Cloudinary / Supabase upload, `multer`, `jimp` | |
| `swagger` | Swagger UI — chỉ `development` | |
| `cache` | `node-cache`, `initializeCache` | Có thể gộp vào `core` |
| `observability` | Pino, request id, request logging, rate limit | Có thể gộp vào `core` |
| `turso` | LibSQL adapter, `db:deploy:turso` | |
| `netlify` | `netlify/functions`, build scripts | Deploy |
| `serverless` | `serverless-http`, `serverless-offline` | Deploy |
| `dev-tools` | `/dev`, `/api/.../dev` khi `development` | |

### 2.3 `irwin new` — phạm vi giống Ruby on Rails

**Nguyên tắc:** Giống `rails new`: app chạy được, **một luồng HTTP đơn giản**, không Action Cable / Sidekiq / Devise sẵn.

#### Có trong `templates/base` (`irwin new`)

| Thành phần | Mục đích |
|------------|----------|
| `ts-rails` + Express | Request / response |
| `express.json`, `urlencoded`, `cookie-parser`, `method-override` | REST + form HTML cơ bản |
| `configs/application.ts` tối giản | **Không** `channelClasses`, **không** `initializeMailer`, **không** `initializeJobs` |
| `configs/routes/index.ts` + marker `@irwin:*` | Chỉ `HomeController` / health |
| `app/controllers/application.controller.ts`, `home.controller.ts` | |
| `configs/env`, `configs/loadDotenv` | |
| Logger tối thiểu (pino) — hoặc gộp `observability` vào core | |
| `.irwin/features.json` | Registry feature đã bật |

#### Tuỳ chọn qua flag `irwin new` (phase 1+)

| Flag | Nội dung |
|------|----------|
| `--database` / mặc định bật | Prisma + SQLite, schema trống hoặc không model |
| `--skip-db` | Không Prisma (API thuần) |
| `--api-only` | Không Pug; chỉ JSON + optional health |
| `--with-pug` | Layout main tối giản + 1 view (mặc định có thể bật) |

#### Không có trong `new` — chỉ qua `irwin add`

| Nhóm | Lệnh add |
|------|----------|
| Realtime | `socket` |
| Background | `jobs` |
| Email | `mailer` |
| Identity | `session`, `auth` |
| Admin / RBAC | `admin` |
| API đầy đủ | `api` (+ route con theo feature) |
| Push / SSE | `notifications` |
| AI | `ai` |
| SPA admin | `vue` |
| Upload | `storage` |
| Dev docs | `swagger` |
| i18n đầy đủ | `i18n` |
| Deploy | `turso`, `netlify`, `serverless` |
| Tiện ích dev | `dev-tools` |

#### So sánh nhanh với `irwin-framework` hiện tại

| Framework (full) | `irwin new` (đề xuất) |
|------------------|------------------------|
| Routes: auth, admin, api, notifications, users, dev | Chỉ `/` (home) |
| `RailsApplication.channelClasses = channels` | Không import channels |
| `initializeMailer()` | Không |
| `initializeJobs()` (đã comment) | Không |
| Vue vendor + admin components | Không |
| Prisma đầy đủ User/Role/Feature/… | Trống hoặc `--skip-db` |

### 2.4 Thứ tự `irwin add` gợi ý (DX)

```text
irwin new my-app
pnpm install && pnpm dev                    # GET / hoạt động

# Tuỳ product — thứ tự phụ thuộc requires[]
irwin add database                          # nếu new dùng --skip-db
irwin add i18n
irwin add session
irwin add auth
irwin add api
irwin add admin                             # requires auth
irwin add vue                               # nếu admin dùng Vue islands
irwin add mailer
irwin add notifications
irwin add ai
irwin add storage
irwin add swagger
irwin add socket
irwin add jobs
irwin add turso                             # deploy DB
irwin add netlify | serverless              # deploy target
```

### 2.5 Cấu trúc thư mục `features/` (cập nhật)

```text
features/
├── auth/
├── admin/          # requires: ["auth"]
├── session/        # hoặc gộp vào auth
├── api/
├── i18n/
├── vue/
├── notifications/
├── ai/
├── mailer/
├── jobs/
├── socket/
├── storage/
├── swagger/
├── turso/
├── netlify/
├── serverless/
└── dev-tools/
```

`templates/base/` = chỉ phần §2.3, **không** copy từ `irwin-framework` nguyên repo.

---

## 3. Cấu trúc repo đề xuất

```text
irwin-cli/
├── package.json              # bin: irwin, create-irwin
├── tsconfig.json
├── src/
│   ├── cli.ts                # commander entry
│   ├── commands/
│   │   ├── new.ts
│   │   ├── add.ts
│   │   └── generate.ts       # wrapper → ts-rails
│   ├── core/
│   │   ├── projectRoot.ts    # tìm root (app/controllers + .irwin/)
│   │   ├── registry.ts       # đọc/ghi .irwin/features.json
│   │   ├── manifest.ts       # load & validate manifest
│   │   ├── applyFeature.ts   # copy + patch + deps
│   │   ├── patchEngine.ts    # insert import, append block (có marker)
│   │   └── spawnTsRails.ts   # resolve local ts-rails cli
│   └── utils/
│       ├── fs.ts
│       └── logger.ts
├── templates/
│   └── base/                 # skeleton irwin new (tối giản)
│       ├── package.json.hbs
│       ├── index.ts
│       ├── configs/
│       ├── app/
│       ├── prisma hoặc configs/db/
│       └── .irwin/
│           └── features.json   # { "features": [], "tsRailsVersion": "1.0.11" }
├── features/
│   ├── auth/
│   │   ├── manifest.json
│   │   ├── files/              # cây file copy vào project
│   │   └── patches/            # ops theo path trong project
│   └── admin/
│       ├── manifest.json       # "requires": ["auth"]
│       └── ...
└── PLAN.md                     # file này
```

**Monorepo VIZ Framework (tuỳ chọn):**

```text
VIZ Framework/
├── irwin-rails/      # ts-rails publish
├── irwin-framework/  # reference
└── irwin-cli/        # CLI mới
```

---

## 4. CLI — đặc tả lệnh

### 4.1 `irwin new <app-name> [options]`

**Mục tiêu:** Tạo thư mục project mới với skeleton tối thiểu, chạy được `pnpm install && pnpm dev`.

**Options (phase sau):**

- `--package-manager pnpm|npm|yarn` (mặc định pnpm)
- `--ts-rails-version 1.0.11` (mặc định = version pin trong irwin-cli)
- `--database sqlite|postgres` (mặc định sqlite)
- `--skip-install`

**Luồng:**

1. Validate tên thư mục (không tồn tại / hợp lệ npm name).
2. Copy `templates/base/**` → `<app-name>/` (render template vars: `appName`, `tsRailsVersion`).
3. Ghi `.irwin/features.json`: `{ "version": 1, "features": [], "tsRails": "1.0.11" }`.
4. `package.json`: dependency `ts-rails@^1.0.11` (hoặc exact pin), scripts:
   - `"dev": "nodemon ... tsx index.ts"`
   - `"irwin": "irwin"` hoặc delegate `pnpm exec irwin`
   - `"g": "irwin g"` (tiện cho dev)
5. Chạy `pnpm install` (nếu không `--skip-install`).
6. In next steps: `cd app && pnpm dev`, `irwin add auth`, `irwin g scaffold Product`.

**Skeleton base:** theo **§2.3** (không trùng `irwin-framework` full). Chi tiết file:

- `index.ts`, `configs/application.ts` (không socket/mailer/jobs init)
- `configs/routes/index.ts` + markers `@irwin:routes-*`, `@irwin:initializers`
- `app/controllers/application.controller.ts`, `home.controller.ts`
- `configs/loadDotenv.ts`, `configs/env/`
- Prisma: tuỳ `--database` / `--skip-db` (mặc định sqlite schema tối thiểu, không User/Role)
- **Không** route auth/admin/api/notifications/vue (chỉ `irwin add`)

---

### 4.2 `irwin add <feature> [options]`

**Mục tiêu:** Bật module tính năng đã đóng gói; idempotent (đã add → báo + exit 0 hoặc warn).

**Options:**

- `--dry-run` — in diff, không ghi file
- `--force` — ghi đè file đã tồn tại (nguy hiểm, phase 2)

**Luồng:**

1. `projectRoot = resolveIrwinRoot()` (cần `app/controllers` + `.irwin/features.json`).
2. Load manifest `features/<feature>/manifest.json`.
3. Validate:
   - `requires[]` đã có trong registry (vd. `admin` cần `auth`).
   - Feature chưa enabled (trừ `--force`).
4. **Copy** `features/<feature>/files/**` → project (giữ relative path).
5. **Apply patches** (xem §5).
6. Merge **npm dependencies** từ manifest vào `package.json` (semver ranges).
7. Ghi registry: `features.push(feature)`.
8. Post-hooks (in hướng dẫn, không auto trừ khi flag):
   - `pnpm db:migrate` nếu có prisma migration trong feature
   - `pnpm db:seed` nếu manifest khai báo
9. Summary: file created, patches applied, manual steps.

**Feature phase 1 (MVP):** xem §2.2 — ưu tiên `session` → `auth` → `api` → `admin`.

| Feature | requires | MVP |
|---------|----------|-----|
| `session` | `[]` | (hoặc gộp vào `auth`) |
| `auth` | `[]` hoặc `["session"]` | login, services, validators, web routes |
| `api` | `[]` | `/api` shell + health |
| `admin` | `["auth"]` | RBAC, users/roles/features |

**Feature phase 2:** `i18n`, `vue`, `notifications`, `mailer`, `swagger`, `storage`, `dev-tools`.

**Feature phase 3:** `ai`, `socket`, `jobs`, `turso`, `netlify`, `serverless`.

Danh sách đầy đủ: **§2.2**, thứ tự gợi ý: **§2.4**.

---

### 4.3 `irwin g <type> <name> [fields...]` (alias generator)

**Mục tiêu:** Wrapper 100% local `ts-rails`.

**Luồng:**

1. `root = resolveIrwinRoot()`.
2. `cli = resolveTsRailsCli(root)`:
   - `require.resolve('ts-rails/package.json')` từ `root`
   - spawn `node <path>/dist/cli.js` với `cwd: root`, `shell: false`
   - **Không** gọi global `rails`
3. Forward argv: `g`, type, name, fields, `--api` nếu có.
4. Exit code từ child.

**Lỗi rõ ràng:**

- Chưa `pnpm install` / thiếu `ts-rails` → hướng dẫn cài dependency.
- Version ts-rails < min supported → warn (đọc từ `.irwin/features.json`).

**Mapping type:** Giữ nguyên ts-rails: `scaffold`, `resource`, `controller`, `service`, `mailer`, `job`, `channel`, `test`.

---

### 4.4 Lệnh bổ sung (phase 2+)

| Lệnh | Mục đích |
|------|----------|
| `irwin list` | Features available vs enabled |
| `irwin doctor` | Kiểm tra ts-rails local, tsx, prisma, cấu trúc |
| `irwin remove <feature>` | Gỡ feature (khó — phase 3) |
| `irwin upgrade` | Bump ts-rails + codemod nhẹ |

---

## 5. Feature manifest schema

**File:** `features/<id>/manifest.json`

```json
{
  "id": "auth",
  "version": "1.0.0",
  "description": "Session auth, login, password reset",
  "requires": [],
  "npm": {
    "dependencies": {
      "bcrypt": "^5.1.1",
      "jsonwebtoken": "^9.0.3"
    },
    "devDependencies": {}
  },
  "files": {
    "from": "files",
    "exclude": []
  },
  "patches": [
    {
      "file": "configs/routes/index.ts",
      "ops": [
        {
          "type": "insertAfter",
          "marker": "// @irwin:routes-imports",
          "content": "import { AuthRoute } from \"./auth.route\";\n"
        },
        {
          "type": "insertAfter",
          "marker": "// @irwin:routes-draw",
          "content": "    this.path(\"/auth\", AuthRoute.draw());\n"
        }
      ]
    },
    {
      "file": "configs/application.ts",
      "ops": [
        {
          "type": "insertAfter",
          "marker": "// @irwin:initializers",
          "content": "    // auth: no extra initializer\n"
        }
      ]
    }
  ],
  "prisma": {
    "migrations": ["features/auth/prisma/migrations/..."],
    "seeders": ["features/auth/prisma/seeders/..."]
  },
  "postInstall": {
    "messages": [
      "Run: pnpm db:migrate",
      "Copy .env.example keys: SESSION_SECRET, ..."
    ]
  }
}
```

**Quy ước marker trong template base:**

- Template `irwin new` **phải** chứa comment markers cố định để `add` patch an toàn:
  - `// @irwin:routes-imports`
  - `// @irwin:routes-draw`
  - `// @irwin:initializers`
  - `// @irwin:channels` — chỉ khi đã `irwin add socket`
  - `// @irwin:jobs` — chỉ khi đã `irwin add jobs`
  - (mở rộng: mailer, api-mount, …)

**Patch ops (MVP):**

- `insertAfter` / `insertBefore` (theo marker)
- `append` (cuối file)
- `replace` (chỉ khi có marker block — tránh replace mù)

Phase 2: JSON patch / jscodeshift cho import phức tạp.

---

## 6. Registry project — `.irwin/features.json`

```json
{
  "irwinCliVersion": "0.1.0",
  "tsRails": "1.0.11",
  "features": [
    { "id": "auth", "version": "1.0.0", "addedAt": "2026-05-16T00:00:00.000Z" }
  ]
}
```

- `irwin add` append vào `features[]`.
- `irwin g` / `doctor` đọc `tsRails` để compatibility check.

---

## 7. Tích hợp ts-rails — việc cần làm song song

| Hạng mục | Repo | Ưu tiên |
|----------|------|---------|
| `pluralize` → `dependencies` (generate ổn khi spawn) | ts-rails | P0 |
| Document: không dùng global `rails` | ts-rails README | P0 |
| (Tuỳ chọn) bin `ts-rails` song song `rails` | ts-rails | P1 |
| `resolveRailsAppRoot` export hoặc duplicate nhẹ trong irwin-cli | cả hai | P1 |
| Version matrix trong irwin-cli (min ts-rails 1.0.11) | irwin-cli | P1 |

**irwin-cli không fork** generator — chỉ spawn `dist/cli.js`.

---

## 8. Extract feature từ irwin-framework

Nguồn: **`irwin-framework`** (full app). Đích: từng thư mục `features/<id>/` theo **§2.2**. Template **`templates/base/`** = cắt tối giản theo **§2.3**, không copy nguyên framework.

### 8.1 Quy trình extract (mỗi feature)

1. Liệt kê file thuộc feature (vd. auth: `app/services/auth/*`, `configs/routes/auth*`, validators, views auth).
2. Copy vào `features/auth/files/` giữ path.
3. Diff `configs/routes/index.ts` → chuyển thành `patches` + markers trong base template.
4. Liệt kê deps chỉ auth cần → `manifest.npm`.
5. Prisma: tách migration/seed liên quan.
6. Test: `irwin new tmp-app && cd tmp-app && irwin add auth && pnpm dev`.

### 8.2 Thứ tự extract đề xuất

1. **`templates/base`** — §2.3 (application không socket/mailer/jobs).
2. **`session`** + **`auth`** — nền đăng nhập.
3. **`api`** — lớp `/api`.
4. **`admin`** — requires auth.
5. **`i18n`**, **`vue`**, **`notifications`**, **`mailer`** — phase 2.
6. **`ai`**, **`socket`**, **`jobs`**, **`storage`**, **`swagger`** — phase 3.
7. **`turso`**, **`netlify`**, **`serverless`**, **`dev-tools`** — deploy / tooling.

Sau mỗi extract: `irwin new tmp && irwin add <id> && diff` so với subset framework.

---

## 9. Lộ trình phase (ước lượng)

### Phase 0 — Khởi tạo repo (1–2 ngày)

- [x] Scaffold package `irwin-cli` (TypeScript, commander, tsc, bin `irwin`)
- [x] `resolveIrwinRoot`, `.irwin/features.json` read/write
- [x] CI: build + unit test patch engine

### Phase 1 — MVP (1–2 tuần) ✅

- [x] `irwin new` + template `base` (đúng §2.3 — không socket/jobs/mailer)
- [x] `irwin g` wrapper → local ts-rails
- [x] Manifest loader + copy files
- [x] Patch engine (insertAfter marker)
- [x] `irwin add auth` (extract từ framework)
- [x] `irwin add admin` (MVP: dashboard + users; requires auth)
- [x] Feature packs: `api`, `database`, `session`, `i18n` (optional)
- [x] `irwin add` post-install: install deps + `db:generate` / `db:push`
- [x] Docs: README quickstart

### Phase 2 — Ổn định (2–3 tuần)

- [x] `irwin doctor`
- [x] `irwin list`
- [x] `--dry-run` cho add
- [x] `irwin add api`, `i18n`
- [x] `irwin add notifications`, `mailer`
- [x] Pin / lock ts-rails version + compatibility warning (`irwin g` + `doctor`)
- [x] E2E test: new → add database/session/auth → doctor → g scaffold (`npm run test:e2e`)

### Phase 3 — Mở rộng

- [x] `create-irwin` alias (`npm create irwin@latest`) — package `create-irwin/` + bin forward
- [x] `irwin remove` (registry only; `--force` for dependents)
- [x] Plugin manifest từ npm package (`@irwin/feature-xyz`) — see `docs/PLUGIN.md`
- [x] Tích hợp monorepo publish (changesets) — root `.changeset/`, `pnpm changeset` at repo root

### Phase 4 — Feature packs & DX (tiếp)

- [x] `irwin add swagger` — `/docs` (development)
- [x] `irwin add dev-tools` — `/dev` playground (development)
- [x] `irwin upgrade` — bump `ts-rails` + registry
- [x] `irwin add storage`, `jobs`, `socket`, `vue`
- [x] `irwin add turso`, `netlify`, `serverless`
- [x] `irwin add ai` (Gemini — `/api/v1/ai/assistant/chat`)

---

## 10. Kiểm thử

| Loại | Nội dung |
|------|----------|
| Unit | patch engine, manifest validate, requires graph |
| Integration | `irwin new` in temp dir, install, file tree |
| E2E | new → add auth → migrate → login route exists |
| Regression | So sánh tree sau add với subset irwin-framework |

**CI:** Node 20/22, Windows + Linux (path separator).

---

## 11. Rủi ro & quyết định mở

| # | Rủi ro | Giảm thiểu |
|---|--------|------------|
| 1 | Patch conflict khi user sửa marker | Doctor kiểm marker; doc rõ; feature version |
| 2 | Drift giữa framework full vs feature pack | irwin-framework là source of truth; script diff check định kỳ |
| 3 | ts-rails breaking change | Pin version; matrix trong irwin-cli |
| 4 | Prisma migration trùng | Feature mang migration riêng folder; naming convention |
| 5 | Bin `rails` vs Ruby | irwin CLI tên `irwin`; ts-rails đổi bin sau |

**Quyết định cần chốt trước Phase 1:**

- [ ] Tên package npm: `@irwin/cli` vs `create-irwin` vs `irwin-cli`
- [ ] Template engine: copy thuần vs Handlebars/EJS cho `new`
- [ ] DB mặc định: sqlite only hay chọn postgres
- [ ] Có publish `create-irwin` ngay MVP hay chỉ monorepo local

---

## 12. DX mục tiêu (developer experience)

```bash
# Cài CLI (global — chỉ cho new)
npm i -g @irwin/cli

# Tạo app
irwin new my-shop
cd my-shop
pnpm install
pnpm dev

# Thêm tính năng
pnpm exec irwin add auth
pnpm exec irwin add admin
pnpm db:migrate
pnpm db:seed

# Generate trong app (luôn local ts-rails)
pnpm exec irwin g scaffold Product name:string price:integer
pnpm exec irwin g test app/controllers/products.controller.ts
```

---

## 13. Liên kết repo hiện tại

- **ts-rails** `irwin-rails/`: generator + runtime; roadmap P0 ở §7.
- **irwin-framework**: reference full stack; inventory §2.2; **không** dùng làm output `irwin new`.
- **irwin-cli**: `templates/base` (§2.3) + `features/*` (§2.5).

---

*Cập nhật: 2026-05-17 — Phase 1–3 done. Phase 4: swagger, dev-tools, storage, jobs, socket, vue, ai, turso, netlify, serverless, upgrade.*
