# Schedule Sync – Plan

Status: **plan only, not started** (written Oct 27, 2026)

Goal: a scheduled GitHub Actions job keeps the Community Calendar schedule lists (NFL, NBA, NHL, MLB, MLS, cricket, and later schools) up to date in Supabase. Each run pulls the source schedules, compares them with `shared_list_items`, and updates only what changed. Every change is logged, and the job stops itself if a source looks broken.

---

## 1. How the data works today

- **`shared_lists`**: one row per team or district (`title`, `search_keys`, `zip_codes`, `time_zone = 'America/Los_Angeles'`, `remind_before`).
- **`shared_list_items`**: one row per game or holiday (`text`, `day`, `hour`, `minute` in Pacific, `sort_order`). Cap is 200 items per list (`shared_list_items_cap`).
- **Lists were loaded as one-off SQL migrations**, built by scripts such as `scripts/gen-leagues.py` (`20261113…nfl`, `20261115…us_school_calendars`, `20261116/17…cricket`, `20261119…us_league_schedules`).
- **Phones already follow lists** (`src/lib/followedLists.ts → planFollowedListRefresh`). A reminder copied from a list keeps `shared_list_item_id`. When the app opens:
  - item text, day or time changed → the phone updates the reminder
  - item gone → the phone **deletes the reminder**
  - new future item → the phone adds it

  So the sync only needs to keep `shared_list_items` correct. Users' phones pick up the changes on their own.

## 2. Constraints the sync must respect

1. **Item ids currently include the item's position.** `gen-leagues.py` builds ids as `stable_id(f"resuming-{league}-item:{list_id}:{index}:{label}")`. Rebuilding ids that way would shift them whenever a game is added, so phones would see every item as removed and re-added. **The sync must match on a real game key and keep the existing item id.**
2. **Deleting an item deletes users' reminders.** Never delete past items. Only delete a future item after it has been missing on two runs in a row. Keep the safety brake strict.
3. **Item text must match the current generators exactly.** Examples: `Seattle Sounders FC at Vancouver Whitecaps FC`, `CF Montréal vs Vancouver Whitecaps FC · Regular season - Decision Day`, `India at New Zealand · ODI (1st of 5)`. Otherwise the first run would count every row as changed.
4. **Times are stored as Pacific day/hour/minute.** Convert from the feed's UTC with `America/Los_Angeles`. TBD games have a `day` and null `hour`/`minute`.

## 3. Database migration: `supabase/migrations/2026112x_schedule_sync.sql`

```sql
alter table public.shared_list_items
  add column if not exists source_key text;            -- 'mlb:776512', 'nhl:2026020145', 'nfl:401772…'
create unique index if not exists shared_list_items_source_key
  on public.shared_list_items (list_id, source_key) where source_key is not null;

alter table public.shared_lists
  add column if not exists source text;                 -- 'nfl','nba','nhl','mlb','mls','cricket'; null = manual list

create table public.schedule_sync_runs (
  id bigserial primary key,
  source text not null,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  status text not null,                                  -- ok | held | failed | dry_run
  added int not null default 0,
  changed int not null default 0,
  removed int not null default 0,
  note text
);

create table public.schedule_sync_changes (
  id bigserial primary key,
  run_id bigint references public.schedule_sync_runs (id) on delete cascade,
  list_id uuid,
  item_id uuid,
  change text not null,                                  -- added | changed | removed | missing_once
  old_value jsonb,
  new_value jsonb,
  created_at timestamptz not null default now()
);

alter table public.schedule_sync_runs enable row level security;
alter table public.schedule_sync_changes enable row level security;
-- no public policies: only the service role (the job) and admins read these
```

Also set `shared_lists.source` for the existing team lists, keyed by league.

## 4. The job (TypeScript, same stack as the repo)

```
sync/
  run.ts              # npx tsx sync/run.ts --source mlb [--dry-run]
  adapters/
    mlb.ts  nhl.ts  nba.ts  nfl.ts  mls.ts  (cricket.ts later)
  format.ts           # item text, identical to gen-leagues.py / NFL / cricket generators
  match.ts            # one-time backfill of source_key on existing items
  diff.ts
  apply.ts
```

**Adapters** each return `{ key, startUtc, timeTbd, home, away, venue, type }[]`:

