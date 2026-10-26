-- =====================================================================
-- Misi Hijau Temon — Tahap 2
-- Skema, RLS, dan fungsi validasi XP di server.
--
-- Prinsip (lihat arsitektur §6):
--   1. Browser tidak pernah mengirim angka XP. Browser mengirim jawaban.
--   2. Kunci jawaban (game_items.correct_bin) tidak pernah bisa dibaca klien.
--   3. Hanya satu jalur tulis ke xp_events: submit_round(), dan hanya sekali
--      per ronde (constraint unik di xp_events.round_id).
-- =====================================================================

create extension if not exists pgcrypto;

-- --------------------------------------------------------------- tabel

create table public.nickname_words (
  word   text primary key,
  active boolean not null default true
);

create table public.avatars (
  id    text primary key,
  emoji text not null,
  sort  int  not null default 0
);

create table public.game_items (
  id          text primary key,
  name        text not null,
  emoji       text not null,
  correct_bin text not null check (correct_bin in ('organik','anorganik','b3')),
  reason      text not null,
  active      boolean not null default true
);

create table public.seasons (
  id        uuid primary key default gen_random_uuid(),
  starts_at timestamptz not null unique,
  ends_at   timestamptz not null,
  label     text not null
);

create table public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  public_code text not null unique,
  nickname    text not null,
  avatar_id   text not null references public.avatars(id),
  league      text not null check (league in ('tunas','penjelajah','pelindung')),
  hidden      boolean not null default false,
  created_at  timestamptz not null default now(),
  constraint nickname_len check (char_length(nickname) between 4 and 32)
);

create table public.rounds (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  season_id  uuid not null references public.seasons(id),
  item_ids   text[] not null,
  started_at timestamptz not null default now(),
  expires_at timestamptz not null,
  status     text not null default 'open' check (status in ('open','scored')),
  score      int,
  xp_awarded int,
  detail     jsonb
);

create index rounds_user_started on public.rounds (user_id, started_at desc);

create table public.xp_events (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  round_id   uuid not null unique references public.rounds(id) on delete cascade,
  season_id  uuid not null references public.seasons(id),
  amount     int not null check (amount between 0 and 120),
  created_at timestamptz not null default now()
);

create index xp_events_user_season on public.xp_events (user_id, season_id);
create index xp_events_season on public.xp_events (season_id);

-- --------------------------------------------------------------- isi awal

insert into public.avatars (id, emoji, sort) values
  ('penyu',   '🐢', 1), ('kepiting','🦀', 2), ('ikan',   '🐟', 3),
  ('lebah',   '🐝', 4), ('bunga',   '🌻', 5), ('lumba',  '🐬', 6),
  ('kupu',    '🦋', 7), ('kelapa',  '🌴', 8), ('burung', '🐦', 9),
  ('kadal',   '🦎', 10), ('daun',   '🍀', 11), ('kerang', '🐚', 12);

insert into public.nickname_words (word) values
  ('Tunas'),('Pandan'),('Cemara'),('Bakau'),('Kepiting'),('Walet'),
  ('Mangrove'),('Padi'),('Lebah'),('Penyu'),('Cangkang'),('Bambu'),
  ('Melati'),('Kamboja'),('Rumput'),('Kerang'),('Biawak'),('Gelatik'),
  ('Jambu'),('Sawo'),('Kelor'),('Beringin'),('Bintang'),('Embun');

