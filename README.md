# Projection MVP API Bootstrap

This repository now includes an initial backend implementation for the project creation MVP flow with:

- Create project from blank/template/copy mode
- Template listing, retrieval, create, update, and deactivation
- Template preview and copy-settings preview endpoints
- Global closure windows that automatically shift project end dates
- People and project assignment management
- Weekly utilization snapshot API
- Multi-week utilization timeline API for heatmap-style views
- Project-centric staffing load timeline API
- RFC 7807 style error responses
- SQLite-backed local persistence with seed data on first run
- Browser UI for interacting with templates and projects

## Tech

- Node.js
- TypeScript
- Express
- Zod
- Built-in SQLite via Node.js for embedded local storage

## Run

1. Install dependencies:

   npm install

2. Start in dev mode:

   npm run dev

3. Health check:

   GET http://localhost:3000/health

4. Open UI:

  http://localhost:3000/

5. Login page:

  http://localhost:3000/login.html

## Import XLSX Test Data

Run the workbook import against the supplied test sheet:

  npm run import:xlsx -- "temp/Nolimit Development Roadmap(Dev).xlsx"

What it imports:

- People from the People sheet
- Template names from the Project Templates sheet
- Projects and role-based assignments inferred from the Roadmap sheet timeline
- Roles from the Roles sheet (used for import metadata)

Additionally, all workbook sheets are stored raw in SQLite table legacy_workbook_sheets so no source sheet data is discarded during import.

## Storage

- Data is stored locally in data/projection.sqlite.
- The database is seeded on first run with the original demo templates, projects, people, assignments, and closures.
- Subsequent API and UI changes persist across restarts.
- Workbook import snapshots are also persisted in table legacy_workbook_sheets.

## Docker Build And Data Persistence

- Yes: the SQLite database should stay outside the container so data survives rebuild/redeploy.
- This repo now mounts host folder `data/` into container path `/app/data`.
- Since the app uses `/app/data/projection.sqlite` in container, DB state persists as long as host `data/` remains.

Build app and recreate Docker container in one command:

  npm run build

Compose commands:

- Build and run with persistent data mount:

  npm run compose:up

- Stop and remove container:

  npm run compose:down

- Follow runtime logs:

  npm run compose:logs

Direct Docker scripts:

- Build image only:

  npm run docker:build

- Build image and recreate running container with mounted data directory:

  npm run docker:recreate

Compose file:

- `compose.yaml` defines service `projection` with `./data:/app/data` bind mount, so SQLite data survives container rebuild/redeploy.

Defaults used by `docker:recreate`:

- Image: `projection-app:latest`
- Container: `projection-app`
- Port mapping: `${DOCKER_HOST_PORT:-PORT}:${PORT}`
- Volume: `./data:/app/data`

Optional environment overrides:

- `DOCKER_IMAGE` to change image tag
- `DOCKER_CONTAINER` to change container name
- `DOCKER_HOST_PORT` to change exposed host port

## GitHub Actions (Manual Only)

Pushes no longer trigger automatic build/deploy.

Use GitHub Actions -> Run workflow manually:

- `Build Container (Manual)`:
  - Builds the Docker image in GitHub Actions only.
  - Does not deploy.

- `Deploy Container (Manual)`:
  - Connects to server over SSH.
  - Pulls latest `main`.
  - Runs `docker compose up -d --build` in deploy path.
  - Keeps DB data persisted through `./data:/app/data` mount.

## UI Features

The web UI is served from the same app and lets you:

- Use a dedicated Projects tab as the default analysis view
- Use a dedicated Data Mapping tab to edit source-to-database mapping rules
- Set actor context (`x-user-id` and `x-user-role`) without external API tools
- View templates and projects
- Edit existing projects directly from Planning Studio
- View and manage global closures (company shutdown/vacation windows)
- View and add people with weekly capacity
- Assign people to projects with role, allocation %, and date range
- Visualize weekly utilization and over-allocation
- Visualize multi-week utilization trends in a heatmap
- Visualize project staffing load across multiple weeks
- Click person or project heatmap cells to jump into assignment-focused planning for that week
- Create and deactivate templates
- Preview settings from template or existing project
- Create projects in blank/template/copy mode
- Inspect API responses and errors in a built-in response log

