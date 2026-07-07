# Architecture Notes

## Current MVP

- Next.js + React + TypeScript renders the UI.
- Tasks are stored through `TaskRepository`.
- The active repository is `LocalStorageTaskRepository`.
- `LOCAL_USER_ID` is a temporary user until auth is added.

## Supabase Migration Path

The UI should not call Supabase directly. Add a future repository such as:

```ts
class SupabaseTaskRepository implements TaskRepository {
  listTasks(userId) {}
  saveTasks(userId, tasks) {}
}
```

Then replace the repository in `TaskApp`.

## Persisted Task Shape

Store these fields in Supabase:

- `id`
- `user_id`
- `title`
- `parent_id`
- `order`
- `completed`
- `created_at`
- `updated_at`

Do not store UI-derived fields such as `children`, `depth`, `progress`, `viewMode`,
`focusedRootId`, or `expandedTaskIds`.
