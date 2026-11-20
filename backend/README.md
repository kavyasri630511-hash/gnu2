# Events API

Flask API backed by the Supabase `events`, `registrations`, and `users` tables.

## Run locally

1. Create a virtual environment and install dependencies:

   ```sh
   python -m venv .venv
   . .venv/bin/activate
   pip install -r requirements.txt
   ```

2. Copy `.env.example` to `.env` and set `SUPABASE_URL` and
   `SUPABASE_PUBLISHABLE_KEY` from your Supabase project.
3. Start the development server with `python app.py`.

The production entry point is `gunicorn app:app`; the included `Procfile` binds
it to the hosting provider's `PORT`.

## Deploy to Render

Create a Web Service from this directory (`backend`) with:

- Build command: `pip install -r requirements.txt`
- Start command: `gunicorn --bind 0.0.0.0:$PORT app:app`
- Health check path: `/health`

Set `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY` as service environment
variables in the hosting dashboard. Do not commit `.env` or use a Supabase
service-role key as the publishable key.

## API routes

- `GET /api/events` (optional `status` query parameter)
- `GET /api/events/<event_id>`
- `POST /api/registrations` with JSON `{ "user_id": "...", "event_id": "..." }`
- `GET /api/me/registrations?user_id=...`
- `GET /api/events/<event_id>/registrations?organizer_id=...`

All origins are allowed by CORS. Authentication is disabled, so IDs supplied
in request bodies and query parameters are not verified; anyone who can reach
the API can act as another user or claim to be an organizer. Supabase must also
have Row Level Security policies that permit the intended operations for the
publishable key's database role, or requests will be rejected by the database.
# gnu2
# gnu2
