# Repository Guidelines

## Project Structure & Module Organization
- `backend/` hosts the Express API in TypeScript; `controllers/`, `services/`, `models/`, `routes/`, `api/`, and `utils/` keep transport, business, data, and helpers separated, with `src/index.ts` as the bootstrapper.
- `frontend/` is the Next.js app; `src/components/`, `pages/`, `store/`, `services/`, `hooks/`, and `validation/` cover UI, routing, state, network, and schema logic. Styling lives in `styles/` plus `theme/`; localization files sit in `i18n/`.
- `firebase/` defines the emulator suite, while `docs/` and `specs/` hold product briefs. Use `docker-compose.yml` when you need a multi-service dev stack.

## Build, Test, and Development Commands
- Backend: `npm install`, `npm run dev` for hot reload, `npm run build && npm run start` for compiled output, and `npm run lint`, `npm run format`, `npm run type-check` before pushing.
- Frontend: `npm install`, `npm run dev`, `npm run build && npm run start`, plus `npm run lint`, `npm run format`, and `npm run type-check`. Run `npm run e2e` for Playwright. Use `docker compose up --build` to exercise everything together.

## Coding Style & Naming Conventions
- ESLint (`eslint:recommended`, `@typescript-eslint`, `next/core-web-vitals`) and Prettier enforce 2-space indentation, 100-character lines, semicolons, single quotes, and `arrowParens: "always"`.
- Prefer PascalCase for components and classes, camelCase for functions and variables, kebab-case file names in React feature folders, and UPPER_SNAKE_CASE for env keys. Lean on shared DTOs under `types/` rather than `any`.

## Testing Guidelines
- Vitest drives unit and integration coverage in both packages; colocate specs as `*.test.ts` or `*.spec.ts`. Frontend assertions pair Vitest with `@testing-library/react`; backend HTTP flows should use `supertest`.
- Guard regressions with `npm run test:coverage`. During iteration, use `npm run test:watch` (backend) or `npm run test:ui` (frontend). Run Playwright suites whenever UI or flow changes land.

## Commit & Pull Request Guidelines
- History only shows the template seed, so adopt imperative, scoped messages (`feat(auth): add MFA enrollment`), link issue IDs, and keep commits review-sized.
- Pull requests must outline intent, list risky changes, link specs or tickets, attach screenshots or API samples for UI/API updates, and mention new env keys. Loop in both backend and frontend reviewers when changes span packages.

## Security & Configuration Tips
- Derive `.env` files from each `.env.example`, store secrets outside Git, and rotate Firebase or Cloudflare keys after sharing. When Docker environments drift, prune the `firebase_data` volume before restarting the emulator.