insert into public.game_items (id, name, emoji, correct_bin, reason) values
  ('kulit-pisang','Kulit pisang','🍌','organik','Sisa buah. Membusuk jadi pupuk.'),
  ('nasi-sisa','Nasi sisa','🍚','organik','Sisa makanan. Bisa jadi kompos.'),
  ('sisa-sayur','Sisa sayur','🥬','organik','Sisa tumbuhan. Jadi pupuk.'),
  ('daun-kering','Daun kering','🍂','organik','Bagian tumbuhan. Jadi kompos.'),
  ('cangkang-telur','Cangkang telur','🥚','organik','Sisa hewan. Hancur jadi pupuk.'),
  ('kulit-semangka','Kulit semangka','🍉','organik','Sisa buah. Jadi kompos.'),
  ('bonggol-jagung','Bonggol jagung','🌽','organik','Sisa tumbuhan. Jadi kompos.'),
  ('tulang-ikan','Tulang ikan','🐟','organik','Sisa hewan. Bisa jadi pupuk.'),
  ('tempurung','Tempurung kelapa','🥥','organik','Bagian tumbuhan. Bisa jadi arang.'),
  ('kulit-jeruk','Kulit jeruk','🍊','organik','Sisa buah. Jadi kompos.'),
  ('sekam-padi','Sekam padi','🌾','organik','Sisa panen. Bisa jadi pupuk.'),
  ('ranting','Ranting kecil','🌿','organik','Bagian tumbuhan. Jadi kompos.'),
  ('botol-plastik','Botol plastik','🥤','anorganik','Bisa didaur ulang jadi barang baru.'),
  ('kaleng-minuman','Kaleng minuman','🥫','anorganik','Logam. Bisa didaur ulang.'),
  ('koran','Koran bekas','📰','anorganik','Kertas. Bisa didaur ulang.'),
  ('kardus','Kardus','📦','anorganik','Kertas tebal. Bisa didaur ulang.'),
  ('botol-kaca','Botol kaca','🍾','anorganik','Kaca. Bisa dilebur jadi baru.'),
  ('kantong-plastik','Kantong plastik','🛍️','anorganik','Plastik. Bisa dipakai ulang.'),
  ('gelas-plastik','Gelas plastik','🥛','anorganik','Plastik. Bisa didaur ulang.'),
  ('botol-sabun','Botol sabun','🧴','anorganik','Plastik. Kosongkan lalu daur ulang.'),
  ('kain-perca','Kain perca','👕','anorganik','Kain. Bisa jadi lap atau kerajinan.'),
  ('sendok-plastik','Sendok plastik','🥄','anorganik','Plastik. Buang ke anorganik.'),
  ('kertas-hvs','Kertas bekas','📄','anorganik','Kertas. Bisa didaur ulang.'),
  ('kaleng-biskuit','Kaleng biskuit','🍪','anorganik','Logam. Bisa didaur ulang.'),
  ('baterai','Baterai bekas','🔋','b3','Berbahaya. Kumpulkan di tempat khusus.'),
  ('lampu','Lampu bekas','💡','b3','Bahan berbahaya. Minta bantuan orang dewasa.'),
  ('obat','Obat kedaluwarsa','💊','b3','Jangan dibuang sembarangan. Minta bantuan orang dewasa.'),
  ('pestisida','Botol pestisida','🧪','b3','Racun. Jangan disentuh. Minta bantuan orang dewasa.'),
  ('termometer','Termometer bekas','🌡️','b3','Bahan berbahaya. Serahkan ke tempat khusus.'),
  ('kaleng-cat','Kaleng cat sisa','🎨','b3','Bahan kimia. Minta bantuan orang dewasa.'),
  ('hp-rusak','HP rusak','📱','b3','Sampah elektronik. Kumpulkan di tempat khusus.'),
  ('kabel','Kabel rusak','🔌','b3','Sampah elektronik. Kumpulkan di tempat khusus.'),
  ('tinta-printer','Tinta printer','🖨️','b3','Bahan kimia. Serahkan ke tempat khusus.'),
  ('obat-nyamuk','Kaleng obat nyamuk','🦟','b3','Bahan kimia. Minta bantuan orang dewasa.');

-- ------------------------------------------------------- fungsi bantu

-- Awal hari menurut WIB. Dipakai untuk batas harian.
create or replace function public.day_start_ts()
returns timestamptz
language sql
stable
set search_path = public, pg_temp
as $$
  select (date_trunc('day', now() at time zone 'Asia/Jakarta')) at time zone 'Asia/Jakarta';
$$;

-- Awal minggu (Senin) menurut WIB.
create or replace function public.week_start_ts()
returns timestamptz
language sql
stable
set search_path = public, pg_temp
as $$
  select (date_trunc('week', now() at time zone 'Asia/Jakarta')) at time zone 'Asia/Jakarta';
$$;

-- Ambil (atau buat) musim yang sedang berjalan.
create or replace function public.ensure_current_season()
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_start timestamptz := public.week_start_ts();
  v_id    uuid;
begin
  select id into v_id from public.seasons where starts_at = v_start;
  if v_id is null then
    insert into public.seasons (starts_at, ends_at, label)
    values (v_start, v_start + interval '7 days',
            to_char(v_start at time zone 'Asia/Jakarta', 'IYYY-"M"IW'))
    on conflict (starts_at) do nothing
    returning id into v_id;

    if v_id is null then
      select id into v_id from public.seasons where starts_at = v_start;
    end if;
  end if;
  return v_id;
