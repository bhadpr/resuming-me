#!/usr/bin/env python3
"""Build the NBA, NHL, MLB, and MLS schedule migration and team roster."""

import csv
import hashlib
import os
import re
import unicodedata
import uuid

ROOT = "/Users/bhadresh/Downloads/leagues-schedules-2026-27"
OUT_SQL = "supabase/migrations/20261119120000_us_league_schedules.sql"
OUT_TEAMS = "src/lib/leagueTeamsData.ts"
OUT_TITLES = "worker/leagueTitles.ts"

LEAGUES = ("nba", "nhl", "mlb", "mls")
PALETTE = [
    ("#0C2340", "#C4CED4", "#fff"),
    ("#1D428A", "#FFC72C", "#fff"),
    ("#007A33", "#BA9653", "#fff"),
    ("#CE1141", "#111111", "#fff"),
    ("#860038", "#FDBB30", "#fff"),
    ("#00538C", "#B8C4CA", "#fff"),
    ("#E03A3E", "#1D428A", "#fff"),
    ("#002B5C", "#E31837", "#fff"),
    ("#5A2D81", "#FDB927", "#fff"),
    ("#00471B", "#EEE1C6", "#fff"),
    ("#C8102E", "#0C2340", "#fff"),
    ("#F58426", "#111111", "#fff"),
]


def fold(value: str) -> str:
    text = unicodedata.normalize("NFKD", value)
    text = "".join(ch for ch in text if not unicodedata.combining(ch))
    return re.sub(r"\s+", " ", text).strip().lower()


def stable_id(seed: str) -> str:
    digest = bytearray(hashlib.sha256(seed.encode()).digest()[:16])
    digest[6] = (digest[6] & 0x0F) | 0x50
    digest[8] = (digest[8] & 0x3F) | 0x80
    return str(uuid.UUID(bytes=bytes(digest)))


def sql_text(value: str) -> str:
    return "'" + value.replace("'", "''") + "'"


def sql_array(keys: list[str]) -> str:
    parts = ['"' + key.replace("\\", "\\\\").replace('"', '\\"') + '"' for key in keys]
    return "'{" + ",".join(parts) + "}'"


def parse_date(value: str) -> str:
    month, day, year = value.strip().split("/")
    return f"{int(year):04d}-{int(month):02d}-{int(day):02d}"


def parse_time(value: str) -> tuple[str, str]:
    text = value.strip()
    if not text or text.upper() == "TBD":
        return "null", "null"
    match = re.fullmatch(r"(\d{1,2}):(\d{2})\s*([AP]M)", text, re.I)
    if not match:
        raise SystemExit(f"bad time {value!r}")
    hour = int(match.group(1))
    minute = int(match.group(2))
    meridiem = match.group(3).upper()
    if hour == 12:
        hour = 0
    if meridiem == "PM":
        hour += 12
    return str(hour), str(minute)


def abbr_for(raw_keys: list[str], name: str) -> str:
    codes = [key for key in raw_keys if re.fullmatch(r"[A-Z0-9]{2,4}", key)]
    codes.sort(key=lambda code: (0 if len(code) >= 3 else 1, -len(code)))
    if codes:
        return codes[0]
    words = re.findall(r"[A-Za-z0-9]+", name)
    if len(words) >= 2:
        return (words[0][0] + words[-1][0]).upper()
    return fold(name)[:3].upper()


def team_of(rows: list[dict]) -> str:
    names = {row["Team 1 (home)"] for row in rows} | {row["Team 2 (away)"] for row in rows}
    always = [
        name
        for name in names
        if name and all(name in (row["Team 1 (home)"], row["Team 2 (away)"]) for row in rows)
    ]
    if len(always) != 1:
        raise SystemExit(f"could not name a team: {always}")
    return always[0]


def keys_for(rows: list[dict], team: str) -> tuple[list[str], list[str]]:
    folded_team = fold(team)
    for row in rows:
        raw = [part.strip() for part in (row.get("Search keys") or "").split(";") if part.strip()]
        folded = []
        seen = set()
        for part in raw:
            key = fold(part)
            if not key or key in seen:
                continue
            if not re.fullmatch(r"[a-z0-9.]+( [a-z0-9.]+)*", key):
                continue
            seen.add(key)
            folded.append(key)
        if folded_team in folded:
            if folded_team not in folded[:20]:
                folded = [folded_team] + [key for key in folded if key != folded_team]
            return folded[:20], raw
    raise SystemExit(f"no search keys for {team}")


def label_for(team: str, row: dict) -> str:
    home = row["Team 1 (home)"].strip()
    away = row["Team 2 (away)"].strip()
    if home == team:
        label = f"{team} vs {away}"
    elif away == team:
        label = f"{team} at {home}"
    else:
        raise SystemExit(f"{team} missing from {home} / {away}")
    kind = row["Type"].strip()
    if kind and kind.lower() != "regular season":
        extra = f" · {kind}"
        if len(label + extra) <= 120:
            label += extra
    if not 1 <= len(label) <= 120:
        raise SystemExit(f"bad label length {len(label)}: {label}")
    return label


def load() -> dict:
    leagues = {}
    for league in LEAGUES:
        folder = os.path.join(ROOT, league, "teams")
        teams = []
        for filename in sorted(os.listdir(folder)):
            if not filename.endswith(".csv"):
                continue
            path = os.path.join(folder, filename)
            with open(path, newline="", encoding="utf-8") as handle:
                rows = list(csv.DictReader(handle))
            if not rows:
                continue
            team = team_of(rows)
            keys, raw_keys = keys_for(rows, team)
            games = []
            for index, row in enumerate(rows):
                label = label_for(team, row)
                day = parse_date(row["Date"])
                hour, minute = parse_time(row["Time"])
                games.append((label, day, hour, minute, index))
            teams.append({"name": team, "keys": keys, "abbr": abbr_for(raw_keys, team), "games": games})
        teams.sort(key=lambda item: fold(item["name"]))
        leagues[league] = teams
    return leagues


