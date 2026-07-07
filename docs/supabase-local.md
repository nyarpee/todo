# Supabase Local Setup

This project keeps the app local-first with IndexedDB, then syncs to Supabase after login.

## 1. Install Supabase CLI

Windows examples:

```powershell
winget install Supabase.CLI
```

or:

```powershell
scoop install supabase
```

Docker Desktop must be running before starting Supabase.

## 2. Initialize Supabase

Run this from the project root:

```powershell
supabase init
```

This creates `supabase/config.toml`. If the file already exists, keep the existing one.

## 3. Start local Supabase

```powershell
supabase start
```

The CLI prints local URLs and keys. The usual local ports are:

```txt
API URL:    http://127.0.0.1:54321
DB URL:     postgresql://postgres:postgres@127.0.0.1:54322/postgres
Studio URL: http://127.0.0.1:54323
```

## 4. Configure environment variables

Copy `.env.example` to `.env.local`, then paste the values from `supabase start`.

```powershell
Copy-Item .env.example .env.local
```

Set:

```txt
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
SUPABASE_SECRET_KEY
```

Only `NEXT_PUBLIC_*` values may be used in browser code.

## 5. Apply schema

The initial schema is in:

```txt
supabase/migrations/202607070001_initial_schema.sql
```

Reset the local database and apply migrations:

```powershell
supabase db reset
```

This destroys local Supabase database data, then recreates tables from migrations.

## 6. Google Login Later

For local development, Google OAuth must allow the local Supabase callback URL.
The exact URL is shown in Supabase Studio/Auth settings, but it is usually based on:

```txt
http://127.0.0.1:54321/auth/v1/callback
```

For production behind VPS/frp/Nginx, use the public HTTPS URL instead.

Example:

```txt
https://supabase.example.com/auth/v1/callback
```

The important rule:

```txt
Google OAuth callback URL = externally visible Supabase Auth URL
```

## 7. Current Database Shape

The first migration creates:

```txt
task_groups
tasks
habits
habit_entries
activity_events
sync_queue
```

All user-owned tables include:

```txt
user_id
created_at
updated_at
deleted_at
client_id
```

`deleted_at` is used for future offline sync. A deleted record can still be sent to other devices as a deletion event.

RLS is enabled. Users can only access rows where:

```sql
auth.uid() = user_id
```