end;
$$;

-- Buat profil. Satu-satunya jalan masuk ke tabel profiles.
create or replace function public.create_profile(
  p_nickname  text,
  p_avatar_id text,
  p_league    text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid   uuid := auth.uid();
  v_word  text;
  v_code  text;
  v_try   int := 0;
  v_row   public.profiles%rowtype;
begin
  if v_uid is null then
    raise exception 'AUTH_REQUIRED' using errcode = 'P0001';
  end if;

  -- sudah punya profil? kembalikan yang lama (idempotent)
  select * into v_row from public.profiles where id = v_uid;
  if found then
    return jsonb_build_object(
      'nickname', v_row.nickname, 'avatar_id', v_row.avatar_id,
      'league', v_row.league, 'public_code', v_row.public_code,
      'hidden', v_row.hidden, 'created', false
    );
  end if;

  if p_league not in ('tunas','penjelajah','pelindung') then
    raise exception 'BAD_LEAGUE' using errcode = 'P0001';
  end if;

  if not exists (select 1 from public.avatars where id = p_avatar_id) then
    raise exception 'BAD_AVATAR' using errcode = 'P0001';
  end if;

  -- nama wajib "Kata-99" dan katanya harus dari daftar resmi.
  if p_nickname !~ '^[A-Za-z]{3,16}-[0-9]{2}$' then
    raise exception 'BAD_NICKNAME' using errcode = 'P0001';
  end if;

  v_word := split_part(p_nickname, '-', 1);
  if not exists (
    select 1 from public.nickname_words where word = v_word and active
  ) then
    raise exception 'BAD_NICKNAME_WORD' using errcode = 'P0001';
  end if;

  -- kode pemain unik
  loop
    v_code := 'TMN-' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 4));
    exit when not exists (select 1 from public.profiles where public_code = v_code);
    v_try := v_try + 1;
    if v_try > 20 then
      raise exception 'CODE_GEN_FAILED' using errcode = 'P0001';
    end if;
  end loop;

  insert into public.profiles (id, public_code, nickname, avatar_id, league)
  values (v_uid, v_code, p_nickname, p_avatar_id, p_league);

  return jsonb_build_object(
    'nickname', p_nickname, 'avatar_id', p_avatar_id,
    'league', p_league, 'public_code', v_code,
    'hidden', false, 'created', true
  );
end;
$$;

-- Mulai satu ronde. Server yang memilih soal dan mencatat waktu mulai.
create or replace function public.start_round()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid      uuid := auth.uid();
  v_season   uuid;
  v_rounds   int;
  v_xp_today int;
  v_items    text[];
  v_round    public.rounds%rowtype;
  v_rounds_max constant int := 5;
  v_xp_max     constant int := 300;
begin
  if v_uid is null then
    raise exception 'AUTH_REQUIRED' using errcode = 'P0001';
  end if;

  if not exists (select 1 from public.profiles where id = v_uid) then
    raise exception 'PROFILE_REQUIRED' using errcode = 'P0001';
  end if;

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
  from (
    select id from public.game_items where active order by random() limit 10
  ) s;

  if coalesce(array_length(v_items, 1), 0) < 10 then
    raise exception 'NOT_ENOUGH_ITEMS' using errcode = 'P0001';
  end if;

  insert into public.rounds (user_id, season_id, item_ids, expires_at)
  values (v_uid, v_season, v_items, now() + interval '15 minutes')
  returning * into v_round;

  return jsonb_build_object(
    'round_id',   v_round.id,
    'started_at', v_round.started_at,
    'expires_at', v_round.expires_at,
    'items', (
      select jsonb_agg(jsonb_build_object(
               'id', i.id, 'name', i.name, 'emoji', i.emoji
             ) order by t.ord)
      from unnest(v_items) with ordinality as t(id, ord)
      join public.game_items i on i.id = t.id
    )
  );
end;
$$;

