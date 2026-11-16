// POST /api/track — catat kunjungan halaman (anonim, tanpa menyimpan IP asli)
import { json, method, getBody, clientIp, hash, clean, q } from "./_lib.js";

const BOT = /bot|crawl|spider|slurp|preview|headless|lighthouse|vercel/i;

export default async function handler(req, res) {
  if (!method(req, res, ["POST"])) return;
  const ua = String(req.headers["user-agent"] || "");
  if (BOT.test(ua)) return json(res, 200, { ok: true, skipped: true });

  const b = getBody(req);
  const path = clean(b.path, 200) || "/";
  let referrer = null;
  try {
    const host = new URL(String(b.referrer || "")).hostname.replace(/^www\./, "");
    if (host && host !== String(req.headers.host || "").replace(/:\d+$/, "")) referrer = host.slice(0, 120);
  } catch { /* tanpa referrer */ }

  const device = /ipad|tablet/i.test(ua) ? "tablet" : /mobi|android|iphone/i.test(ua) ? "mobile" : "desktop";
  const today = new Date().toISOString().slice(0, 10);
  const visitorHash = hash(`${clientIp(req)}|${ua}|${today}`);

  try {
    await q(`insert into page_views (path, referrer, device, visitor_hash) values ($1, $2, $3, $4) returning id`,
      [path, referrer, device, visitorHash]);
    return json(res, 200, { ok: true });
  } catch (e) {
    console.error(e);
    return json(res, 200, { ok: false });
  }
}
