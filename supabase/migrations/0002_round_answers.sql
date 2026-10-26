-- =====================================================================
-- Misi Hijau Temon — Tahap 2, migrasi 0002
--
-- Perubahan alur ronde:
--   0001: klien mengirim 10 jawaban sekaligus -> tidak ada umpan balik
--         per soal, karena kunci jawaban tidak boleh dikirim lebih awal.
--   0002: klien mengirim jawaban SATU PER SATU. Server membalas benar/salah
--         untuk soal yang BARU SAJA dijawab, jadi anak tetap dapat umpan
--         balik instan, tetapi kunci soal berikutnya tidak pernah bocor.
--
--   Akibatnya: submit_round() dihapus, diganti submit_answer() + finish_round().
-- =====================================================================

create table public.round_answers (
  round_id    uuid not null references public.rounds(id) on delete cascade,
  item_id     text not null references public.game_items(id),
  bin         text not null check (bin in ('organik','anorganik','b3')),
  correct     boolean not null,
  answered_at timestamptz not null default now(),
  primary key (round_id, item_id)
);

create index round_answers_round on public.round_answers (round_id);

alter table public.round_answers enable row level security;
revoke all on public.round_answers from anon, authenticated;

-- Jalur tulis lama ditutup supaya hanya ada satu cara memberi XP.
drop function if exists public.submit_round(uuid, jsonb);

-- ---------------------------------------------------------------------
-- start_round(): sekarang melanjutkan ronde terbuka bila ada, supaya
-- anak yang tidak sengaja menutup tab tidak kehilangan jatah harian.
-- ---------------------------------------------------------------------
create or replace function public.start_round()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid      uuid := auth.uid();
  v_season   uuid;
  v_round    public.rounds%rowtype;
  v_rounds   int;
  v_xp_today int;
  v_items    text[];
  v_answered jsonb;
  v_rounds_max constant int := 5;
  v_xp_max     constant int := 300;
begin
  if v_uid is null then
    raise exception 'AUTH_REQUIRED' using errcode = 'P0001';
  end if;

  if not exists (select 1 from public.profiles where id = v_uid) then
    raise exception 'PROFILE_REQUIRED' using errcode = 'P0001';
  end if;

  -- 1. Lanjutkan ronde yang masih terbuka dan belum kedaluwarsa.
  select * into v_round
  from public.rounds
  where user_id = v_uid and status = 'open' and expires_at > now()
  order by started_at desc
  limit 1;

  if found then
    select coalesce(jsonb_agg(jsonb_build_object(
             'item_id', a.item_id, 'bin', a.bin, 'correct', a.correct
           )), '[]'::jsonb)
      into v_answered
    from public.round_answers a
    where a.round_id = v_round.id;

    return jsonb_build_object(
      'round_id',   v_round.id,
      'resumed',    true,
      'started_at', v_round.started_at,
      'expires_at', v_round.expires_at,
      'items', (
        select jsonb_agg(jsonb_build_object('id', i.id, 'name', i.name, 'emoji', i.emoji)
                         order by t.ord)
        from unnest(v_round.item_ids) with ordinality as t(id, ord)
        join public.game_items i on i.id = t.id
      ),
      'answered', v_answered
    );
  end if;

  -- 2. Ronde baru: periksa kuota harian.
  select count(*) into v_rounds
  from public.rounds
  where user_id = v_uid and started_at >= public.day_start_ts();

  if v_rounds >= v_rounds_max then
    raise exception 'DAILY_ROUNDS_LIMIT' using errcode = 'P0001';
  end if;

  select coalesce(sum(amount), 0) into v_xp_today
  from public.xp_events
  where user_id = v_uid and created_at >= public.day_start_ts();

  if v_xp_today >= v_xp_max then
    raise exception 'DAILY_XP_LIMIT' using errcode = 'P0001';
  end if;

  v_season := public.ensure_current_season();

  select array_agg(s.id) into v_items
  from (select id from public.game_items where active order by random() limit 10) s;

  if coalesce(array_length(v_items, 1), 0) < 10 then
    raise exception 'NOT_ENOUGH_ITEMS' using errcode = 'P0001';
  end if;

  insert into public.rounds (user_id, season_id, item_ids, expires_at)
  values (v_uid, v_season, v_items, now() + interval '15 minutes')
  returning * into v_round;

  return jsonb_build_object(
    'round_id',   v_round.id,
    'resumed',    false,
    'started_at', v_round.started_at,
    'expires_at', v_round.expires_at,
    'items', (
      select jsonb_agg(jsonb_build_object('id', i.id, 'name', i.name, 'emoji', i.emoji)
                       order by t.ord)
      from unnest(v_items) with ordinality as t(id, ord)
      join public.game_items i on i.id = t.id
    ),
    'answered', '[]'::jsonb
  );
