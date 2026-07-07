# Todoapp

Hierarchical todo MVP built with Next.js, React, and TypeScript.

## Docker Setup

Build and start the Next.js dev server:

```powershell
docker compose up --build
```

Open:

```txt
http://localhost:3000
```

Stop the server:

```powershell
docker compose down
```

Run typecheck inside Docker:

```powershell
docker compose run --rm web npm run typecheck
```

Reinstall dependencies after changing `package.json`:

```powershell
docker compose build --no-cache web
docker compose up
```

## Local Node Setup

Install dependencies:

```powershell
npm install
```

Start the local development server:

```powershell
npm run dev
```

Open:

```txt
http://localhost:3000
```

## MVP Scope

- Add tasks.
- Add subtasks.
- Toggle task completion.
- Show a simple root-task list.
- Open task details from List or Tree.
- Show inline progress bar and percent.
- Calculate parent progress from child progress.
- Keep child tasks unchanged when a parent is checked.
- Sync parent completion when all direct children are complete.
- Switch between List and Tree.
- Show Tree as connected task nodes.
- Persist local MVP data with `localStorage`.

## Supabase Later

The UI uses a repository boundary:

- Current: `LocalStorageTaskRepository`
- Future: `SupabaseTaskRepository`

See [docs/architecture.md](docs/architecture.md).

## Supabase Local Setup

Supabase local development files are prepared under `supabase/`.

Start with:

```powershell
supabase init
supabase start
supabase db reset
```

See [docs/supabase-local.md](docs/supabase-local.md).
