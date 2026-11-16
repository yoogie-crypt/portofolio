// GET /api/content — semua konten publik untuk website dalam satu permintaan
import { json, method, q } from "./_lib.js";

export default async function handler(req, res) {
  if (!method(req, res, ["GET"])) return;
  try {
    const [projects, skills, experiences, testimonials] = await Promise.all([
      q(`select id, title, description, category, badge, tags, image_url, demo_url, repo_url
           from projects where published order by sort_order, created_at desc`),
      q(`select name, category from skills order by sort_order, created_at`),
      q(`select period, title, organization, description
           from experiences where published order by sort_order, created_at`),
      q(`select name, role, message from testimonials where approved order by created_at desc limit 6`),
    ]);
    json(res, 200, { projects, skills, experiences, testimonials }, {
      // Disimpan di CDN Vercel 60 detik agar cepat & hemat kuota database
      "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
    });
  } catch (e) {
    console.error(e);
    json(res, 500, { error: "Gagal memuat konten" });
  }
}
