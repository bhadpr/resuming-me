-- A habit's own follow-along video: a YouTube id and an optional start, played in YouTube's player.
-- Empty means the built-in video for that habit, if it has one.

alter table public.activities
  add column if not exists video_youtube_id text,
  add column if not exists video_start_seconds integer;

alter table public.activities
  drop constraint if exists activities_video_youtube_id_format,
  add constraint activities_video_youtube_id_format
    check (video_youtube_id is null or video_youtube_id ~ '^[A-Za-z0-9_-]{11}$');

alter table public.activities
  drop constraint if exists activities_video_start_range,
  add constraint activities_video_start_range
    check (
      video_start_seconds is null
      or (video_youtube_id is not null and video_start_seconds between 1 and 86400)
    );