end;
$$;

-- ---------------------------------------------------------------------
-- submit_answer(): catat satu jawaban, balas benar/salah untuk soal itu.
-- Jawaban yang sudah tercatat tidak bisa diubah (idempotent).
-- ---------------------------------------------------------------------
create or replace function public.submit_answer(
  p_round_id uuid,
  p_item_id  text,
  p_bin      text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid   uuid := auth.uid();
  v_round public.rounds%rowtype;
  v_item  public.game_items%rowtype;
  v_row   public.round_answers%rowtype;
  v_n     int;
  v_total int;
begin
  if v_uid is null then
    raise exception 'AUTH_REQUIRED' using errcode = 'P0001';
  end if;

  select * into v_round from public.rounds where id = p_round_id and user_id = v_uid;
  if not found then
    raise exception 'ROUND_NOT_FOUND' using errcode = 'P0001';
  end if;

  if v_round.status <> 'open' then
    raise exception 'ROUND_CLOSED' using errcode = 'P0001';
  end if;

  if now() > v_round.expires_at then
    raise exception 'ROUND_EXPIRED' using errcode = 'P0001';
  end if;

  if not (p_item_id = any(v_round.item_ids)) then
    raise exception 'BAD_ITEM' using errcode = 'P0001';
  end if;

  if p_bin not in ('organik','anorganik','b3') then
    raise exception 'BAD_BIN' using errcode = 'P0001';
  end if;

  v_total := array_length(v_round.item_ids, 1);
  select * into v_item from public.game_items where id = p_item_id;

  -- Sudah dijawab: kembalikan hasil yang tercatat, jangan hitung ulang.
  select * into v_row from public.round_answers
   where round_id = p_round_id and item_id = p_item_id;

  if found then
    select count(*) into v_n from public.round_answers where round_id = p_round_id;
    return jsonb_build_object(
      'correct', v_row.correct, 'correct_bin', v_item.correct_bin,
      'reason', v_item.reason, 'answered', v_n, 'total', v_total,
      'repeated', true
    );
  end if;

  insert into public.round_answers (round_id, item_id, bin, correct)
  values (p_round_id, p_item_id, p_bin, (v_item.correct_bin = p_bin));

  select count(*) into v_n from public.round_answers where round_id = p_round_id;

  return jsonb_build_object(
    'correct', (v_item.correct_bin = p_bin),
    'correct_bin', v_item.correct_bin,
    'reason', v_item.reason,
    'answered', v_n, 'total', v_total,
    'repeated', false
  );
end;
$$;

-- ---------------------------------------------------------------------
-- finish_round(): nilai ronde dari jawaban yang sudah tercatat.
-- Satu-satunya tempat XP diberikan.
-- ---------------------------------------------------------------------
create or replace function public.finish_round(p_round_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid      uuid := auth.uid();
  v_round    public.rounds%rowtype;
  v_total    int;
  v_n        int;
  v_correct  int;
  v_xp_raw   int;
  v_xp       int;
  v_xp_today int;
  v_elapsed  numeric;
  v_detail   jsonb;
  v_xp_total int;
begin
  if v_uid is null then
    raise exception 'AUTH_REQUIRED' using errcode = 'P0001';
  end if;

  select * into v_round from public.rounds where id = p_round_id and user_id = v_uid;
  if not found then
    raise exception 'ROUND_NOT_FOUND' using errcode = 'P0001';
  end if;

  -- Sudah pernah dinilai: kembalikan hasil lama, XP tidak bertambah.
  if v_round.status = 'scored' then
    select coalesce(sum(amount), 0) into v_xp_total
    from public.xp_events where user_id = v_uid;

    return jsonb_build_object(
      'already_scored', true, 'score', v_round.score, 'xp', v_round.xp_awarded,
      'xp_total', v_xp_total, 'detail', v_round.detail, 'total', v_round.score
    );
  end if;

  if now() > v_round.expires_at then
    raise exception 'ROUND_EXPIRED' using errcode = 'P0001';
  end if;

  v_total := array_length(v_round.item_ids, 1);

  select count(*), count(*) filter (where correct)
    into v_n, v_correct
  from public.round_answers where round_id = p_round_id;

  if v_n < v_total then
    raise exception 'NOT_COMPLETE' using errcode = 'P0001';
  end if;

  v_elapsed := extract(epoch from (now() - v_round.started_at));
  if v_elapsed < 8 then
    raise exception 'TOO_FAST' using errcode = 'P0001';
  end if;

  v_xp_raw := least(v_correct * 10 + (case when v_correct >= 9 then 20 else 0 end), 120);

  select coalesce(sum(amount), 0) into v_xp_today
  from public.xp_events
  where user_id = v_uid and created_at >= public.day_start_ts();

  v_xp := greatest(0, least(v_xp_raw, 300 - v_xp_today));

  select jsonb_agg(jsonb_build_object(
           'item_id', i.id, 'name', i.name, 'emoji', i.emoji,
           'picked', a.bin, 'correct_bin', i.correct_bin,
           'correct', a.correct, 'reason', i.reason
         ) order by a.answered_at)
    into v_detail
  from public.round_answers a
  join public.game_items i on i.id = a.item_id
  where a.round_id = p_round_id;

  -- Constraint unik di round_id mencegah XP ganda.
  insert into public.xp_events (user_id, round_id, season_id, amount)
  values (v_uid, p_round_id, v_round.season_id, v_xp)
  on conflict (round_id) do nothing;

  if not found then
    select * into v_round from public.rounds where id = p_round_id;
    select coalesce(sum(amount), 0) into v_xp_total
    from public.xp_events where user_id = v_uid;

    return jsonb_build_object(
      'already_scored', true, 'score', v_round.score, 'xp', v_round.xp_awarded,
      'xp_total', v_xp_total, 'detail', v_round.detail, 'total', v_total
    );
  end if;

  update public.rounds
     set status = 'scored', score = v_correct, xp_awarded = v_xp, detail = v_detail
   where id = p_round_id;

  select coalesce(sum(amount), 0) into v_xp_total
  from public.xp_events where user_id = v_uid;

  return jsonb_build_object(
    'already_scored', false,
    'score', v_correct, 'total', v_total,
    'xp', v_xp, 'xp_raw', v_xp_raw, 'capped', (v_xp < v_xp_raw),
    'xp_total', v_xp_total, 'detail', v_detail
  );
end;
$$;

revoke all on function public.start_round()                     from public, anon, authenticated;
revoke all on function public.submit_answer(uuid, text, text)   from public, anon, authenticated;
revoke all on function public.finish_round(uuid)                from public, anon, authenticated;

grant execute on function public.start_round()                   to authenticated;
grant execute on function public.submit_answer(uuid, text, text) to authenticated;
grant execute on function public.finish_round(uuid)              to authenticated;