-- Nilai satu ronde. Satu-satunya tempat XP diberikan.
create or replace function public.submit_round(
  p_round_id uuid,
  p_answers  jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid        uuid := auth.uid();
  v_round      public.rounds%rowtype;
  v_n          int;
  v_n_distinct int;
  v_n_known    int;
  v_correct    int := 0;
  v_xp_raw     int;
  v_xp         int;
  v_xp_today   int;
  v_elapsed    numeric;
  v_detail     jsonb;
  v_xp_total   int;
begin
  if v_uid is null then
    raise exception 'AUTH_REQUIRED' using errcode = 'P0001';
  end if;

  select * into v_round from public.rounds where id = p_round_id and user_id = v_uid;
  if not found then
    raise exception 'ROUND_NOT_FOUND' using errcode = 'P0001';
  end if;

  -- Ronde sudah pernah dinilai: kembalikan hasil yang sama, XP tidak bertambah.
  if v_round.status = 'scored' then
    select coalesce(sum(amount), 0) into v_xp_total
    from public.xp_events where user_id = v_uid;

    return jsonb_build_object(
      'already_scored', true,
      'score', v_round.score,
      'xp', v_round.xp_awarded,
      'xp_total', v_xp_total,
      'detail', v_round.detail
    );
  end if;

  if now() > v_round.expires_at then
    raise exception 'ROUND_EXPIRED' using errcode = 'P0001';
  end if;

  if jsonb_typeof(p_answers) is distinct from 'array' then
    raise exception 'BAD_ANSWERS' using errcode = 'P0001';
  end if;

  select count(*), count(distinct item_id), count(*) filter (where item_id = any(v_round.item_ids))
    into v_n, v_n_distinct, v_n_known
  from jsonb_to_recordset(p_answers) as a(item_id text, bin text);

  if v_n <> coalesce(array_length(v_round.item_ids, 1), 0) then
    raise exception 'BAD_ANSWERS_COUNT' using errcode = 'P0001';
  end if;

  if v_n_distinct <> v_n then
    raise exception 'DUPLICATE_ITEM' using errcode = 'P0001';
  end if;

  if v_n_known <> v_n then
    raise exception 'BAD_ITEM' using errcode = 'P0001';
  end if;

  if exists (
    select 1 from jsonb_to_recordset(p_answers) as a(item_id text, bin text)
    where a.bin not in ('organik','anorganik','b3')
  ) then
    raise exception 'BAD_BIN' using errcode = 'P0001';
  end if;

  -- Manusia tidak mungkin menjawab 10 soal di bawah 8 detik.
  v_elapsed := extract(epoch from (now() - v_round.started_at));
  if v_elapsed < 8 then
    raise exception 'TOO_FAST' using errcode = 'P0001';
  end if;

  select count(*) into v_correct
  from jsonb_to_recordset(p_answers) as a(item_id text, bin text)
  join public.game_items i on i.id = a.item_id
  where i.correct_bin = a.bin;

  v_xp_raw := least(v_correct * 10 + (case when v_correct >= 9 then 20 else 0 end), 120);

  select coalesce(sum(amount), 0) into v_xp_today
  from public.xp_events
  where user_id = v_uid and created_at >= public.day_start_ts();

  v_xp := greatest(0, least(v_xp_raw, 300 - v_xp_today));

  select jsonb_agg(jsonb_build_object(
           'item_id', i.id, 'name', i.name, 'emoji', i.emoji,
           'picked', a.bin, 'correct_bin', i.correct_bin,
           'correct', (a.bin = i.correct_bin), 'reason', i.reason
         ) order by a.ord)
    into v_detail
  from (
    select item_id, bin, ord
    from jsonb_to_recordset(p_answers) with ordinality as t(item_id text, bin text, ord bigint)
  ) a
  join public.game_items i on i.id = a.item_id;

  -- Constraint unik di round_id yang mencegah XP ganda.
  insert into public.xp_events (user_id, round_id, season_id, amount)
  values (v_uid, p_round_id, v_round.season_id, v_xp)
  on conflict (round_id) do nothing;

  if not found then
    -- Balapan: permintaan lain sudah menilai ronde ini.
    select * into v_round from public.rounds where id = p_round_id;
    select coalesce(sum(amount), 0) into v_xp_total
    from public.xp_events where user_id = v_uid;

    return jsonb_build_object(
      'already_scored', true,
      'score', v_round.score,
      'xp', v_round.xp_awarded,
      'xp_total', v_xp_total,
      'detail', v_round.detail
    );
  end if;

  update public.rounds
     set status = 'scored', score = v_correct, xp_awarded = v_xp, detail = v_detail
   where id = p_round_id;

  select coalesce(sum(amount), 0) into v_xp_total
  from public.xp_events where user_id = v_uid;

  return jsonb_build_object(
    'already_scored', false,
    'score', v_correct,
    'total', v_n,
    'xp', v_xp,
    'xp_raw', v_xp_raw,
    'capped', (v_xp < v_xp_raw),
    'xp_total', v_xp_total,
    'detail', v_detail
  );
end;
$$;

-- Statistik pemain sendiri (pengganti baca langsung ke xp_events).
create or replace function public.get_my_stats()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v jsonb;
begin
  if v_uid is null then
    raise exception 'AUTH_REQUIRED' using errcode = 'P0001';
  end if;

  select jsonb_build_object(
    'xp_total',    coalesce((select sum(amount) from public.xp_events where user_id = v_uid), 0),
    'xp_today',    coalesce((select sum(amount) from public.xp_events
                              where user_id = v_uid and created_at >= public.day_start_ts()), 0),
    'rounds',      (select count(*) from public.xp_events where user_id = v_uid),
    'rounds_today',(select count(*) from public.rounds
                     where user_id = v_uid and started_at >= public.day_start_ts()),
    'best',        coalesce((select max(score) from public.rounds
                              where user_id = v_uid and status = 'scored'), 0),
    'correct',     coalesce((select sum(score) from public.rounds
                              where user_id = v_uid and status = 'scored'), 0),
    'answered',    coalesce((select count(*) * 10 from public.rounds
                              where user_id = v_uid and status = 'scored'), 0)
  ) into v;

  return v;
end;
$$;

-- Hapus seluruh data pemain. auth.users dihapus -> semua tabel ikut terhapus
-- lewat ON DELETE CASCADE.
create or replace function public.delete_my_data()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'AUTH_REQUIRED' using errcode = 'P0001';
  end if;

  delete from auth.users where id = v_uid;

  return jsonb_build_object('deleted', true);
end;
$$;

-- ------------------------------------------------------- RLS & izin

alter table public.profiles       enable row level security;
alter table public.rounds         enable row level security;
alter table public.xp_events      enable row level security;
alter table public.game_items     enable row level security;
alter table public.seasons        enable row level security;
alter table public.nickname_words enable row level security;
alter table public.avatars        enable row level security;

-- Pemain hanya bisa membaca barisnya sendiri.
create policy profiles_select_own on public.profiles
  for select to authenticated
  using (id = (select auth.uid()));

create policy seasons_select on public.seasons
  for select to authenticated using (true);

create policy avatars_select on public.avatars
  for select to authenticated using (true);

create policy nickname_words_select on public.nickname_words
  for select to authenticated using (true);

-- game_items, rounds, xp_events: TIDAK ADA policy sama sekali.
-- Artinya tidak ada akses langsung dari klien; hanya lewat fungsi SECURITY DEFINER.

-- Cabut semua izin bawaan, lalu beri satu per satu.
revoke all on public.profiles, public.rounds, public.xp_events,
              public.game_items, public.seasons, public.nickname_words,
              public.avatars
  from anon, authenticated;

grant select on public.profiles       to authenticated;
grant select on public.seasons        to authenticated;
grant select on public.avatars        to authenticated;
grant select on public.nickname_words to authenticated;

-- Fungsi: cabut dari semua orang, beri hanya ke pemain yang login.
revoke all on function public.create_profile(text, text, text) from public, anon, authenticated;
revoke all on function public.start_round()                   from public, anon, authenticated;
revoke all on function public.submit_round(uuid, jsonb)       from public, anon, authenticated;
revoke all on function public.get_my_stats()                  from public, anon, authenticated;
revoke all on function public.delete_my_data()                from public, anon, authenticated;
revoke all on function public.ensure_current_season()         from public, anon, authenticated;
revoke all on function public.day_start_ts()                  from public, anon, authenticated;
revoke all on function public.week_start_ts()                 from public, anon, authenticated;

grant execute on function public.create_profile(text, text, text) to authenticated;
grant execute on function public.start_round()                   to authenticated;
grant execute on function public.submit_round(uuid, jsonb)       to authenticated;
grant execute on function public.get_my_stats()                  to authenticated;
grant execute on function public.delete_my_data()                to authenticated;
