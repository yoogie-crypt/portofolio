# Portofolio — Agung Hidayat

Website portofolio satu halaman + panel admin.
**HTML/CSS/JS murni** · **Vercel Functions** · **Neon Postgres** (database) · **Vercel Blob** (foto proyek)
Semuanya bisa dipakai dengan paket gratis.

## Struktur
```
index.html, style.css, script.js   → website publik
assets/                            → logo & foto
admin/                             → panel admin (buka di /admin)
api/                               → Vercel Functions
  content.js                       → GET  /api/content      (isi website dari database)
  contact.js                       → POST /api/contact      (form kontak + email)
  testimonial.js                   → POST /api/testimonial  (testimoni, menunggu persetujuan)
  track.js                         → POST /api/track        (statistik pengunjung)
  admin.js                         → /api/admin?action=...  (login, statistik, CRUD, upload)
  _lib.js                          → utilitas bersama (database, sesi, validasi, email)
db/schema.sql                      → tabel + data awal
.env.example                       → daftar environment variable
```

## Fitur
| Fitur | Cara kerja |
|---|---|
| Form kontak | Tersimpan di database + notifikasi ke Gmail. Maks. 3 pesan/jam per pengunjung, honeypot anti-bot. |
| Panel admin | Login email + password (sesi cookie HttpOnly 7 hari). Kelola proyek + upload screenshot, keahlian, perjalanan, pesan, testimoni. |
| Statistik | Kunjungan dicatat anonim (IP di-hash). Grafik 14 hari, sumber kunjungan, perangkat. |
| Testimoni | Tampil di website setelah disetujui. Maks. 2 kiriman/hari per pengunjung. |

Selama database belum terhubung, website tetap tampil dengan isi bawaan di HTML.

---

## Langkah setup (semua dari dashboard Vercel)

### 1. Push ke GitHub & import ke Vercel
1. Upload folder ini ke repo GitHub baru.
2. Vercel → **Add New → Project** → pilih repo → Framework Preset **Other** → **Deploy**.

### 2. Hubungkan database Neon
1. Buka proyek di Vercel → tab **Storage** → **Create Database** → pilih **Neon** (Serverless Postgres).
2. Pilih paket **Free**, region **Singapore**, lalu **Connect** ke proyek ini.
   Vercel otomatis menambahkan `DATABASE_URL` ke Environment Variables.
3. Klik **Open in Neon** → **SQL Editor** → tempel seluruh isi `db/schema.sql` → **Run**.

### 3. Hubungkan Vercel Blob (untuk screenshot proyek)
Tab **Storage** → **Create** → **Blob** → **Connect** ke proyek ini.
`BLOB_READ_WRITE_TOKEN` otomatis ditambahkan.

### 4. Tambahkan variable lainnya
**Settings → Environment Variables**, isi sesuai `.env.example`:
- `ADMIN_EMAIL` dan `ADMIN_PASSWORD` → akun untuk login ke `/admin`
- `SESSION_SECRET` dan `IP_SALT` → teks acak panjang (bebas, misalnya dari passwordsgenerator.net)
- `GMAIL_USER`, `GMAIL_APP_PASSWORD`, `CONTACT_TO` → untuk notifikasi email (opsional)

**Gmail App Password:** aktifkan Verifikasi 2 Langkah → myaccount.google.com → cari **Sandi aplikasi** → buat dengan nama "Portofolio" → salin 16 karakternya.

### 5. Redeploy
Tab **Deployments** → titik tiga pada deploy terakhir → **Redeploy**, supaya semua variable terbaca.

### 6. Coba
- Website: `https://nama-proyek.vercel.app`
- Admin: `https://nama-proyek.vercel.app/admin`

## Menjalankan di laptop (opsional)
```bash
npm i -g vercel
vercel link          # hubungkan ke proyek di Vercel
vercel env pull      # ambil environment variable ke .env.local
vercel dev           # buka http://localhost:3000
```

## Keamanan
- Browser tidak pernah terhubung langsung ke database. Semua lewat `/api/*` yang memvalidasi input dan membatasi jumlah kiriman.
- Login admin dibatasi 5 kali gagal per 15 menit. Sesi disimpan di cookie HttpOnly yang ditandatangani (tidak bisa dibaca atau dipalsukan lewat JavaScript).
- Aksi admin memakai daftar kolom yang diizinkan (whitelist) dan query berparameter, jadi aman dari SQL injection.
- Password dan kunci rahasia hanya disimpan di Environment Variables Vercel, tidak di dalam kode.