def write_sql(leagues: dict) -> None:
    lines = [
        "-- NBA, NHL, MLB, and MLS remaining games. Search keys find a team.",
        "-- Kickoff is Pacific; phones shift it. TBD games have a day and no clock.",
        "-- A season is longer than the old 40-item list and the old 100-reminder list.",
        "",
        "create or replace function public.shared_list_items_cap()",
        "returns trigger",
        "language plpgsql",
        "as $$",
        "begin",
        "  if (select count(*) from public.shared_list_items where list_id = new.list_id) >= 200 then",
        "    raise exception 'shared_list_full' using errcode = 'P0001';",
        "  end if;",
        "  return new;",
        "end;",
        "$$;",
        "",
        "create or replace function public.reminders_enforce_open_cap()",
        "returns trigger",
        "language plpgsql",
        "as $$",
        "begin",
        "  if new.done_at is null and (",
        "    select count(*) from public.reminders",
        "    where user_id = new.user_id and done_at is null",
        "  ) >= 200 then",
        "    raise exception 'reminders_open_cap' using errcode = 'P0001';",
        "  end if;",
        "  return new;",
        "end;",
        "$$;",
        "",
        "insert into public.shared_lists (id, title, status, remind_before, zip_codes, search_keys, time_zone)",
        "values",
    ]
    list_rows = []
    item_rows = []
    for league, teams in leagues.items():
        for team in teams:
            list_id = stable_id(f"resuming-{league}:{team['name']}")
            color_index = int(hashlib.sha256(team["name"].encode()).hexdigest()[:2], 16) % len(PALETTE)
            team["id"] = list_id
            team["color"] = PALETTE[color_index]
            list_rows.append(
                "  ("
                + ", ".join(
                    [
                        sql_text(list_id),
                        sql_text(team["name"]),
                        "'active'",
                        "false",
                        "'{}'",
                        sql_array(team["keys"]),
                        "'America/Los_Angeles'",
                    ]
                )
                + ")"
            )
            for label, day, hour, minute, index in team["games"]:
                item_id = stable_id(f"resuming-{league}-item:{list_id}:{index}:{label}")
                item_rows.append(
                    "  ("
                    + ", ".join(
                        [
                            sql_text(item_id),
                            sql_text(list_id),
                            sql_text(label),
                            sql_text(day),
                            hour,
                            minute,
                            str(index),
                        ]
                    )
                    + ")"
                )
    lines.append(",\n".join(list_rows))
    lines.append("on conflict (id) do nothing;")
    lines.append("")
    chunk = 300
    for start in range(0, len(item_rows), chunk):
        lines.append(
            "insert into public.shared_list_items (id, list_id, text, day, hour, minute, sort_order)"
        )
        lines.append("values")
        lines.append(",\n".join(item_rows[start : start + chunk]))
        lines.append("on conflict (id) do nothing;")
        lines.append("")
    with open(OUT_SQL, "w", encoding="utf-8") as handle:
        handle.write("\n".join(lines))
    print(f"sql lists {len(list_rows)} items {len(item_rows)}")


def ts_string(value: str) -> str:
    return "'" + value.replace("\\", "\\\\").replace("'", "\\'") + "'"


def write_teams(leagues: dict) -> None:
    lines = [
        "/** Generated from the 2026-27 league sheets. Search keys match the stored lists. */",
        "",
        "export type LeagueId = 'nba' | 'nhl' | 'mlb' | 'mls'",
        "",
        "export type LeagueTeam = {",
        "  name: string",
        "  keys: readonly string[]",
        "  abbr: string",
        "  color: string",
        "  accent: string",
        "  ink: string",
        "}",
        "",
        "export const LEAGUE_TEAMS: Record<LeagueId, readonly LeagueTeam[]> = {",
    ]
    for league, teams in leagues.items():
        lines.append(f"  {league}: [")
        for team in teams:
            color, accent, ink = team["color"]
            keys = ", ".join(ts_string(key) for key in team["keys"])
            lines.append(
                "    { name: "
                + ts_string(team["name"])
                + f", keys: [{keys}], abbr: {ts_string(team['abbr'])}, color: '{color}', accent: '{accent}', ink: '{ink}' }},"
            )
        lines.append("  ],")
    lines.append("}")
    lines.append("")
    with open(OUT_TEAMS, "w", encoding="utf-8") as handle:
        handle.write("\n".join(lines))


def write_titles(leagues: dict) -> None:
    lines = [
        "/** Team titles for link previews. Generated with the league schedules. */",
        "",
    ]
    for league, teams in leagues.items():
        lines.append(f"export const {league.upper()}_TITLES = new Set([")
        for team in teams:
            lines.append(f"  {ts_string(team['name'])},")
        lines.append("])")
        lines.append("")
    with open(OUT_TITLES, "w", encoding="utf-8") as handle:
        handle.write("\n".join(lines))


def main() -> None:
    leagues = load()
    for league, teams in leagues.items():
        counts = [len(team["games"]) for team in teams]
        print(league, len(teams), "games", min(counts), max(counts))
    write_sql(leagues)
    write_teams(leagues)
    write_titles(leagues)


if __name__ == "__main__":
    main()
