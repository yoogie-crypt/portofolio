// POST /api/contact — simpan pesan dari form kontak + kirim notifikasi email
import { json, method, getBody, clientIp, hash, clean, cleanMultiline, isEmail, q, tooMany, notify } from "./_lib.js";

export default async function handler(req, res) {
  if (!method(req, res, ["POST"])) return;
  const b = getBody(req);
  if (b.website) return json(res, 200, { ok: true }); // honeypot anti-bot

  const name = clean(b.name, 80);
  const email = clean(b.email, 120).toLowerCase();
  const subject = clean(b.subject, 150);
  const message = cleanMultiline(b.message, 3000);

  if (name.length < 2) return json(res, 400, { error: "Nama minimal 2 karakter." });
  if (!isEmail(email)) return json(res, 400, { error: "Alamat email tidak valid." });
  if (message.length < 10) return json(res, 400, { error: "Pesan minimal 10 karakter." });

  try {
    const ipHash = hash(clientIp(req));
    if (await tooMany("messages", ipHash, 3, 60)) {
      return json(res, 429, { error: "Terlalu banyak pesan. Coba lagi dalam 1 jam." });
    }
    await q(
      `insert into messages (name, email, subject, message, ip_hash) values ($1, $2, $3, $4, $5) returning id`,
      [name, email, subject || null, message, ipHash]
    );
    await notify(
      `📩 Pesan baru dari ${name}${subject ? ` — ${subject}` : ""}`,
      `Nama   : ${name}\nEmail  : ${email}\nSubjek : ${subject || "-"}\n\n${message}\n\n— Dikirim dari form kontak portofolio`,
      email
    );
    return json(res, 200, { ok: true });
  } catch (e) {
    console.error(e);
    return json(res, 500, { error: "Pesan gagal dikirim. Silakan coba lagi." });
  }
}
