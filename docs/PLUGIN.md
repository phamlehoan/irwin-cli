# Irwin feature plugins (npm)

Publish a package that `irwin add` can load from the project's `node_modules`.

## Package naming

- `@irwin/feature-<id>` (recommended), e.g. `@irwin/feature-payments`
- Manifest `id` must match `<id>`: `"id": "payments"`

## Layout

```text
@irwin/feature-payments/
├── package.json
├── manifest.json      # same schema as irwin-cli/features/*/manifest.json
└── files/             # copied into the app (paths preserved)
    └── ...
```

## Install in an app

```bash
pnpm add @irwin/feature-payments
pnpm exec irwin add payments
```

`irwin list` shows npm plugins discovered under `node_modules/@irwin/*` when run inside a project.

## Monorepo dev

Link locally:

```json
"dependencies": {
  "@irwin/feature-payments": "file:../packages/feature-payments"
}
```
