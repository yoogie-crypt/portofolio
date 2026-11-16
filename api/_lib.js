// Utilitas bersama untuk Vercel Functions (file berawalan "_" tidak dijadikan endpoint)
import crypto from "node:crypto";
import pg from "pg";

// ---------- Database (Neon Postgres) ----------
// Pool disimpan global agar dipakai ulang antar-pemanggilan function.
const g = globalThis;
function pool() {
  if (!g.__pgPool) {
    const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;
    if (!url) throw new Error("DATABASE_URL belum diatur");
    g.__pgPool = new pg.Pool({
      connectionString: url,
      ssl: /localhost|127\.0\.0\.1|host=\/|sslmode=disable/.test(url) ? false : { rejectUnauthorized: false },
      max: 3,
      idleTimeoutMillis: 10_000,
    });
  }
  return g.__pgPool;
}
export async function q(text, params = []) {
  const { rows } = await pool().query(text, params);
  return rows;
}
export const one = async (text, params) => (await q(text, params))[0];

// ---------- Response ----------
export function json(res, status, data, extraHeaders = {}) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  for (const [k, v] of Object.entries(extraHeaders)) res.setHeader(k, v);
  res.end(JSON.stringify(data));
}

export function method(req, res, allowed) {
  if (req.method === "OPTIONS") { res.statusCode = 204; res.end(); return false; }
  if (!allowed.includes(req.method)) { json(res, 405, { error: "Metode tidak diizinkan" }); return false; }
  return true;
}

export function getBody(req) {
  if (typeof req.body === "string") { try { return JSON.parse(req.body); } catch { return {}; } }
  return req.body && typeof req.body === "object" ? req.body : {};
}

// ---------- Identitas pengunjung (anonim) ----------
export function clientIp(req) {
  const fwd = req.headers["x-forwarded-for"];
  return (Array.isArray(fwd) ? fwd[0] : fwd || "").split(",")[0].trim() || req.socket?.remoteAddress || "0.0.0.0";
}
export function hash(value) {
  const salt = process.env.IP_SALT || process.env.SESSION_SECRET || "ganti-salt-ini";
  return crypto.createHash("sha256").update(`${salt}:${value}`).digest("hex").slice(0, 32);
}

// ---------- Validasi ----------
export const clean = (v, max) => String(v ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, max);
export const cleanMultiline = (v, max) => String(v ?? "").replace(/\r\n/g, "\n").replace(/[\u0000-\u0009\u000b-\u001f\u007f]/g, "").trim().slice(0, max);
export const isEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v);

export async function tooMany(table, ipHash, limit, minutes) {
  if (!["messages", "testimonials", "login_attempts"].includes(table)) throw new Error("tabel tidak valid");
  const r = await one(
    `select count(*)::int as n from ${table} where ip_hash = $1 and created_at > now() - make_interval(mins => $2)`,
    [ipHash, minutes]
  );
  return r.n >= limit;
}

// ---------- Sesi admin (cookie bertanda tangan HMAC) ----------
const COOKIE = "admin_session";
const SESSION_DAYS = 7;
const secret = () => {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 16) throw new Error("SESSION_SECRET belum diatur (minimal 16 karakter)");
  return s;
};
const b64url = (buf) => Buffer.from(buf).toString("base64url");
const sign = (data) => b64url(crypto.createHmac("sha256", secret()).update(data).digest());

export function createSession(res, email) {
  const payload = b64url(JSON.stringify({ e: email, x: Date.now() + SESSION_DAYS * 864e5 }));
  const token = `${payload}.${sign(payload)}`;
  const secure = process.env.NODE_ENV === "development" ? "" : " Secure;";
  res.setHeader("Set-Cookie", `${COOKIE}=${token}; HttpOnly;${secure} SameSite=Strict; Path=/api; Max-Age=${SESSION_DAYS * 86400}`);
}
export function clearSession(res) {
  res.setHeader("Set-Cookie", `${COOKIE}=; HttpOnly; Secure; SameSite=Strict; Path=/api; Max-Age=0`);
}
export function readSession(req) {
  const raw = String(req.headers.cookie || "").split(/;\s*/).find((c) => c.startsWith(`${COOKIE}=`));
  if (!raw) return null;
  const [payload, sig] = raw.slice(COOKIE.length + 1).split(".");
  if (!payload || !sig) return null;
  const expected = sign(payload);
  if (sig.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString());
    if (data.x < Date.now() || data.e !== adminEmail()) return null;
    return data;
  } catch { return null; }
}
export const adminEmail = () => String(process.env.ADMIN_EMAIL || "").trim().toLowerCase();
export function checkPassword(input) {
  const real = String(process.env.ADMIN_PASSWORD || "");
  if (real.length < 8) throw new Error("ADMIN_PASSWORD belum diatur (minimal 8 karakter)");
  const a = crypto.createHash("sha256").update(String(input)).digest();
  const b = crypto.createHash("sha256").update(real).digest();
  return crypto.timingSafeEqual(a, b);
}

// ---------- Email notifikasi lewat Gmail (opsional) ----------
export async function notify(subject, text, replyTo) {
  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;
  if (!user || !pass) return false;
  try {
    const { default: nodemailer } = await import("nodemailer");
    const transporter = nodemailer.createTransport({ service: "gmail", auth: { user, pass } });
    await transporter.sendMail({ from: `"Portofolio Agung" <${user}>`, to: process.env.CONTACT_TO || user, replyTo, subject, text });
    return true;
  } catch (e) {
    console.error("Gagal kirim email:", e.message);
    return false;
  }
}
