# Knockout Voting (Next.js + Appwrite)

A full-stack real-time voting MVP inspired by a single-elimination bracket:

- Quarterfinals: 8 items -> 4 matches
- Semifinals: 4 items -> 2 matches
- Final: 2 items -> 1 match
- Completed: champion display

## Features

- Next.js App Router (server + client components)
- Appwrite Database + Realtime + Authentication
- Public voting page with local duplicate-vote prevention per match
- Realtime vote updates through Appwrite subscriptions
- Protected admin page at `/admin` with email/password login
- Admin stage progression endpoint with deterministic winner selection

## Project Structure

```text
app/
	admin/page.tsx
	api/admin/advance/route.ts
	api/tournament/route.ts
	api/vote/route.ts
	page.tsx
components/
	BracketView.tsx
	MatchCard.tsx
lib/
	appwrite.ts
	appwrite-server.ts
	tournament-server.ts
	voting.ts
```

## 1. Install

```bash
npm install
```

## 2. Configure Environment Variables

Copy `.env.example` to `.env.local` and fill in values:

```bash
cp .env.example .env.local
```

Required variables:

- `NEXT_PUBLIC_APPWRITE_ENDPOINT`
- `NEXT_PUBLIC_APPWRITE_PROJECT_ID`
- `NEXT_PUBLIC_APPWRITE_DATABASE_ID`
- `NEXT_PUBLIC_APPWRITE_MATCHES_COLLECTION_ID`
- `NEXT_PUBLIC_APPWRITE_TOURNAMENT_COLLECTION_ID`
- `APPWRITE_API_KEY`

Optional variables:

- `APPWRITE_TOURNAMENT_DOCUMENT_ID` (default: `main`)
- `APPWRITE_ADMIN_EMAILS` (comma-separated, e.g. `admin@example.com`)
- `APPWRITE_*` overrides for server-side endpoint/project/database/collection IDs

## 3. Appwrite Setup

Create an Appwrite project, then a database with two collections.

### Auto Bootstrap (Recommended)

You can create the full required Appwrite data model and seed data automatically.

```bash
npm run bootstrap:appwrite
```

The script reads configuration from your env files in this order:

1. `.env.local`
2. `.env`
3. `.env.example`

It will:

- Create the database if missing
- Create `matches` and `tournament` collections if missing
- Create all required attributes
- Create the `idx_stage_match_index` index
- Seed the tournament control document (if missing)
- Seed initial quarterfinal matches (if the collection is empty)

The script is idempotent: if resources already exist, it will keep them and skip destructive resets.

If IDs are not set in env, it falls back to:

- `knockout_db`
- `matches`
- `tournament`

At the end it prints env key/value lines you can copy into `.env.local`.

### Collection: `matches`

Attributes:

- `stage` (string, required)
- `matchIndex` (integer, required)
- `itemA` (string, required)
- `itemB` (string, required)
- `votesA` (integer, required)
- `votesB` (integer, required)
- `winner` (string, optional)
- `itemAImage` (string, optional)
- `itemBImage` (string, optional)

Recommended permissions for realtime public view:

- Read: `role:all`
- Write: service/API key only

### Collection: `tournament`

Attributes:

- `currentStage` (string, required)
- `isVotingOpen` (boolean, required)

Create one document (ID = `main` unless overridden) with:

```json
{
	"currentStage": "quarterfinal",
	"isVotingOpen": true
}
```

### Seed Initial Quarterfinal Matches (8 items)

Create four `matches` documents at stage `quarterfinal`:

```json
[
	{ "stage": "quarterfinal", "matchIndex": 0, "itemA": "Item 1", "itemB": "Item 2", "votesA": 0, "votesB": 0 },
	{ "stage": "quarterfinal", "matchIndex": 1, "itemA": "Item 3", "itemB": "Item 4", "votesA": 0, "votesB": 0 },
	{ "stage": "quarterfinal", "matchIndex": 2, "itemA": "Item 5", "itemB": "Item 6", "votesA": 0, "votesB": 0 },
	{ "stage": "quarterfinal", "matchIndex": 3, "itemA": "Item 7", "itemB": "Item 8", "votesA": 0, "votesB": 0 }
]
```

### API Key

Create an Appwrite API key for the backend route handlers with database read/write scopes.

## 4. Run

```bash
npm run dev
```

Open:

- Public voting UI: `http://localhost:3000`
- Admin UI: `http://localhost:3000/admin`

## How It Works

- Public UI fetches tournament snapshot from `/api/tournament`
- Public votes are sent to `/api/vote`
- Realtime subscriptions listen to Appwrite document updates
- Admin signs in via Appwrite Auth and advances rounds via `/api/admin/advance`

Tie handling is deterministic: if votes are equal, the winner is chosen by lexicographic comparison of item names.
