// POST /api/testimonial — simpan testimoni (menunggu persetujuan admin)
import { json, method, getBody, clientIp, hash, clean, cleanMultiline, q, tooMany, notify } from "./_lib.js";

export default async function handler(req, res) {
  if (!method(req, res, ["POST"])) return;
  const b = getBody(req);
  if (b.website) return json(res, 200, { ok: true });

  const name = clean(b.name, 80);
  const role = clean(b.role, 100);
  const message = cleanMultiline(b.message, 600);

  if (name.length < 2) return json(res, 400, { error: "Nama minimal 2 karakter." });
  if (message.length < 10) return json(res, 400, { error: "Testimoni minimal 10 karakter." });

  try {
    const ipHash = hash(clientIp(req));
    if (await tooMany("testimonials", ipHash, 2, 24 * 60)) {
      return json(res, 429, { error: "Kamu sudah mengirim testimoni hari ini. Terima kasih!" });
    }
    await q(
      `insert into testimonials (name, role, message, ip_hash) values ($1, $2, $3, $4) returning id`,
      [name, role || null, message, ipHash]
    );
    await notify(`💬 Testimoni baru dari ${name}`, `${name}${role ? ` (${role})` : ""}\n\n"${message}"\n\nSetujui di halaman admin.`);
    return json(res, 200, { ok: true });
  } catch (e) {
    console.error(e);
    return json(res, 500, { error: "Testimoni gagal dikirim. Silakan coba lagi." });
  }
}
