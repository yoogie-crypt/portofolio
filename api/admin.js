// /api/admin?action=... — semua kebutuhan panel admin dalam satu function
import {
  json, getBody, clientIp, hash, clean, cleanMultiline, q, one, tooMany,
  createSession, clearSession, readSession, adminEmail, checkPassword,
} from "./_lib.js";

// ---------- Definisi tabel yang boleh dikelola ----------
const str = (max) => (v) => (v == null || v === "" ? null : clean(v, max));
const text = (max) => (v) => (v == null || v === "" ? null : cleanMultiline(v, max));
const need = (max) => (v) => { const s = clean(v, max); if (!s) throw new Error("Field wajib belum diisi"); return s; };
const int = (v) => { const n = parseInt(v, 10); return Number.isFinite(n) ? Math.max(-9999, Math.min(9999, n)) : 0; };
const bool = (v) => v === true || v === "true" || v === 1;
const oneOf = (...opts) => (v) => { if (!opts.includes(v)) throw new Error(`Nilai tidak valid: ${v}`); return v; };
const url = (v) => {
  if (v == null || v === "") return null;
  const s = String(v).trim().slice(0, 500);
  if (!/^https?:\/\//i.test(s)) throw new Error("Link harus diawali http:// atau https://");
  return s;
};
const tags = (v) => (Array.isArray(v) ? v : String(v || "").split(",")).map((t) => clean(t, 40)).filter(Boolean).slice(0, 12);

const RESOURCES = {
  projects: {
    order: "sort_order, created_at desc",
    create: true,
    required: ["title", "description"],
    fields: {
      title: need(120), description: (v) => cleanMultiline(v, 600), category: oneOf("web", "iot", "ai", "other"),
      badge: str(40), tags, image_url: url, demo_url: url, repo_url: url, sort_order: int, published: bool,
    },
  },
  skills: {
    order: "category, sort_order, created_at",
    create: true,
    required: ["name", "category"],
    fields: { name: need(40), category: oneOf("web", "iot", "tools"), sort_order: int },
  },
  experiences: {
    order: "sort_order, created_at",
    create: true,
    required: ["period", "title"],
    fields: { period: need(40), title: need(120), organization: str(120), description: text(600), sort_order: int, published: bool },
  },
  messages: { order: "created_at desc", create: false, fields: { is_read: bool }, filters: { is_read: bool } },
  testimonials: { order: "created_at desc", create: false, fields: { approved: bool }, filters: { approved: bool } },
};

const pick = (resource, data, partial) => {
  const def = RESOURCES[resource];
  const out = {};
  for (const [k, fn] of Object.entries(def.fields)) {
    if (data && k in data) out[k] = fn(data[k]);
    else if (!partial && def.required?.includes(k)) throw new Error("Field wajib belum diisi");
  }
  if (!Object.keys(out).length) throw new Error("Tidak ada data untuk disimpan");
  return out;
};
const isUuid = (v) => /^[0-9a-f-]{36}$/i.test(String(v || ""));

// ---------- Vercel Blob ----------
async function blob() { return import("@vercel/blob"); }
async function deleteBlob(u) {
  if (!u || !/\.blob\.vercel-storage\.com\//.test(u)) return;
  try { await (await blob()).del(u); } catch (e) { console.warn("Gagal hapus blob:", e.message); }
}

// ---------- Handler ----------
export default async function handler(req, res) {
  const action = String(req.query?.action || new URL(req.url, "http://x").searchParams.get("action") || "");
  const body = getBody(req);

  try {
    // Lindungi dari CSRF: aksi yang mengubah data wajib header khusus + JSON
    if (req.method === "POST" && req.headers["x-requested-with"] !== "fetch") {
      return json(res, 403, { error: "Permintaan ditolak" });
    }

    // ---- Tanpa login ----
    if (action === "login" && req.method === "POST") {
      const ipHash = hash(`login:${clientIp(req)}`);
      if (await tooMany("login_attempts", ipHash, 5, 15)) {
        return json(res, 429, { error: "Terlalu banyak percobaan. Coba lagi dalam 15 menit." });
      }
      const email = clean(body.email, 120).toLowerCase();
      const ok = email === adminEmail() && checkPassword(body.password || "");
      if (!ok) {
        await q(`insert into login_attempts (ip_hash) values ($1) returning id`, [ipHash]);
        return json(res, 401, { error: "Email atau password salah." });
      }
      await q(`delete from login_attempts where ip_hash = $1 or created_at < now() - interval '1 day' returning id`, [ipHash]);
      createSession(res, email);
      return json(res, 200, { ok: true, email });
    }
    if (action === "logout") { clearSession(res); return json(res, 200, { ok: true }); }

    // ---- Wajib login ----
    const session = readSession(req);
    if (!session) return json(res, 401, { error: "Sesi berakhir, silakan login lagi." });

    if (action === "me") return json(res, 200, { email: session.e });

    if (action === "badges") {
      const r = await one(`select (select count(*)::int from messages where not is_read) as unread,
                                  (select count(*)::int from testimonials where not approved) as pending`);
      return json(res, 200, r);
    }

    if (action === "stats") {
      const days = 14;
      const [daily, totals, refs, devices, badges, recent] = await Promise.all([
        q(`select to_char(d, 'YYYY-MM-DD') as day,
                  count(v.id)::int as views,
                  count(distinct v.visitor_hash)::int as visitors
             from generate_series((now() at time zone 'Asia/Jakarta')::date - ($1::int - 1),
                                  (now() at time zone 'Asia/Jakarta')::date, interval '1 day') d
             left join page_views v on (v.created_at at time zone 'Asia/Jakarta')::date = d::date
            group by d order by d`, [days]),
        one(`select count(*)::int as views30, count(distinct visitor_hash)::int as visitors30
               from page_views where created_at > now() - interval '30 days'`),
        q(`select coalesce(referrer, 'Langsung') as referrer, count(*)::int as total
             from page_views where created_at > now() - interval '30 days'
            group by 1 order by 2 desc limit 6`),
        q(`select device, count(*)::int as total from page_views
            where created_at > now() - interval '30 days' group by device`),
        one(`select (select count(*)::int from messages where not is_read) as unread,
                    (select count(*)::int from testimonials where not approved) as pending`),
        q(`select id, name, subject, message, is_read, created_at from messages order by created_at desc limit 4`),
      ]);
      return json(res, 200, { daily, totals, refs, devices, badges, recent });
    }

    if (action === "upload" && req.method === "POST") {
      const m = /^data:(image\/(png|jpe?g|webp|gif));base64,(.+)$/i.exec(String(body.dataUrl || ""));
      if (!m) return json(res, 400, { error: "Format gambar tidak didukung" });
      const buf = Buffer.from(m[3], "base64");
      if (buf.length > 3 * 1024 * 1024) return json(res, 413, { error: "Gambar terlalu besar (maks. 3 MB setelah kompres)" });
      const ext = m[2].toLowerCase().replace("jpeg", "jpg");
      const { put } = await blob();
      const out = await put(`projects/screenshot.${ext}`, buf, { access: "public", contentType: m[1], addRandomSuffix: true });
      return json(res, 200, { url: out.url });
    }

    // ---- CRUD generik ----
    const resource = String(body.resource || req.query?.resource || "");
    const def = RESOURCES[resource];
    if (!def) return json(res, 400, { error: "Aksi tidak dikenal" });

    if (action === "list" && req.method === "GET") {
      const where = [], params = [];
      for (const [k, fn] of Object.entries(def.filters || {})) {
        const v = req.query?.[k];
        if (v !== undefined && v !== "") { params.push(fn(v)); where.push(`${k} = $${params.length}`); }
      }
      const rows = await q(`select * from ${resource} ${where.length ? `where ${where.join(" and ")}` : ""} order by ${def.order} limit 500`, params);
      rows.forEach((r) => delete r.ip_hash);
      return json(res, 200, rows);
    }

    if (req.method !== "POST") return json(res, 405, { error: "Metode tidak diizinkan" });

    if (action === "create") {
      if (!def.create) return json(res, 400, { error: "Tidak bisa membuat data ini dari admin" });
      const data = pick(resource, body.data, false);
      const cols = Object.keys(data);
      const row = await one(
        `insert into ${resource} (${cols.join(", ")}) values (${cols.map((_, i) => `$${i + 1}`).join(", ")}) returning *`,
        Object.values(data)
      );
      return json(res, 200, row);
    }

    if (!isUuid(body.id)) return json(res, 400, { error: "ID tidak valid" });

    if (action === "update") {
      const data = pick(resource, body.data, true);
      const old = resource === "projects" && "image_url" in data ? await one(`select image_url from projects where id = $1`, [body.id]) : null;
      const cols = Object.keys(data);
      const row = await one(
        `update ${resource} set ${cols.map((c, i) => `${c} = $${i + 1}`).join(", ")} where id = $${cols.length + 1} returning *`,
        [...Object.values(data), body.id]
      );
      if (!row) return json(res, 404, { error: "Data tidak ditemukan" });
      if (old?.image_url && old.image_url !== row.image_url) await deleteBlob(old.image_url);
      delete row.ip_hash;
      return json(res, 200, row);
    }

    if (action === "delete") {
      const row = await one(`delete from ${resource} where id = $1 returning *`, [body.id]);
      if (!row) return json(res, 404, { error: "Data tidak ditemukan" });
      if (resource === "projects") await deleteBlob(row.image_url);
      return json(res, 200, { ok: true });
    }

    return json(res, 400, { error: "Aksi tidak dikenal" });
  } catch (e) {
    console.error(e);
    const msg = /wajib|valid|harus|Tidak ada data/.test(e.message) ? e.message : "Terjadi kesalahan di server";
    return json(res, /wajib|valid|harus|Tidak ada data/.test(e.message) ? 400 : 500, { error: msg });
  }
}
