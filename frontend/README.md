# Gather frontend

Static event discovery frontend for the Flask API in `backend/`.

## Run locally

Open `index.html` in a browser, or serve this folder with any static file server. The page calls `https://gnu2-2.onrender.com/api/events` and `POST /api/registrations`.

There is no sign-in or authorization UI. Registrations use a browser-local guest UUID; this is an identifier only, not an authenticated identity. The backend currently allows cross-origin requests, so the frontend sends no token or authorization header.

## Render static site

Create a Static Site from this repository, use `frontend` as the root directory, and `.` as the publish directory. No build command is needed.
