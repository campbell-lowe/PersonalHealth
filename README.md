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
- Frontend assumes backend is available at `http://localhost:3000`.
- Future-date cycle entries are intentionally rejected by backend validation.
