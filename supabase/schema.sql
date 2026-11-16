-- =====================================================================
--  Portofolio Agung Hidayat — Skema Database Supabase
--  Jalankan seluruh file ini di Supabase Dashboard → SQL Editor → Run
-- =====================================================================

-- ---------- 1. Fungsi admin ----------
-- Hanya akun dengan email ini yang dianggap admin.
create or replace function public.is_admin()
returns boolean
language sql stable
as $$
  select coalesce(auth.jwt() ->> 'email', '') = 'agunghidaya74@gmail.com';
$$;

-- ---------- 2. Tabel ----------
create table if not exists public.projects (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  description text not null default '',
  category    text not null default 'web' check (category in ('web','iot','ai','other')),
  badge       text,
  tags        text[] not null default '{}',
  image_url   text,
  demo_url    text,
  repo_url    text,
  sort_order  int  not null default 0,
  published   boolean not null default true,
  created_at  timestamptz not null default now()
);

create table if not exists public.skills (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  category    text not null default 'web' check (category in ('web','iot','tools')),
  sort_order  int  not null default 0,
  created_at  timestamptz not null default now()
);

create table if not exists public.experiences (
  id           uuid primary key default gen_random_uuid(),
  period       text not null,
  title        text not null,
  organization text,
  description  text,
  sort_order   int  not null default 0,
  published    boolean not null default true,
  created_at   timestamptz not null default now()
);

create table if not exists public.messages (
  id         uuid primary key default gen_random_uuid(),
  name       text not null check (char_length(name) between 2 and 80),
  email      text not null check (char_length(email) <= 120),
  subject    text check (char_length(subject) <= 150),
  message    text not null check (char_length(message) between 10 and 3000),
  is_read    boolean not null default false,
  ip_hash    text,
  created_at timestamptz not null default now()
);

create table if not exists public.testimonials (
  id         uuid primary key default gen_random_uuid(),
  name       text not null check (char_length(name) between 2 and 80),
  role       text check (char_length(role) <= 100),
  message    text not null check (char_length(message) between 10 and 600),
  approved   boolean not null default false,
  ip_hash    text,
  created_at timestamptz not null default now()
);

create table if not exists public.page_views (
  id           bigint generated always as identity primary key,
  path         text not null default '/',
  referrer     text,
  device       text check (device in ('mobile','tablet','desktop')),
  visitor_hash text,
  created_at   timestamptz not null default now()
);

create index if not exists page_views_created_idx on public.page_views (created_at desc);
create index if not exists messages_ip_idx        on public.messages (ip_hash, created_at desc);
create index if not exists testimonials_ip_idx    on public.testimonials (ip_hash, created_at desc);

-- ---------- 3. Row Level Security ----------
alter table public.projects     enable row level security;
alter table public.skills       enable row level security;
alter table public.experiences  enable row level security;
alter table public.messages     enable row level security;
alter table public.testimonials enable row level security;
alter table public.page_views   enable row level security;

-- Konten publik: semua orang bisa membaca yang dipublikasikan
drop policy if exists "public read projects" on public.projects;
create policy "public read projects" on public.projects
  for select using (published or public.is_admin());

drop policy if exists "public read skills" on public.skills;
create policy "public read skills" on public.skills
  for select using (true);

drop policy if exists "public read experiences" on public.experiences;
create policy "public read experiences" on public.experiences
  for select using (published or public.is_admin());

drop policy if exists "public read approved testimonials" on public.testimonials;
create policy "public read approved testimonials" on public.testimonials
  for select using (approved or public.is_admin());

-- Admin: akses penuh
drop policy if exists "admin all projects" on public.projects;
create policy "admin all projects" on public.projects
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "admin all skills" on public.skills;
create policy "admin all skills" on public.skills
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "admin all experiences" on public.experiences;
create policy "admin all experiences" on public.experiences
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "admin all testimonials" on public.testimonials;
create policy "admin all testimonials" on public.testimonials
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "admin all messages" on public.messages;
create policy "admin all messages" on public.messages
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "admin read page_views" on public.page_views;
create policy "admin read page_views" on public.page_views
  for select using (public.is_admin());

drop policy if exists "admin delete page_views" on public.page_views;
create policy "admin delete page_views" on public.page_views
  for delete using (public.is_admin());

-- Catatan: insert pesan, testimoni, dan kunjungan dilakukan oleh
-- Vercel Functions memakai service role key (melewati RLS), jadi
-- pengunjung tidak bisa menulis langsung ke database.

