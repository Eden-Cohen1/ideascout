---
name: notion-writeup
description: Use on demand (e.g. via /notion-writeup) to capture something we just built, learned, or figured out into a Notion "Dev Log" database — a new workflow, a useful action, a non-obvious setup, a debugging insight, or a reusable pattern worth keeping. Drafts a structured writeup from the current session, gets user approval, then writes a page to Notion.
---

# Notion Writeup

Capture a useful thing we just did or learned into the user's Notion **Dev Log**
database as a structured, reusable page. On-demand only — never triggers itself.

## When to use

The user invokes this (e.g. `/notion-writeup`, optionally with a topic hint like
`/notion-writeup gitleaks setup`) after we've done or discovered something worth
keeping: a new workflow, a handy command/action, a non-obvious config or setup, a
debugging insight, a reusable code/architecture pattern, or a reference worth saving.

If the user gives no hint, infer the topic from the most recent substantive work in
the conversation.

## Prerequisites

The `notion` MCP must be connected. If Notion tools are unavailable or return an auth
error, stop and tell the user to run `/mcp` to authenticate the `notion` server, then
retry.

## Steps

Create one todo per step and work through them in order.

### 1. Locate (or create) the "Dev Log" database

1. Call `notion-search` with query `"Dev Log"`, `query_type: "internal"`. Look for a
   result with `"type": "database"` whose title is **Dev Log**.
2. If found: call `notion-fetch` with its `id` to read the schema and grab the data
   source id from the `<data-source url="collection://...">` tag. Use that
   `data_source_id` as the page parent. **Reuse the existing database — never create a
   second "Dev Log".**
3. If not found: create it with `notion-create-database` (workspace-level, no parent):

   ```
   title: "Dev Log"
   schema: CREATE TABLE ("Title" TITLE, "Date" DATE, "Project" RICH_TEXT, "Tags" MULTI_SELECT('workflow':blue, 'setup':green, 'pattern':purple, 'gotcha':red, 'reference':gray), "Type" SELECT('Workflow':blue, 'Setup':green, 'Pattern':purple, 'Learning':yellow, 'Reference':gray))
   ```

   The result includes the `<data-source url="collection://...">` id — use it as the
   page parent below.

### 2. Draft the writeup (do NOT write to Notion yet)

Build the draft from **this conversation's** context — what we actually did, the real
commands/code/paths, the reasoning, and the traps we hit. Do not invent details or
crawl unrelated history.

- **Title** — specific and searchable (e.g. "Wiring the Notion MCP into git + user
  scope", not "Notion stuff").
- **Type** — one of `Workflow | Setup | Pattern | Learning | Reference`.
- **Project** — the repo/product name (infer from cwd/repo; ask only if ambiguous).
- **Tags** — a few from the palette above, or new short ones as fitting.
- **Body** — Notion-flavored Markdown, using these sections (drop any that don't apply):

  ```
  ## What & why
  One or two lines: what this is and why it matters / when you'd reach for it.

  ## How
  The concrete steps, commands, and code. Real values, copy-pasteable.

  ## Gotchas
  Non-obvious traps, edge cases, and things that bit us.

  ## References
  Repo paths (file:line), docs URLs, related Dev Log pages, PRs/commits.
  ```

  Do NOT repeat the title as a heading inside the body.

### 3. Get approval

Show the full draft (title, type, project, tags, and the Markdown body) in chat and
ask the user to approve or edit. **Never write to Notion before explicit approval.**
Apply any requested edits and re-show if the changes are substantial.

### 4. Create the page

Call `notion-create-pages` with:

- `parent`: `{ "type": "data_source_id", "data_source_id": "<from step 1>" }`
- one entry in `pages` with:
  - `properties`: `{ "Title": "...", "Date": "<today, YYYY-MM-DD>", "Project": "...", "Tags": "tag1,tag2", "Type": "..." }`
    (match the exact property names from the fetched/created schema)
  - `content`: the approved Markdown body
  - `icon`: a fitting emoji (optional)

Then return the new page URL to the user.

## Guardrails

- On-demand only. Do not auto-run this after tasks.
- One "Dev Log" database per workspace — always search-and-reuse before creating.
- Never hardcode a database/page id in this skill; always resolve by name at runtime
  (keeps it portable across machines and workspaces).
- Approval gate is mandatory — no silent writes.
- Never put secrets, tokens, or `.env` values in a page.
