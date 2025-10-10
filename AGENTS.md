# Repository Guidelines

## Project Structure & Module Organization
- `client/` — Vite + React + TypeScript app. Source `client/src`, assets `client/public`, build to `client/dist`.
- `server/` — Node.js (TypeScript) logs API and minimal dashboard under `/api` and `/dashboard`; build to `server/dist`.
- `signal/` — WebSocket signaling (Express + `ws`), default port `8787`; build to `signal/dist`.
- `shared/protocol/` — Shared Zod schemas/types used by `client` and `signal`.
- `deploy/` — Dockerfile, `nginx.conf`, and entrypoint scripts.
- `references/` — Design notes, protocol docs, and SFT materials.

## Build, Test, and Development Commands
- `npm run dev:all` — Run `server` (8080), `signal` (8787), and `client` (Vite dev) with proxies.
- `npm -w client run dev|build|preview` — Frontend dev server, production build, or static preview.
- `npm -w server run dev|build` ; `npm -w signal run dev|build` — Compile‑watch/run or build `dist/`.
- `npm run lint` ; `npm run typecheck` — ESLint (client) and TypeScript checks (client).
- Optional core tests: `tsc -p client/tsconfig.coretests.json` — Compiles `client/tests` to `.tmp-tests`.

## Coding Style & Naming Conventions
- TypeScript (ES modules). Indent 2 spaces; semicolons; single quotes.
- Filenames: kebab-case. React components export PascalCase; types/interfaces PascalCase; constants UPPER_SNAKE_CASE.
- Respect workspace boundaries; do not edit generated `dist/` or committed assets under `public/`.
- ESLint config: `client/eslint.config.js` (some paths relax `no-explicit-any`). Run `npm run lint` before pushing.

## Testing Guidelines
- No dedicated runner yet; aim for zero TS/ESLint errors.
- If adding tests, prefer Vitest with `*.test.ts[x]` colocated under `src/`.
- Keep tests fast and deterministic; mock network/RTC as needed.
- Optional core tests: run the `tsc` command above to compile.

## Commit & Pull Request Guidelines
- Conventional Commits: `feat(scope): …`, `fix(scope): …`, `chore(scope): …`, `docs(scope): …`, `ci(scope): …`, `tools(scope): …`.
- Examples: `feat(signal): add session heartbeat`; `fix(client): guard Pixi filters on WebGL1`.
- PRs: clear description, linked issues, screenshots/GIFs for UI, focused scope.
- Ensure `npm run lint` and `npm run typecheck` pass; update README/docs when behavior changes.

## Security & Configuration Tips
- Server env: `PORT`, `DATA_ROOT`, `MAX_FILE_SIZE_MB`, `JWT_SECRET`, `SESSION_TTL_SEC` (18000), `SESSION_REFRESH_SKEW_SEC` (900), `COOKIE_NAME`, `GOOGLE_CLIENT_ID`.
- Signal auth (optional): `SIGNAL_AUTH_REQUIRED=1`, client passes `?token=<JWT>` to `/ws`.
- Dev proxies expect `http://localhost:8080` and `ws://localhost:8787`; Docker builds accept `VITE_SIGNAL_SERVER_URL`.
- Never commit secrets; use `.env` locally and CI secrets in pipelines.