-- ---------- 4. Statistik (hanya admin) ----------
create or replace function public.view_stats(days int default 14)
returns table (day date, views bigint, visitors bigint)
language sql stable security invoker
as $$
  select d::date as day,
         count(v.id) as views,
         count(distinct v.visitor_hash) as visitors
  from generate_series(
         (now() at time zone 'Asia/Jakarta')::date - (days - 1),
         (now() at time zone 'Asia/Jakarta')::date,
         interval '1 day') d
  left join public.page_views v
    on (v.created_at at time zone 'Asia/Jakarta')::date = d::date
  group by d
  order by d;
$$;

create or replace function public.top_referrers(lim int default 6)
returns table (referrer text, total bigint)
language sql stable security invoker
as $$
  select coalesce(nullif(referrer, ''), 'Langsung') as referrer, count(*) as total
  from public.page_views
  where created_at > now() - interval '30 days'
  group by 1
  order by 2 desc
  limit lim;
$$;

-- ---------- 5. Storage untuk screenshot proyek ----------
insert into storage.buckets (id, name, public)
values ('portfolio', 'portfolio', true)
on conflict (id) do nothing;

drop policy if exists "public read portfolio files" on storage.objects;
create policy "public read portfolio files" on storage.objects
  for select using (bucket_id = 'portfolio');

drop policy if exists "admin write portfolio files" on storage.objects;
create policy "admin write portfolio files" on storage.objects
  for insert with check (bucket_id = 'portfolio' and public.is_admin());

drop policy if exists "admin update portfolio files" on storage.objects;
create policy "admin update portfolio files" on storage.objects
  for update using (bucket_id = 'portfolio' and public.is_admin());

drop policy if exists "admin delete portfolio files" on storage.objects;
create policy "admin delete portfolio files" on storage.objects
  for delete using (bucket_id = 'portfolio' and public.is_admin());

-- ---------- 6. Data awal (sama dengan isi website saat ini) ----------
insert into public.projects (title, description, category, badge, tags, repo_url, sort_order)
select * from (values
  ('Amory Kos',
   'Aplikasi web manajemen kos untuk pemilik dan penghuni. Saya deploy sendiri ke VPS Ubuntu lewat SSH dan sudah bisa diakses melalui HTTPS dari laptop maupun HP.',
   'web', 'Live di VPS', array['Web App','VPS Ubuntu','SSH','HTTPS'], null::text, 1),
  ('Papan Bloom',
   'Website pemesanan papan bunga yang dikembangkan bersama tim dengan metode Prototyping, lengkap dengan laporan pengembangannya.',
   'web', 'Proyek Tim', array['PHP Native','MySQL','XAMPP','Prototyping'], null, 2),
  ('Smart Parcel Box',
   'Kotak penerima paket pintar berbasis ESP32. Mendeteksi paket dengan load cell, reed switch, dan sensor PIR, mengunci otomatis dengan solenoid, dan memantau semuanya lewat dashboard web.',
   'iot', 'IoT · Kelompok', array['ESP32','Load Cell HX711','Solenoid Lock','MySQL'], null, 3),
  ('Lab Inventory System',
   'Sistem inventaris dan peminjaman barang laboratorium komputer. Dibangun dengan JavaScript murni tanpa framework dan Supabase sebagai database.',
   'web', 'Coding Talent Challenge', array['HTML','CSS','JavaScript','Supabase'], null, 4)
) as v
where not exists (select 1 from public.projects);

insert into public.skills (name, category, sort_order)
select * from (values
  ('HTML','web',1), ('CSS','web',2), ('JavaScript','web',3), ('PHP','web',4),
  ('Arduino','iot',1), ('ESP32','iot',2), ('Sensor & Aktuator','iot',3),
  ('Git','tools',1), ('Prompt Engineering','tools',2), ('Canva','tools',3), ('Microsoft Office','tools',4)
) as v
where not exists (select 1 from public.skills);

insert into public.experiences (period, title, organization, description, sort_order)
select * from (values
  ('2024 — Sekarang', 'S1 Teknik Informatika', 'Universitas Bina Darma, Palembang',
   'Mempelajari rekayasa perangkat lunak, pemrograman web, dan IoT, serta mengerjakan proyek individu maupun tim.', 1),
  ('2026', 'Coding Talent Challenge', 'Peserta',
   'Membangun Laboratory Inventory & Borrowing Management System dengan JavaScript dan Supabase.', 2)
) as v
where not exists (select 1 from public.experiences);
