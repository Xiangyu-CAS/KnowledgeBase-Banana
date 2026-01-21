# Repository Guidelines

## Project Structure & Module Organization
- `index.tsx` boots the React app and renders `App.tsx`.
- `components/` holds UI building blocks (`ChatInterface.tsx`, `KnowledgeBase.tsx`, etc.).
- `services/` contains API integrations (Gemini client logic).
- `services/comicStudioService.ts` powers Comic Studio generation flows.
- `KnowledgeBase/` stores local image assets plus `index.json` for entity metadata.
- `assets/` stores static images (e.g., screenshots).
- `docs/` contains internal notes and design references.

## Build, Test, and Development Commands
- `npm install` installs dependencies.
- `npm run dev` starts the Vite dev server with hot reload.
- `npm run build` creates a production build in `dist/`.
- `npm run preview` serves the built bundle for local verification.

## Coding Style & Naming Conventions
- TypeScript + React with ES modules; follow existing patterns in `App.tsx`.
- Indentation: 2 spaces, semicolons required, single quotes for strings.
- Naming: `PascalCase` for components/types, `camelCase` for functions/variables.
- No formatter or linter is configured; keep diffs clean and consistent with local style.

## Testing Guidelines
- No automated test framework is present. If you add one, include commands in `package.json` and note it here.
- For UI changes, manually verify chat flow, knowledge base scanning, and image upload.
- Comic Studio sessions are persisted in browser `localStorage` with multi-session history (not written to `.history`).

## Commit & Pull Request Guidelines
- Commit history shows mixed styles (plain summaries and `feat:` prefixes). Prefer short, imperative summaries; use conventional prefixes when helpful (e.g., `feat:`, `fix:`).
- PRs should include: concise description, screenshots for UI changes, and any new config keys.
- Link relevant issues or notes in `docs/` when the change affects user flows.

## Security & Configuration Tips
- Keep API keys in `.env` only. Never commit real keys; `GEMINI_API_KEY` is required.
- When editing `KnowledgeBase/index.json`, keep file paths in sync with `KnowledgeBase/` assets.