## Mock Authentication

The API reads actor context from headers:

- x-user-id: any non-empty string
- x-user-role: comma-separated roles

Allowed role values:

- SYSTEM_ADMIN
- PROJECT_OWNER
- TEAM_MEMBER
- STAKEHOLDER

If omitted, defaults are:

- x-user-id: demo-user
- x-user-role: PROJECT_OWNER

## Google Login

Google Sign-In is supported via Google Identity Services.

Required environment variable:

- GOOGLE_CLIENT_ID: OAuth client ID from Google Cloud Console

Optional environment variable:

- ALLOWED_EMAIL_DOMAIN: allowed email domain, default is nolimitcity.com

Behavior:

- If a bearer Google ID token is sent in Authorization, backend verifies it and enforces the allowed domain.
- By default, any verified Google login ending with @nolimitcity.com is allowed.
- Verified Google users are mapped to PROJECT_OWNER role in this MVP.
- Protected API endpoints now require Google login; unauthenticated calls return 401.
- Only health and Google auth config bootstrap endpoints are public.
- The app redirects to /login.html when no valid login token is present.

## Core Endpoints

- GET /api/v1/project-templates
- GET /api/v1/project-templates/{id}
- POST /api/v1/project-templates
- PATCH /api/v1/project-templates/{id}
- DELETE /api/v1/project-templates/{id}
- POST /api/v1/project-templates/preview
- POST /api/v1/projects/copy-settings/preview
- POST /api/v1/projects
- PATCH /api/v1/projects/{id}
- GET /api/v1/projects
- GET /api/v1/global-closures
- POST /api/v1/global-closures
- DELETE /api/v1/global-closures/{id}
- GET /api/v1/people
- POST /api/v1/people
- GET /api/v1/assignments
- POST /api/v1/assignments
- DELETE /api/v1/assignments/{id}
- GET /api/v1/utilization?weekStart=YYYY-MM-DD
- GET /api/v1/utilization/timeline?weekStart=YYYY-MM-DD&weeks=8
- GET /api/v1/utilization/projects/timeline?weekStart=YYYY-MM-DD&weeks=8
- GET /api/v1/mappings/meta/tables
- GET /api/v1/mappings
- POST /api/v1/mappings
- PATCH /api/v1/mappings/{id}
- DELETE /api/v1/mappings/{id}

## Example Requests

Create project from template:

POST /api/v1/projects

{
  "mode": "template",
  "name": "Q3 Migration",
  "description": "Migration phase",
  "startDate": "2026-07-01",
  "targetEndDate": "2026-10-15",
  "templateId": "REPLACE-WITH-TEMPLATE-ID"
}

Preview copy settings from an archived or active project:

POST /api/v1/projects/copy-settings/preview

{
  "sourceProjectId": "REPLACE-WITH-PROJECT-ID",
  "settingsOverride": {
    "notificationProfile": "strict"
  }
}

## Implemented Rules

- Project creation allowed only for SYSTEM_ADMIN and PROJECT_OWNER.
- Template CRUD allowed for SYSTEM_ADMIN and PROJECT_OWNER.
- Name conflicts return 409 and suggestions to resolve in UI.
- Copy source can be active or archived, but not deleted.
- Copy excludes tasks/dependencies, comments/mentions, notification history, audit logs, attachments, memberships, and external links.
- Template update model is in-place with active/inactive lifecycle.
- Global closures reduce available working days and auto-extend project adjusted end dates.
- Utilization is calculated per person and week as assigned hours divided by available hours.

## Current Scope Notes

- Local persistence is SQLite only; there is no multi-user remote database yet.
- No database migrations or import/export tooling yet.
- No SSO integration yet.
- Audit events are not persisted yet; currently this is API/domain bootstrap code.
