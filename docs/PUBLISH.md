# Publishing `irwin-cli` to npm

## Prerequisites

1. [npm account](https://www.npmjs.com/signup) with access to scope `@irwin` (or publish as unscoped `irwin-cli` / `create-irwin`).
2. **Two-factor authentication (2FA)** on npm — required for publish.
3. Log in locally:

```bash
npm login
```

## 2FA and `npm publish`

If publish fails with *403 OTP* or *authorization required*:

1. npm → Account → **Enable 2FA** (auth-and-writes recommended).
2. When publishing, npm prompts for a one-time password (authenticator app or SMS).
3. CI: create an **Automation** or **Publish** token (npm → Access Tokens) and set `NPM_TOKEN` in CI.

```bash
# Granular token (recommended for CI)
npm token create --type automation
```

## First-time package name

`404 Not Found` on `PUT` usually means the package name is not registered yet. Ensure `package.json` `name` matches the registry you use (`@irwin/cli` vs `irwin-cli`) and you are logged into the correct npm user/org.

## Publish

```bash
cd irwin-cli
npm run build
npm publish --access public   # for scoped @irwin/cli
```

Dry run:

```bash
npm publish --dry-run
```

## After publish

Users can install globally or create a project in one command:

```bash
npm install -g irwin-cli
irwin new my-app

# or without global install:
npm create irwin@latest my-app
npx irwin add auth-oauth
```
