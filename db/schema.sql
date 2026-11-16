-- =====================================================================
--  Portofolio Agung Hidayat — Skema Database (PostgreSQL / Neon)
--  Jalankan seluruh file ini di Neon Console → SQL Editor → Run
--  Aman dijalankan ulang (tidak menghapus data yang sudah ada).
-- =====================================================================

create extension if not exists pgcrypto;

create table if not exists projects (
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

create table if not exists skills (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  category    text not null default 'web' check (category in ('web','iot','tools')),
  sort_order  int  not null default 0,
  created_at  timestamptz not null default now()
);

create table if not exists experiences (
  id           uuid primary key default gen_random_uuid(),
  period       text not null,
  title        text not null,
  organization text,
  description  text,
  sort_order   int  not null default 0,
  published    boolean not null default true,
  created_at   timestamptz not null default now()
);

create table if not exists messages (
  id         uuid primary key default gen_random_uuid(),
  name       text not null check (char_length(name) between 2 and 80),
  email      text not null check (char_length(email) <= 120),
  subject    text check (char_length(subject) <= 150),
  message    text not null check (char_length(message) between 10 and 3000),
  is_read    boolean not null default false,
  ip_hash    text,
  created_at timestamptz not null default now()
);

create table if not exists testimonials (
  id         uuid primary key default gen_random_uuid(),
  name       text not null check (char_length(name) between 2 and 80),
  role       text check (char_length(role) <= 100),
  message    text not null check (char_length(message) between 10 and 600),
  approved   boolean not null default false,
  ip_hash    text,
  created_at timestamptz not null default now()
);

create table if not exists page_views (
  id           bigint generated always as identity primary key,
  path         text not null default '/',
  referrer     text,
  device       text check (device in ('mobile','tablet','desktop')),
  visitor_hash text,
  created_at   timestamptz not null default now()
);

-- Catatan percobaan login gagal (proteksi brute force)
create table if not exists login_attempts (
  id         bigint generated always as identity primary key,
  ip_hash    text not null,
  created_at timestamptz not null default now()
);

create index if not exists page_views_created_idx on page_views (created_at desc);
create index if not exists messages_ip_idx        on messages (ip_hash, created_at desc);
create index if not exists testimonials_ip_idx    on testimonials (ip_hash, created_at desc);
create index if not exists login_attempts_ip_idx  on login_attempts (ip_hash, created_at desc);

-- ---------- Data awal (sama dengan isi website saat ini) ----------
insert into projects (title, description, category, badge, tags, sort_order)
select * from (values
  ('Amory Kos',
   'Aplikasi web manajemen kos untuk pemilik dan penghuni. Saya deploy sendiri ke VPS Ubuntu lewat SSH dan sudah bisa diakses melalui HTTPS dari laptop maupun HP.',
   'web', 'Live di VPS', array['Web App','VPS Ubuntu','SSH','HTTPS'], 1),
  ('Papan Bloom',
   'Website pemesanan papan bunga yang dikembangkan bersama tim dengan metode Prototyping, lengkap dengan laporan pengembangannya.',
   'web', 'Proyek Tim', array['PHP Native','MySQL','XAMPP','Prototyping'], 2),
  ('Smart Parcel Box',
   'Kotak penerima paket pintar berbasis ESP32. Mendeteksi paket dengan load cell, reed switch, dan sensor PIR, mengunci otomatis dengan solenoid, dan memantau semuanya lewat dashboard web.',
   'iot', 'IoT · Kelompok', array['ESP32','Load Cell HX711','Solenoid Lock','MySQL'], 3),
  ('Lab Inventory System',
   'Sistem inventaris dan peminjaman barang laboratorium komputer. Dibangun dengan JavaScript murni tanpa framework dan Supabase sebagai database.',
   'web', 'Coding Talent Challenge', array['HTML','CSS','JavaScript','Supabase'], 4)
) as v(title, description, category, badge, tags, sort_order)
where not exists (select 1 from projects);

insert into skills (name, category, sort_order)
select * from (values
  ('HTML','web',1), ('CSS','web',2), ('JavaScript','web',3), ('PHP','web',4),
  ('Arduino','iot',1), ('ESP32','iot',2), ('Sensor & Aktuator','iot',3),
  ('Git','tools',1), ('Prompt Engineering','tools',2), ('Canva','tools',3), ('Microsoft Office','tools',4)
) as v(name, category, sort_order)
where not exists (select 1 from skills);

insert into experiences (period, title, organization, description, sort_order)
select * from (values
  ('2024 — Sekarang', 'S1 Teknik Informatika', 'Universitas Bina Darma, Palembang',
   'Mempelajari rekayasa perangkat lunak, pemrograman web, dan IoT, serta mengerjakan proyek individu maupun tim.', 1),
  ('2026', 'Coding Talent Challenge', 'Peserta',
   'Membangun Laboratory Inventory & Borrowing Management System dengan JavaScript dan Supabase.', 2)
) as v(period, title, organization, description, sort_order)
where not exists (select 1 from experiences);
