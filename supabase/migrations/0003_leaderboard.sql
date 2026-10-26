-- =====================================================================
-- Misi Hijau Temon — Tahap 3, migrasi 0003
--
-- Papan peringkat mingguan per liga.
--
-- Batasan privasi:
--   - tidak mengembalikan id pengguna maupun kode pemain;
--   - hanya nama panggilan, avatar, dan jumlah Bintang Hijau;
--   - profil dengan hidden = true tidak pernah muncul.
--
-- Peringkat hanya berisi pemain yang punya poin pada musim berjalan,
-- supaya akun yang dibuat lalu ditinggalkan tidak memenuhi papan.
-- =====================================================================

create or replace function public.get_leaderboard(
  p_league text,
  p_limit  int default 20
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid    uuid := auth.uid();
  v_season public.seasons%rowtype;
  v_top    jsonb;
  v_me     jsonb;
  v_total  int;
  v_limit  int := greatest(1, least(coalesce(p_limit, 20), 100));
begin
  if v_uid is null then
    raise exception 'AUTH_REQUIRED' using errcode = 'P0001';
  end if;

  if p_league not in ('tunas','penjelajah','pelindung') then
    raise exception 'BAD_LEAGUE' using errcode = 'P0001';
  end if;

  select * into v_season from public.seasons where id = public.ensure_current_season();

  with skor as (
    select p.id,
           p.nickname,
           p.avatar_id,
           sum(e.amount)      as xp,
           min(e.created_at)  as first_at
    from public.profiles p
    join public.xp_events e
      on e.user_id = p.id and e.season_id = v_season.id
    where p.league = p_league and p.hidden = false
    group by p.id, p.nickname, p.avatar_id
  ), ranked as (
    select skor.*,
           row_number() over (
             order by xp desc, first_at asc, nickname asc
           ) as rn
    from skor
  )
  select
    (select coalesce(
              jsonb_agg(
                jsonb_build_object(
                  'rank', rn, 'nickname', nickname,
                  'avatar_id', avatar_id, 'xp', xp
                ) order by rn
              ) filter (where rn <= v_limit),
              '[]'::jsonb)
       from ranked),
    (select count(*) from ranked),
    (select jsonb_build_object(
              'rank', rn, 'xp', xp, 'in_top', (rn <= v_limit)
            )
       from ranked where id = v_uid)
  into v_top, v_total, v_me;

  return jsonb_build_object(
    'league',         p_league,
    'season_label',   v_season.label,
    'season_ends_at', v_season.ends_at,
    'total_players',  v_total,
    'top',            v_top,
    'me',             v_me
  );
end;
$$;

revoke all on function public.get_leaderboard(text, int) from public, anon, authenticated;
grant execute on function public.get_leaderboard(text, int) to authenticated;
