<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Database & Prisma Rules (Critical)

- **Schema change protocol (safety first)**:
  - Whenever you edit `prisma/schema.prisma`, **do not blindly run db:push**.
  - **Step 1 (mandatory)**: Immediately run the diff command to see exactly what SQL would be executed:
    ```
    cd Developer/Github/galveston-reservation-next && npm run db:diff
    ```
    (This generates the SQL that would bring the current Neon database in line with `prisma/schema.prisma`)
  - Analyze the output:
    - If the diff is empty → no changes needed.
    - If it is a **simple additive / safe change** (e.g. new column with DEFAULT, new table, new index on non-existing data, new enum value) → you may proceed with `npm run db:push`, but still inform the user what is being added.
    - If it produces a **non-trivial migration script** (any DROP, ALTER COLUMN that may lose data, complex changes, data backfills, constraint changes, etc.) → **STOP**. Do not run db:push automatically.
      - Clearly tell the user: "This schema change generates a migration script with the following SQL:"
      - Show the full SQL output.
      - Ask for explicit confirmation: "Do you want me to run `npm run db:push` now?"
      - **OR** provide clean copy-pasteable SQL they can run directly in the Neon SQL Editor (https://console.neon.tech → your project → SQL).
      - Prefer giving them the Neon SQL option when possible, especially for production safety.
  - Only after user confirmation (or for trivial additive changes) should you run:
    ```
    cd Developer/Github/galveston-reservation-next && npm run db:push
    ```
  - After successful push, always run `npm run db:generate` (or rely on postinstall) to refresh the Prisma Client.

- This project prefers `prisma db push` for speed (not `prisma migrate dev`), but we now treat any real "migration script" output with extra caution per user request.

- Add or update scripts in `package.json` as needed:
  - Maintain `"db:push": "prisma db push"`, `"db:diff": "prisma migrate diff --from-config-datasource --to-schema=./prisma/schema.prisma --script"`, and `"db:generate": "prisma generate"`.
  - The build script already chains `prisma generate`.

- When editing schema:
  1. Edit `prisma/schema.prisma`.
  2. **Always** run `npm run db:diff` via the run_terminal_command tool first and capture the output.
  3. If the diff indicates a non-trivial migration (anything beyond simple additive columns/tables with defaults):
     - Report to the user: "This change produces the following migration SQL:"
     - Paste the full SQL output.
     - Explicitly ask: "Do you want me to run `npm run db:push` now, or would you prefer to copy-paste the SQL into the Neon console yourself?"
     - Only run `npm run db:push` after the user confirms.
     - If they want the Neon option, provide the SQL cleanly formatted (they can paste it into https://console.neon.tech → SQL).
  4. For trivial/safe additive changes, you may run `npm run db:push` but still show the (usually minimal) diff output to the user.
  5. After push: run `npm run db:generate`.
  6. Update any code that uses the new schema, then test (and run `npm run build`).
  7. Document the change if relevant.

- Existing manual SQL migrations are in `prisma/migrations/`. Use `db:diff` output as the source of truth for what to paste into Neon.

- The `.env` must point to the correct Neon `DATABASE_URL`. The agent always uses the local `.env` for these commands.

- If `db:push` or `db:diff` fails, report the full error output and do not proceed until the user resolves it (e.g. connection issues or manual intervention on Neon).

- **Never** run a schema-changing command in production without the above confirmation step when a real migration script is involved. The goal is to avoid the previous class of "Server Components render" errors while keeping the user in control of their Neon database.

# General Workflow
- After any significant change (especially schema, auth, emails, API routes), run `npm run build` using the terminal tool to catch TypeScript, Prisma, and compilation errors early.
- Commit and push frequently with descriptive messages (user often requests "commit and push").
- Use `run_terminal_command` for all shell actions, git, npm, prisma, etc. Prefer this over assuming user will run things.
