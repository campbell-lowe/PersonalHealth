# Personal Health Tracker

A cycle, pregnancy prep, and lifestyle tracking workspace with:

- daily cycle entry logging
- dashboard and statistics views
- cycle phase and due-date estimate helpers
- goal tracking for pregnancy prep and lifestyle habits

## Project Structure

- `src/` React frontend (Vite)
- `backend/` Python (Flask) + SQLite API
- `backend/schema.sql` database schema

## Run The App

1. Install frontend dependencies:

```bash
npm install
```

2. Install backend dependencies:

```bash
python3 -m venv .venv
./.venv/bin/pip install -r backend/requirements.txt
```

3. Start backend API (port 3000):

```bash
./.venv/bin/python backend/server.py
```

4. Start frontend (Vite dev server):

```bash
npm run dev
```

## Environment Variables

Frontend (`.env` in project root):

- `VITE_API_BASE_URL`
	- Leave empty to use same-origin requests (recommended when frontend and backend share a domain or proxy).
	- Set to your backend origin when hosting separately (example: `https://your-backend.example.com`).

Backend (`backend/.env` or host env vars):

- `PORT` (default: `3000`)
- `DATABASE_URL` (optional; when set to a Postgres URL, backend uses Postgres instead of SQLite)
- `APP_ALLOWED_ORIGINS`
	- Comma-separated list of allowed frontend origins.
	- Example: `https://your-frontend.example.com,http://localhost:5173`
- `APP_DEFAULT_USERNAME` (optional bootstrap account)
- `APP_DEFAULT_PASSWORD` (optional bootstrap account)
- `APP_DEMO_USERNAME` (optional, default: `demo`)
- `APP_DEMO_PASSWORD` (optional, default: `demo12345`)

## API Endpoints Used By Frontend

- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/cycle?username=...`
- `GET /api/cycle/:date?username=...`
- `POST /api/cycle`
- `GET /api/goals?username=...&category=...`
- `PUT /api/goals`

## Optional Auth Bootstrap (Deployment)

When hosting the backend, you can pre-create a login account by setting:

- `APP_DEFAULT_USERNAME`
- `APP_DEFAULT_PASSWORD`

On backend startup, if that username does not exist yet, it is inserted into the `users` table with a hashed password.

## Built-in Demo Account

The backend auto-creates a demo account with sample cycle and goals data:

- Username: `demo`
- Password: `demo12345`

This lets reviewers explore the app without using your personal account data.

## Notes

- User-specific data is selected by username.
- Frontend API target is controlled by `VITE_API_BASE_URL`.
- Future-date cycle entries are intentionally rejected by backend validation.

## Publish Checklist

1. Frontend build:

```bash
npm install
npm run build
```

2. Backend runtime:

```bash
python3 -m venv .venv
./.venv/bin/pip install -r backend/requirements.txt
./.venv/bin/python backend/server.py
```

3. Configure production env vars:

- Frontend: `VITE_API_BASE_URL`
- Backend: `APP_ALLOWED_ORIGINS`, `PORT`, and optional bootstrap vars

4. Verify in production:

- Can register/login
- Can create/update cycle entries
- Can load and update wellness goals

## Free Hosting (Render)

This repo includes [render.yaml](render.yaml) so Render can auto-create both services:

- `personal-health-backend` (Python web service)
- `personal-health-frontend` (static site)

### Deploy Steps

1. Push this repo to GitHub.
2. In Render, choose **New +** -> **Blueprint**.
3. Connect the GitHub repo and deploy from `render.yaml`.
4. After first deploy, copy your frontend URL (example: `https://personal-health-frontend.onrender.com`).
5. Set backend env var:
	- `APP_ALLOWED_ORIGINS=https://personal-health-frontend.onrender.com`
	- `DATABASE_URL=<your managed Postgres URL>`
6. Set frontend env var:
	- `VITE_API_BASE_URL=https://personal-health-backend.onrender.com`
7. Redeploy both services.

### Important Data Note

Current backend storage is SQLite (`backend/cycleTracker.db`) unless `DATABASE_URL` is set. On many free platforms, local disk can be ephemeral, so SQLite data may reset after restarts/redeploys.

For guaranteed long-term persistence on free hosting, set `DATABASE_URL` to a managed Postgres database (for example Supabase Postgres).
