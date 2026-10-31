# Clarity Health AI — agent guide

Educational prototype: text-based lab-report PDFs → reviewed, plain-language dashboards. See `README.md` for the full architecture.

## Layout

- `backend/` — FastAPI + Pydantic + PyMuPDF, Gemini via `google-genai`. Code in `backend/app/`, tests in `backend/tests/`.
- `frontend/` — Next.js 16 / React 19 / TypeScript / Tailwind. Read `frontend/AGENTS.md` before touching Next.js code.
- `scripts/` — sample, image, and extraction-evaluation generators.
- `samples/` — synthetic report for demos and tests.

## Commands (Windows / PowerShell, from repo root)

- Backend tests: `backend\.venv\Scripts\python.exe -m pytest backend -q`
- Backend dev server: `cd backend; .\.venv\Scripts\uvicorn app.main:app --reload --port 8000`
- Frontend lint: `cd frontend; npm run lint`
- Frontend build: `cd frontend; npm run build`

Run the relevant checks before declaring a change done.

## Rules

- The LLM is used only for language understanding. File validation, reference-range comparisons, status/health-rating calculation, citation checks, and research/map URLs stay deterministic Python/TS code — do not move them into prompts.
- Missing report fields stay `null`; never infer or fabricate values, excerpts, ratings, or citations.
- Every extracted result keeps its source page and exact excerpt, and the backend must verify the excerpt exists on that page.
- Assistants only see user-confirmed results.
- Never read, print, or commit `backend/.env` or any API key. Use only synthetic or de-identified reports.
- Keep UI copy educational: no diagnosis, treatment, or urgency claims.
