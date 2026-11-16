// Panel Admin — Portofolio Agung Hidayat
(() => {
  "use strict";

  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const initials = (n) => String(n || "?").trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
  const fmtDate = (d) => new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(d));
  const ago = (d) => {
    const s = (Date.now() - new Date(d)) / 1000;
    if (s < 60) return "baru saja";
    if (s < 3600) return `${Math.floor(s / 60)} mnt lalu`;
    if (s < 86400) return `${Math.floor(s / 3600)} jam lalu`;
    if (s < 604800) return `${Math.floor(s / 86400)} hari lalu`;
    return new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short" }).format(new Date(d));
  };

  const boot = $("#boot");
  const finishBoot = () => boot.classList.add("done");

  // ---------- Toast ----------
  const toastEl = $("#atoast");
  let tt;
  const toast = (msg, err = false) => {
    toastEl.textContent = msg;
    toastEl.classList.toggle("err", err);
    toastEl.classList.add("show");
    clearTimeout(tt);
    tt = setTimeout(() => toastEl.classList.remove("show"), 3000);
  };
  const fail = (e) => { console.error(e); toast(e?.message || "Terjadi kesalahan", true); };

  // ---------- API ----------
  if (!location.protocol.startsWith("http")) {
    finishBoot();
    $("#loginView").hidden = false;
    $("#loginError").textContent = "Panel admin hanya berjalan setelah di-deploy ke Vercel (atau lewat `vercel dev`).";
    $("#loginForm button[type=submit]").disabled = true;
    return;
  }
  let onUnauthorized = () => {};
  const api = async (action, { body, query } = {}) => {
    const qs = new URLSearchParams({ action, ...(query || {}) });
    const r = await fetch(`/api/admin?${qs}`, {
      method: body ? "POST" : "GET",
      credentials: "same-origin",
      headers: body ? { "Content-Type": "application/json", "X-Requested-With": "fetch" } : {},
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await r.json().catch(() => ({}));
    if (r.status === 401 && !["login", "me"].includes(action)) onUnauthorized();
    if (!r.ok) { const e = new Error(data.error || `Gagal (HTTP ${r.status})`); e.status = r.status; throw e; }
    return data;
  };
  const list = (resource, query = {}) => api("list", { query: { resource, ...query } });
  const create = (resource, data) => api("create", { body: { resource, data } });
  const update = (resource, id, data) => api("update", { body: { resource, id, data } });
  const remove = (resource, id) => api("delete", { body: { resource, id } });

  // ---------- Modal ----------
  const modal = $("#modal");
  const modalCard = $(".modal-card", modal);
  let modalResolve = null;
  const closeModal = (val = false) => {
    modal.hidden = true;
    document.body.style.overflow = "";
    if (modalResolve) { modalResolve(val); modalResolve = null; }
  };
  const openModal = ({ title, body, foot, small = false }) => {
    $("#modalTitle").textContent = title;
    $("#modalBody").innerHTML = body;
    $("#modalFoot").innerHTML = foot;
    modalCard.classList.toggle("sm", small);
    modal.hidden = false;
    document.body.style.overflow = "hidden";
    setTimeout(() => $("#modalBody input, #modalBody textarea")?.focus(), 60);
  };
  modal.addEventListener("click", (e) => { if (e.target === modal || e.target.closest("[data-close]")) closeModal(false); });
  addEventListener("keydown", (e) => { if (e.key === "Escape" && !modal.hidden) closeModal(false); });

  const confirmDialog = (text, okLabel = "Hapus", danger = true) => new Promise((resolve) => {
    openModal({
      title: "Konfirmasi",
      small: true,
      body: `<p class="confirm-text">${esc(text)}</p>`,
      foot: `<button class="abtn ghost" data-close>Batal</button><button class="abtn ${danger ? "danger" : "primary"}" id="okBtn">${esc(okLabel)}</button>`,
    });
    modalResolve = resolve;
    $("#okBtn").onclick = () => closeModal(true);
  });

  // ---------- Form builder ----------
  const fieldHtml = (f, v) => {
    const val = v ?? f.default ?? "";
    const req = f.required ? "required" : "";
    const wrap = (inner) => `<label class="fld ${f.full ? "full" : ""}"><span>${esc(f.label)}${f.required ? " *" : ""}</span>${inner}${f.hint ? `<small>${esc(f.hint)}</small>` : ""}</label>`;
    switch (f.type) {
      case "textarea": return wrap(`<textarea name="${f.name}" rows="${f.rows || 4}" maxlength="${f.max || 3000}" ${req}>${esc(val)}</textarea>`);
      case "select": return wrap(`<select name="${f.name}">${f.options.map(([k, l]) => `<option value="${k}" ${k === val ? "selected" : ""}>${esc(l)}</option>`).join("")}</select>`);
      case "number": return wrap(`<input type="number" name="${f.name}" value="${esc(val)}" step="1" />`);
      case "checkbox": return `<label class="check full"><span class="switch"><input type="checkbox" name="${f.name}" ${val !== false ? "checked" : ""} /><span></span></span>${esc(f.label)}</label>`;
      case "image": return `<div class="fld full"><span>${esc(f.label)}</span>
          <label class="upload" id="uploadBox">${val ? `<img src="${esc(val)}" alt="" /><button type="button" class="rm" id="rmImg" aria-label="Hapus gambar">✕</button>` : ""}
            <input type="file" accept="image/*" id="imgInput" />
            <span>📷 Klik atau seret gambar ke sini<br /><small>JPG/PNG/WebP · otomatis dikompres</small></span>
          </label></div>`;
      default: return wrap(`<input type="${f.type === "url" ? "url" : "text"}" name="${f.name}" value="${esc(val)}" maxlength="${f.max || 300}" ${req} placeholder="${esc(f.placeholder || "")}" />`);
    }
  };

  const formModal = ({ title, fields, data = {}, onSave }) => {
    openModal({
      title,
      body: `<form id="mForm" class="fgrid" novalidate>${fields.map((f) => fieldHtml(f, data[f.name])).join("")}</form>`,
      foot: `<button class="abtn ghost" data-close>Batal</button><button class="abtn primary" id="saveBtn"><span>Simpan</span></button>`,
    });
    const form = $("#mForm");
    const img = { file: null, removed: false };

    const box = $("#uploadBox");
    if (box) {
      const input = $("#imgInput");
      const preview = (src) => {
        $$("img, .rm", box).forEach((n) => n.remove());
        if (!src) return;
        box.insertAdjacentHTML("afterbegin", `<img src="${src}" alt="" /><button type="button" class="rm" id="rmImg" aria-label="Hapus gambar">✕</button>`);
      };
      const pick = (file) => {
        if (!file || !file.type.startsWith("image/")) return toast("File harus berupa gambar", true);
        if (file.size > 10 * 1024 * 1024) return toast("Ukuran maksimal 10 MB", true);
        img.file = file; img.removed = false;
        preview(URL.createObjectURL(file));
      };
      input.addEventListener("change", () => pick(input.files[0]));
      box.addEventListener("click", (e) => {
        if (e.target.closest(".rm")) { e.preventDefault(); img.file = null; img.removed = true; input.value = ""; preview(null); }
      });
      ["dragenter", "dragover"].forEach((t) => box.addEventListener(t, (e) => { e.preventDefault(); box.classList.add("drag"); }));
      ["dragleave", "drop"].forEach((t) => box.addEventListener(t, (e) => { e.preventDefault(); box.classList.remove("drag"); }));
      box.addEventListener("drop", (e) => pick(e.dataTransfer.files[0]));
    }

    const save = async () => {
      for (const f of fields) {
        if (!f.required) continue;
        const el = form.elements[f.name];
        if (!el.value.trim()) { el.focus(); return toast(`${f.label} wajib diisi`, true); }
      }
      const values = {};
      for (const f of fields) {
        const el = form.elements[f.name];
        if (f.type === "image" || !el) continue;
        if (f.type === "checkbox") values[f.name] = el.checked;
        else if (f.type === "number") values[f.name] = parseInt(el.value, 10) || 0;
        else if (f.type === "tags") values[f.name] = el.value.split(",").map((s) => s.trim()).filter(Boolean);
        else values[f.name] = el.value.trim() || null;
      }
      for (const f of fields.filter((f) => f.type === "url")) {
        const v = values[f.name];
        if (v && !/^https?:\/\//i.test(v)) { form.elements[f.name].focus(); return toast(`${f.label} harus diawali http:// atau https://`, true); }
      }
      const btn = $("#saveBtn");
      btn.classList.add("loading");
      try {
        await onSave(values, img);
        closeModal(true);
      } catch (e) { fail(e); }
      finally { btn.classList.remove("loading"); }
    };
    $("#saveBtn").onclick = save;
    form.addEventListener("submit", (e) => { e.preventDefault(); save(); });
  };

  // ---------- Storage ----------
  const compress = async (file, max = 1600) => {
    if (file.type === "image/gif" || file.type === "image/svg+xml") return file;
    try {
      const bmp = await createImageBitmap(file);
      const scale = Math.min(1, max / Math.max(bmp.width, bmp.height));
      const c = Object.assign(document.createElement("canvas"), { width: Math.round(bmp.width * scale), height: Math.round(bmp.height * scale) });
      c.getContext("2d").drawImage(bmp, 0, 0, c.width, c.height);
      const blob = await new Promise((r) => c.toBlob(r, "image/webp", 0.85));
      return blob && blob.size < file.size ? new File([blob], "image.webp", { type: "image/webp" }) : file;
    } catch { return file; }
  };
  const toDataUrl = (blob) => new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(fr.result);
    fr.onerror = () => reject(new Error("Gagal membaca gambar"));
    fr.readAsDataURL(blob);
  });
  const uploadImage = async (file) => {
    const f = await compress(file);
    if (f.size > 3 * 1024 * 1024) throw new Error("Gambar masih di atas 3 MB setelah dikompres. Pakai gambar yang lebih kecil.");
    const { url } = await api("upload", { body: { dataUrl: await toDataUrl(f) } });
    return url;
  };

  // ---------- Auth ----------
  const loginView = $("#loginView"), appView = $("#appView");
  const showLogin = (msg = "") => { appView.hidden = true; loginView.hidden = false; $("#loginError").textContent = msg; };
  onUnauthorized = () => showLogin("Sesi berakhir, silakan login lagi.");

  $(".pw-toggle").addEventListener("click", (e) => {
    const inp = e.currentTarget.previousElementSibling;
    inp.type = inp.type === "password" ? "text" : "password";
  });

  $("#loginForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const f = e.target, btn = $("button[type=submit]", f);
    $("#loginError").textContent = "";
    const email = f.email.value.trim(), password = f.password.value;
    if (!email || !password) return ($("#loginError").textContent = "Email dan password wajib diisi.");
    btn.classList.add("loading");
    try {
      await api("login", { body: { email, password } });
      f.reset();
      startApp();
    } catch (err) {
      $("#loginError").textContent = err.message;
    } finally {
      btn.classList.remove("loading");
    }
  });

  $("#logoutBtn").addEventListener("click", async () => {
    if (!(await confirmDialog("Keluar dari panel admin?", "Keluar", false))) return;
    await api("logout", { body: {} }).catch(() => {});
    showLogin();
  });

  // ---------- Navigasi ----------
  const VIEWS = {
    dashboard: ["Ringkasan", "Statistik dan aktivitas terbaru"],
    projects: ["Proyek", "Kelola proyek yang tampil di website"],
    skills: ["Keahlian", "Kelola daftar keahlian per kategori"],
    experiences: ["Perjalanan", "Pendidikan, pengalaman, dan pencapaian"],
    messages: ["Pesan", "Pesan dari form kontak"],
    testimonials: ["Testimoni", "Setujui testimoni sebelum tampil"],
  };
  const content = $("#content");
  const actions = $("#topActions");
  let current = "dashboard";
  const sidebar = $("#sidebar"), backdrop = $("#sbBackdrop");
  const toggleSidebar = (open) => { sidebar.classList.toggle("open", open); backdrop.classList.toggle("open", open); };
  $("#menuBtn").addEventListener("click", () => toggleSidebar(true));
  backdrop.addEventListener("click", () => toggleSidebar(false));

  const go = async (view) => {
    current = view;
    $$(".sb-nav button").forEach((b) => b.classList.toggle("active", b.dataset.view === view));
    $("#viewTitle").textContent = VIEWS[view][0];
    $("#viewSub").textContent = VIEWS[view][1];
    actions.innerHTML = "";
    content.innerHTML = `<div class="empty"><span class="spinner" style="display:inline-block"></span></div>`;
    toggleSidebar(false);
    try {
      await RENDER[view]();
      content.style.animation = "none"; void content.offsetWidth; content.style.animation = "";
    } catch (e) {
      content.innerHTML = `<div class="card empty"><span>⚠️</span>Gagal memuat data.<br /><small>${esc(e.message)}</small></div>`;
      console.error(e);
    }
  };
  $$(".sb-nav button").forEach((b) => b.addEventListener("click", () => go(b.dataset.view)));
  const refresh = () => go(current);

  const applyBadges = ({ unread = 0, pending = 0 }) => {
    const set = (el, n) => { el.hidden = !n; el.textContent = n; };
    set($("#badgeMsg"), unread);
    set($("#badgeTesti"), pending);
  };
  const refreshBadges = async () => {
    const b = await api("badges");
    applyBadges(b);
    return b;
  };

  // =====================================================
  //  VIEW RENDERERS
  // =====================================================
  const CAT_LABEL = { web: "Web", iot: "IoT", ai: "AI", other: "Lainnya" };
  const RENDER = {};

  // ---------- Ringkasan ----------
  RENDER.dashboard = async () => {
    const { daily, totals, refs, devices, badges, recent } = await api("stats");
    applyBadges(badges);
    const total30 = totals.views30;
    const today = daily[daily.length - 1] || { views: 0, visitors: 0 };
    const max = Math.max(1, ...daily.map((d) => d.views));
    const dev = { desktop: 0, mobile: 0, tablet: 0 };
    devices.forEach((d) => (dev[d.device] = d.total));
    const devTotal = devices.reduce((a, d) => a + d.total, 0) || 1;
    const refMax = Math.max(1, ...refs.map((r) => r.total));
    const dayName = (d) => new Intl.DateTimeFormat("id-ID", { weekday: "short", timeZone: "UTC" }).format(new Date(d));

    content.innerHTML = `
      <div class="stats">
        <div class="card stat"><span class="ico">👀</span><div class="lbl">Kunjungan 30 hari</div><div class="val">${total30}</div></div>
        <div class="card stat"><span class="ico">🧑‍💻</span><div class="lbl">Pengunjung hari ini</div><div class="val">${today.visitors}</div></div>
        <div class="card stat"><span class="ico">✉️</span><div class="lbl">Pesan belum dibaca</div><div class="val">${badges.unread}</div></div>
        <div class="card stat"><span class="ico">💬</span><div class="lbl">Testimoni menunggu</div><div class="val">${badges.pending}</div></div>
      </div>
      <div class="grid-2">
        <div class="card">
          <h3>Kunjungan 14 hari terakhir <span class="legend"><span><i style="background:#06b6d4"></i>Kunjungan</span></span></h3>
          <div class="chart">${daily.map((d, i) => `
            <div class="bar"><span class="tip">${new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(d.day))}: ${d.views} kunjungan · ${d.visitors} pengunjung</span>
              <span class="b" style="height:${(d.views / max) * 100}%;animation-delay:${i * 0.03}s"></span><small>${dayName(d.day)}</small></div>`).join("")}
          </div>
        </div>
        <div class="card">
          <h3>Sumber kunjungan <small class="muted">30 hari</small></h3>
          ${refs.length ? `<ul class="ref-list">${refs.map((r) => `<li><span>${esc(r.referrer)}</span><b>${r.total}</b><span class="track"><span class="fill" style="width:${(r.total / refMax) * 100}%"></span></span></li>`).join("")}</ul>` : `<p class="muted">Belum ada data kunjungan.</p>`}
          <h3 style="margin-top:18px">Perangkat</h3>
          <ul class="ref-list">${[["desktop", "💻 Desktop"], ["mobile", "📱 Mobile"], ["tablet", "📟 Tablet"]].map(([k, l]) => `<li><span>${l}</span><b>${Math.round((dev[k] / devTotal) * 100)}%</b><span class="track"><span class="fill" style="width:${(dev[k] / devTotal) * 100}%"></span></span></li>`).join("")}</ul>
        </div>
      </div>
      <div class="card">
        <h3>Pesan terbaru <button class="abtn ghost sm" id="toMsg">Lihat semua →</button></h3>
        ${recent.length ? `<div class="list">${recent.map((m) => `
          <div class="row"><span class="thumb" style="width:40px;height:40px;border-radius:50%">${esc(initials(m.name))}</span>
            <div class="info"><b>${esc(m.name)} ${m.is_read ? "" : '<span class="pill warn">Baru</span>'}</b><p>${esc(m.subject || m.message)}</p></div>
            <small class="muted">${ago(m.created_at)}</small></div>`).join("")}</div>` : `<p class="muted">Belum ada pesan masuk.</p>`}
      </div>`;
    $("#toMsg").onclick = () => go("messages");
  };

  // ---------- Proyek ----------
  const PROJECT_FIELDS = [
    { name: "title", label: "Judul proyek", required: true, max: 120 },
    { name: "category", label: "Kategori", type: "select", options: [["web", "Web"], ["iot", "IoT"], ["ai", "AI"], ["other", "Lainnya"]], default: "web" },
    { name: "badge", label: "Label kecil", placeholder: "Contoh: Proyek Tim", max: 40 },
    { name: "sort_order", label: "Urutan", type: "number", default: 0, hint: "Angka kecil tampil lebih dulu" },
    { name: "description", label: "Deskripsi", type: "textarea", required: true, full: true, max: 600 },
    { name: "tags", label: "Teknologi (pisahkan dengan koma)", type: "tags", full: true, placeholder: "HTML, CSS, JavaScript", max: 300 },
    { name: "demo_url", label: "Link demo", type: "url", placeholder: "https://" },
    { name: "repo_url", label: "Link GitHub", type: "url", placeholder: "https://github.com/..." },
    { name: "image_url", label: "Screenshot", type: "image" },
    { name: "published", label: "Tampilkan di website", type: "checkbox", default: true },
  ];

  const editProject = (p = null) => formModal({
    title: p ? "Edit Proyek" : "Tambah Proyek",
    fields: PROJECT_FIELDS,
    data: p ? { ...p, tags: (p.tags || []).join(", ") } : {},
    onSave: async (v, img) => {
      let image_url = p?.image_url || null;
      if (img.file) image_url = await uploadImage(img.file);
      else if (img.removed) image_url = null;
      const row = { ...v, image_url };
      if (p) await update("projects", p.id, row);
      else await create("projects", row);
      toast(p ? "Proyek diperbarui ✓" : "Proyek ditambahkan ✓");
      refresh();
    },
  });

  RENDER.projects = async () => {
    actions.innerHTML = `<button class="abtn primary" id="addBtn">＋ <span>Tambah Proyek</span></button>`;
    $("#addBtn").onclick = () => editProject();
    const rows = await list("projects");
    if (!rows.length) { content.innerHTML = `<div class="card empty"><span>🗂️</span>Belum ada proyek.</div>`; return; }
    content.innerHTML = `<div class="list">${rows.map((p) => `
      <div class="row" data-id="${p.id}">
        ${p.image_url ? `<img class="thumb" src="${esc(p.image_url)}" alt="" loading="lazy" />` : `<span class="thumb">${esc(initials(p.title))}</span>`}
        <div class="info">
          <b>${esc(p.title)}</b>
          <p><span class="pill">${CAT_LABEL[p.category] || p.category}</span>${p.badge ? `<span class="pill off">${esc(p.badge)}</span>` : ""}${esc((p.tags || []).join(" · "))}</p>
        </div>
        <div class="acts">
          <span class="pill ${p.published ? "ok" : "off"}">#${p.sort_order}</span>
          <label class="switch" title="Tampilkan di website"><input type="checkbox" data-act="pub" ${p.published ? "checked" : ""} /><span></span></label>
          <button class="icon-btn" data-act="edit" title="Edit">✏️</button>
          <button class="icon-btn del" data-act="del" title="Hapus">🗑️</button>
        </div>
      </div>`).join("")}</div>`;

    $$(".row", content).forEach((el) => {
      const p = rows.find((r) => r.id === el.dataset.id);
      $('[data-act="edit"]', el).onclick = () => editProject(p);
      $('[data-act="pub"]', el).onchange = async (e) => {
        try { await update("projects", p.id, { published: e.target.checked }); p.published = e.target.checked; toast(p.published ? "Proyek ditampilkan" : "Proyek disembunyikan"); }
        catch (err) { e.target.checked = !e.target.checked; fail(err); }
      };
      $('[data-act="del"]', el).onclick = async () => {
        if (!(await confirmDialog(`Hapus proyek "${p.title}"? Tindakan ini tidak bisa dibatalkan.`))) return;
        try { await remove("projects", p.id); toast("Proyek dihapus"); refresh(); } catch (e) { fail(e); }
      };
    });
  };

  // ---------- Keahlian ----------
  const SKILL_CATS = [["web", "Web Development", "💻"], ["iot", "IoT & Hardware", "🔌"], ["tools", "Tools & AI", "✨"]];
  RENDER.skills = async () => {
    const rows = await list("skills");
    content.innerHTML = `<div class="skill-cols">${SKILL_CATS.map(([k, label, ico]) => {
      const items = rows.filter((s) => s.category === k);
      return `<div class="card" data-cat="${k}">
        <h3>${ico} ${label} <small class="muted">${items.length} item</small></h3>
        <div class="chips">${items.map((s) => `<span class="chip" data-id="${s.id}" title="Klik untuk edit"><span class="ord">${s.sort_order}</span> ${esc(s.name)}<button aria-label="Hapus ${esc(s.name)}">✕</button></span>`).join("") || '<span class="muted">Belum ada.</span>'}</div>
        <form class="add-inline"><input placeholder="Tambah keahlian..." maxlength="40" /><button class="abtn primary sm">Tambah</button></form>
      </div>`;
    }).join("")}</div><p class="muted" style="margin-top:14px">Tip: klik nama keahlian untuk mengubah nama, kategori, atau urutannya.</p>`;

    $$(".card[data-cat]", content).forEach((cardEl) => {
      const cat = cardEl.dataset.cat;
      $("form", cardEl).onsubmit = async (e) => {
        e.preventDefault();
        const inp = $("input", e.target), name = inp.value.trim();
        if (!name) return;
        const order = Math.max(0, ...rows.filter((s) => s.category === cat).map((s) => s.sort_order)) + 1;
        try { await create("skills", { name, category: cat, sort_order: order }); toast(`"${name}" ditambahkan ✓`); refresh(); } catch (err) { fail(err); }
      };
    });
    $$(".chip", content).forEach((chip) => {
      const s = rows.find((r) => r.id === chip.dataset.id);
      $("button", chip).onclick = async (e) => {
        e.stopPropagation();
        if (!(await confirmDialog(`Hapus keahlian "${s.name}"?`))) return;
        try { await remove("skills", s.id); toast("Keahlian dihapus"); refresh(); } catch (err) { fail(err); }
      };
      chip.onclick = () => formModal({
        title: "Edit Keahlian",
        data: s,
        fields: [
          { name: "name", label: "Nama", required: true, full: true, max: 40 },
          { name: "category", label: "Kategori", type: "select", options: SKILL_CATS.map(([k, l]) => [k, l]) },
          { name: "sort_order", label: "Urutan", type: "number" },
        ],
        onSave: async (v) => { await update("skills", s.id, v); toast("Keahlian diperbarui ✓"); refresh(); },
      });
    });
  };

  // ---------- Perjalanan ----------
  const EXP_FIELDS = [
    { name: "period", label: "Periode", required: true, placeholder: "2024 — Sekarang", max: 40 },
    { name: "sort_order", label: "Urutan", type: "number", default: 0 },
    { name: "title", label: "Judul", required: true, full: true, placeholder: "Contoh: Asisten Laboratorium", max: 120 },
    { name: "organization", label: "Instansi / peran", full: true, max: 120 },
    { name: "description", label: "Deskripsi", type: "textarea", full: true, max: 600 },
    { name: "published", label: "Tampilkan di website", type: "checkbox", default: true },
  ];
  const editExp = (x = null) => formModal({
    title: x ? "Edit Perjalanan" : "Tambah Perjalanan",
    fields: EXP_FIELDS,
    data: x || {},
    onSave: async (v) => {
      if (x) await update("experiences", x.id, v);
      else await create("experiences", v);
      toast("Tersimpan ✓");
      refresh();
    },
  });
  RENDER.experiences = async () => {
    actions.innerHTML = `<button class="abtn primary" id="addBtn">＋ <span>Tambah</span></button>`;
    $("#addBtn").onclick = () => editExp();
    const rows = await list("experiences");
    if (!rows.length) { content.innerHTML = `<div class="card empty"><span>🎓</span>Belum ada data perjalanan.</div>`; return; }
    content.innerHTML = `<div class="list">${rows.map((x) => `
      <div class="row" data-id="${x.id}">
        <span class="thumb" style="width:58px">🎓</span>
        <div class="info"><b>${esc(x.title)}</b><p><span class="pill">${esc(x.period)}</span>${esc(x.organization || "")}</p></div>
        <div class="acts">
          <label class="switch" title="Tampilkan di website"><input type="checkbox" data-act="pub" ${x.published ? "checked" : ""} /><span></span></label>
          <button class="icon-btn" data-act="edit" title="Edit">✏️</button>
          <button class="icon-btn del" data-act="del" title="Hapus">🗑️</button>
        </div>
      </div>`).join("")}</div>`;
    $$(".row", content).forEach((el) => {
      const x = rows.find((r) => r.id === el.dataset.id);
      $('[data-act="edit"]', el).onclick = () => editExp(x);
      $('[data-act="pub"]', el).onchange = async (e) => {
        try { await update("experiences", x.id, { published: e.target.checked }); toast("Tersimpan ✓"); }
        catch (err) { e.target.checked = !e.target.checked; fail(err); }
      };
      $('[data-act="del"]', el).onclick = async () => {
        if (!(await confirmDialog(`Hapus "${x.title}"?`))) return;
        try { await remove("experiences", x.id); toast("Dihapus"); refresh(); } catch (e) { fail(e); }
      };
    });
  };

  // ---------- Pesan ----------
  let msgTab = "all";
  RENDER.messages = async () => {
    const rows = await list("messages", msgTab === "unread" ? { is_read: "false" } : {});
    content.innerHTML = `
      <div class="tabs"><button data-tab="all" class="${msgTab === "all" ? "active" : ""}">Semua</button><button data-tab="unread" class="${msgTab === "unread" ? "active" : ""}">Belum dibaca</button></div>
      ${rows.length ? `<div class="list">${rows.map((m) => `
        <article class="msg ${m.is_read ? "" : "unread"}" data-id="${m.id}">
          <button class="msg-head">
            <span class="avatar">${esc(initials(m.name))}</span>
            <span class="info"><b>${esc(m.name)}</b> ${m.is_read ? "" : '<span class="pill warn">Baru</span>'}<p>${esc(m.subject || m.message)}</p></span>
            <time title="${fmtDate(m.created_at)}">${ago(m.created_at)}</time>
          </button>
          <div class="msg-body" hidden>
            <div class="meta">${esc(m.email)} · ${fmtDate(m.created_at)}</div>
            ${m.subject ? `<b>${esc(m.subject)}</b>` : ""}
            <div class="text">${esc(m.message)}</div>
            <div class="msg-actions">
              <a class="abtn primary sm" href="mailto:${encodeURIComponent(m.email)}?subject=${encodeURIComponent("Re: " + (m.subject || "Pesan dari portofolio"))}">↩ Balas via Email</a>
              <button class="abtn ghost sm" data-act="toggle">${m.is_read ? "Tandai belum dibaca" : "Tandai sudah dibaca"}</button>
              <button class="abtn danger sm" data-act="del">Hapus</button>
            </div>
          </div>
        </article>`).join("")}</div>` : `<div class="card empty"><span>📭</span>${msgTab === "unread" ? "Semua pesan sudah dibaca." : "Belum ada pesan."}</div>`}`;

    $$(".tabs button", content).forEach((b) => (b.onclick = () => { msgTab = b.dataset.tab; refresh(); }));
    $$(".msg", content).forEach((el) => {
      const m = rows.find((r) => r.id === el.dataset.id);
      const setRead = async (val) => {
        await update("messages", m.id, { is_read: val });
        m.is_read = val;
        el.classList.toggle("unread", !val);
        $(".pill.warn", el)?.remove();
        $('[data-act="toggle"]', el).textContent = val ? "Tandai belum dibaca" : "Tandai sudah dibaca";
        refreshBadges();
      };
      $(".msg-head", el).onclick = async () => {
        const body = $(".msg-body", el);
        body.hidden = !body.hidden;
        if (!body.hidden && !m.is_read) setRead(true).catch(fail);
      };
      $('[data-act="toggle"]', el).onclick = () => setRead(!m.is_read).then(() => msgTab === "unread" && refresh()).catch(fail);
      $('[data-act="del"]', el).onclick = async () => {
        if (!(await confirmDialog(`Hapus pesan dari ${m.name}?`))) return;
        try { await remove("messages", m.id); toast("Pesan dihapus"); refreshBadges(); refresh(); } catch (e) { fail(e); }
      };
    });
  };

  // ---------- Testimoni ----------
  let testiTab = "pending";
  RENDER.testimonials = async () => {
    const rows = await list("testimonials", { approved: String(testiTab === "approved") });
    content.innerHTML = `
      <div class="tabs"><button data-tab="pending" class="${testiTab === "pending" ? "active" : ""}">Menunggu</button><button data-tab="approved" class="${testiTab === "approved" ? "active" : ""}">Disetujui</button></div>
      ${rows.length ? `<div class="list">${rows.map((t) => `
        <div class="row" data-id="${t.id}" style="align-items:flex-start">
          <span class="thumb" style="width:44px;height:44px;border-radius:50%">${esc(initials(t.name))}</span>
          <div class="info"><b>${esc(t.name)}</b> <small class="muted">${esc(t.role || "")} · ${ago(t.created_at)}</small><p class="testi-q">"${esc(t.message)}"</p></div>
          <div class="acts">
            ${t.approved ? `<button class="abtn ghost sm" data-act="toggle">Sembunyikan</button>` : `<button class="abtn primary sm" data-act="toggle">✓ Setujui</button>`}
            <button class="icon-btn del" data-act="del" title="Hapus">🗑️</button>
          </div>
        </div>`).join("")}</div>` : `<div class="card empty"><span>💬</span>${testiTab === "pending" ? "Tidak ada testimoni yang menunggu." : "Belum ada testimoni yang disetujui."}</div>`}`;

    $$(".tabs button", content).forEach((b) => (b.onclick = () => { testiTab = b.dataset.tab; refresh(); }));
    $$(".row", content).forEach((el) => {
      const t = rows.find((r) => r.id === el.dataset.id);
      $('[data-act="toggle"]', el).onclick = async () => {
        try { await update("testimonials", t.id, { approved: !t.approved }); toast(t.approved ? "Testimoni disembunyikan" : "Testimoni disetujui ✓"); refreshBadges(); refresh(); } catch (e) { fail(e); }
      };
      $('[data-act="del"]', el).onclick = async () => {
        if (!(await confirmDialog(`Hapus testimoni dari ${t.name}?`))) return;
        try { await remove("testimonials", t.id); toast("Testimoni dihapus"); refreshBadges(); refresh(); } catch (e) { fail(e); }
      };
    });
  };

  // ---------- Start ----------
  const startApp = () => {
    loginView.hidden = true;
    appView.hidden = false;
    go("dashboard");
  };

  (async () => {
    try { await api("me"); finishBoot(); startApp(); }
    catch { finishBoot(); showLogin(); }
  })();
})();
