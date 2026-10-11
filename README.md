# HealthCamp Finder

A bilingual community health camp finder with a Node.js and Express backend.

## Run locally

1. Install Node.js 18 or newer.
2. Open a terminal in this folder and run `npm install`.
3. Run `npm start`.
4. Open `http://localhost:3000` (the API health check is at `/api/health`).

## Backend features

- `GET /api/camps` lists public camp details; private organiser email fields are omitted.
- `POST /api/camps` accepts a public camp submission.
- `POST /api/volunteers` saves volunteer applications; `GET /api/admin/volunteers` is admin-only.
- `/admin` provides first-time admin setup, login, volunteer review and camp creation.
- Admin passwords are stored as salted scrypt hashes. Admin sessions use an HTTP-only cookie.
- JSON files are stored in `data/` by default. Set `DATA_DIR` to change the storage folder.
- `GET /api/health` can be used by hosting health checks.

The initial camp listings are sample project data. This project currently uses JSON-file storage, suitable for a single running instance. Do not run multiple app instances against the same JSON files.

## Deploy on Render

Render can run this Express app as a Node web service. Connect a GitHub repository containing this folder, set the root directory to `healthcamp-finder-source` if this is a subfolder, use build command `npm install` and start command `npm start`. The app reads the listening port from Render's `PORT` environment variable.

For persistent JSON data, attach a persistent disk to the web service, set its mount path to `/opt/render/project/src/storage`, and add environment variable `DATA_DIR=/opt/render/project/src/storage`. A persistent disk is available on paid Render web services; without one, camp, volunteer and admin files can be lost on restart or deploy. For a free deployment, replace JSON storage with a hosted database before accepting real registrations.

After deployment, open `/admin` and create a unique password of at least 12 characters. Keep the admin URL and password private. The first admin account is created by whoever reaches setup first, so perform setup promptly after the site is live.

## Add a camp

Open `/admin`, create an admin password on first use, then sign in and fill in the camp form. Use latitude and longitude from the venue pin in Google Maps. The public camp registration form is also available from the website.