| Source | Feed | Key |
|---|---|---|
| MLB | `https://statsapi.mlb.com/api/v1/schedule?sportId=1&season=2027&gameType=R` | `gamePk` |
| NHL | `https://api-web.nhle.com/v1/club-schedule-season/{TEAM}/20262027` (per team) | game `id` |
| NBA | `https://cdn.nba.com/static/json/staticData/scheduleLeagueV2.json` | `gameId` |
| NFL | `https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?dates=YYYYMMDD` | ESPN event `id` |
| MLS | `https://site.api.espn.com/apis/site/v2/sports/soccer/usa.1/scoreboard?dates=YYYYMMDD` | ESPN event `id` |
| Cricket | Paid/licensed API: CricketData.org (cheap; free tier to start), EntitySport/Roanuz, or Sportradar | provider match id |

Notes:
- These league feeds are public but mostly undocumented, so they can change without notice. The safety brake below protects against that. Check each league's terms; Sportradar is the licensed all-in-one option if needed.
- **Don't use ESPNcricinfo.** There's no public API, it blocks automated traffic, and its terms bar reuse in a commercial app.

**For each list where `shared_lists.source = <league>`:**
1. Select that team's games from the feed.
2. Convert `startUtc` to Pacific `day`/`hour`/`minute` (TBD: day only).
3. Build `text` with `format.ts`.
4. Diff against the list's current items by `source_key`:
   - **same key, different text/day/hour/minute** → `UPDATE` in place (same id, so phones update their copies)
   - **new key** → `INSERT` with `id = stable_id('<league>:<key>')` (stable forever)
   - **future item missing from feed** → first run: log `missing_once`; second consecutive run: `DELETE`
   - **past items** → never touched
   - **items without `source_key`** (not yet backfilled) → left alone
5. Renumber `sort_order` by date.
6. Write `schedule_sync_runs` and `schedule_sync_changes`.

## 5. Safety brake

The job doesn't write anything and records the run as `held` with a reason when any of these happens:
- the feed returns 0 games, or fewer than expected for the season window
- one list would lose more than 3 items in a run
- more than 15% of a league's future items would change in one run
- it would push a list over the 200-item cap

`--dry-run` prints the full diff and only writes a `dry_run` row.

## 6. One-time backfill (`sync/match.ts`)

- Matches each existing item to a feed game by list (team), Pacific date and opponent. Doubleheaders are matched by time. Then sets `source_key`.
- Prints the items it couldn't match, for manual review. Those stay manual until fixed.
- Run it once per league before turning writes on.

## 7. Workflow: `.github/workflows/schedule-sync.yml`

```yaml
name: schedule-sync
on:
  schedule:
    - cron: "17 11 * * *"     # daily ~4am PT
  workflow_dispatch:
    inputs:
      dry_run: { type: boolean, default: true }
jobs:
  sync:
    runs-on: ubuntu-latest
    strategy:
      fail-fast: false
      matrix:
        source: [mlb, nhl, nba, nfl, mls]
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22 }
      - run: npm ci
      - run: npx tsx sync/run.ts --source ${{ matrix.source }} ${{ inputs.dry_run && '--dry-run' || '' }}
        env:
          SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
          SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}
```

- **Secrets:** `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`. The service role is needed because `shared_list_items` writes are admin-only under RLS.
- **Run summary:** each run writes a short summary to `$GITHUB_STEP_SUMMARY`, e.g. "MLB: 3 time changes, 1 added, 0 removed". Slack/email ping later.
- **NFL in season:** run twice daily from late November, when flexed games move.
- **Alternative:** a Cloudflare Worker cron trigger (the repo already has `worker/`). GitHub Actions is simpler to debug, so start there.

## 8. Cadence

| Source | Frequency |
|---|---|
| MLB, NHL, NBA, MLS | Daily |
| NFL | Daily; twice daily from late Nov (flex scheduling) |
| Cricket | Daily during series, weekly otherwise |
| Schools | Weekly hash check of each district calendar page/PDF. Only changed ones get re-extracted (AI-assisted), then go to **manual review**, not straight into the database. |

## 9. Rollout

| Week | Work |
|---|---|
| 1 | Migration, backfill, MLB + NHL adapters, workflow in **dry-run only**. Check the diffs against reality daily. |
| 2 | Turn writes on for MLB/NHL. Add NBA, NFL, MLS (dry run first, then live). |
| 3 | Pick a cricket provider, add `cricket.ts`. Small admin view of `schedule_sync_changes`. |
| Later | Schools through the same `diff.ts`/`apply.ts`, with a review step. New-season lists still come from the generator scripts; after that the sync maintains them. |

## 10. To decide when we pick this up

- [ ] Cricket data provider (CricketData.org vs EntitySport/Roanuz vs Sportradar)
- [ ] GitHub Actions vs Cloudflare Worker cron (default: Actions)
- [ ] Notify users on major changes (date moved), or let the silent follow-update be enough?
- [ ] Where Bhadresh reviews held runs and school changes (Actions summary, admin page, email)
