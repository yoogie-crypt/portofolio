// Portofolio Agung Hidayat — interaksi, animasi & koneksi backend
(() => {
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const IS_HTTP = location.protocol.startsWith("http");

  const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const safeUrl = (u) => { try { const x = new URL(u); return /^https?:$/.test(x.protocol) ? x.href : ""; } catch { return ""; } };

  $("#year").textContent = new Date().getFullYear();

  // ---------- Toast ----------
  const toast = $("#toast");
  let toastTimer;
  const showToast = (msg, isError = false) => {
    toast.textContent = msg;
    toast.classList.toggle("error", isError);
    toast.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove("show"), 3200);
  };

  // ---------- Navbar ----------
  const nav = $("#nav");
  const progress = $(".scroll-progress");
  const onScroll = () => {
    const y = window.scrollY;
    nav.classList.toggle("scrolled", y > 20);
    const max = document.documentElement.scrollHeight - innerHeight;
    progress.style.transform = `scaleX(${max > 0 ? y / max : 0})`;
  };
  addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  const burger = $("#burger");
  const links = $("#navLinks");
  const toggleMenu = (open) => {
    burger.classList.toggle("open", open);
    links.classList.toggle("open", open);
    burger.setAttribute("aria-expanded", open);
    document.body.style.overflow = open ? "hidden" : "";
  };
  burger.addEventListener("click", () => toggleMenu(!links.classList.contains("open")));
  $$("a", links).forEach((a) => a.addEventListener("click", () => toggleMenu(false)));

  const navMap = new Map($$(".nav-links a:not(.nav-cta)").map((a) => [a.getAttribute("href").slice(1), a]));
  const spy = new IntersectionObserver(
    (entries) => entries.forEach((e) => {
      if (e.isIntersecting && navMap.has(e.target.id)) {
        navMap.forEach((a) => a.classList.remove("active"));
        navMap.get(e.target.id).classList.add("active");
      }
    }),
    { rootMargin: "-45% 0px -50% 0px" }
  );
  $$("main section[id]").forEach((s) => spy.observe(s));

  // ---------- Reveal ----------
  const revealer = new IntersectionObserver(
    (entries) => entries.forEach((e) => {
      if (e.isIntersecting) { e.target.classList.add("in"); revealer.unobserve(e.target); }
    }),
    { threshold: 0.12, rootMargin: "0px 0px -40px 0px" }
  );
  const observeReveal = (root = document) => $$(".reveal:not(.in)", root).forEach((el) => revealer.observe(el));
  observeReveal();

  // ---------- Efek mengetik ----------
  const roles = ["Mahasiswa Informatika", "Web Developer", "AI & Machine Learning Enthusiast", "IoT Builder"];
  const typed = $("#typed");
  if (reduceMotion) typed.textContent = roles.join(" · ");
  else {
    let r = 0, i = 0, del = false;
    const tick = () => {
      const word = roles[r];
      typed.textContent = word.slice(0, i);
      if (!del && i < word.length) { i++; setTimeout(tick, 70); }
      else if (!del) { del = true; setTimeout(tick, 1600); }
      else if (i > 0) { i--; setTimeout(tick, 35); }
      else { del = false; r = (r + 1) % roles.length; setTimeout(tick, 300); }
    };
    setTimeout(tick, 700);
  }

  // ---------- Counter ----------
  const animateCount = (el, end) => {
    const start = +el.textContent || 0, t0 = performance.now(), dur = 1200;
    const step = (t) => {
      const p = Math.min((t - t0) / dur, 1);
      el.textContent = Math.round(start + (end - start) * (1 - Math.pow(1 - p, 3)));
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  };
  const counter = new IntersectionObserver((entries) => entries.forEach((e) => {
    if (!e.isIntersecting) return;
    e.target.dataset.seen = "1";
    animateCount(e.target, +e.target.dataset.count);
    counter.unobserve(e.target);
  }));
  $$("[data-count]").forEach((el) => counter.observe(el));
  const setCount = (el, n) => {
    if (!el || !n) return;
    el.dataset.count = n;
    if (el.dataset.seen) animateCount(el, n);
  };

  // ---------- Tilt foto ----------
  const tilt = $("#tilt");
  if (tilt && !reduceMotion && matchMedia("(hover: hover)").matches) {
    const hero = $(".hero");
    hero.addEventListener("mousemove", (e) => {
      const r = tilt.getBoundingClientRect();
      const x = (e.clientX - (r.left + r.width / 2)) / r.width;
      const y = (e.clientY - (r.top + r.height / 2)) / r.height;
      tilt.style.transform = `perspective(1000px) rotateY(${x * 8}deg) rotateX(${-y * 8}deg)`;
    });
    hero.addEventListener("mouseleave", () => (tilt.style.transform = ""));
  }

  // ---------- Filter proyek ----------
  const filters = $$(".filter");
  filters.forEach((btn) => btn.addEventListener("click", () => {
    filters.forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    const f = btn.dataset.filter;
    $$(".project").forEach((p) => {
      const show = f === "all" || p.dataset.cat === f;
      p.classList.toggle("hide", !show);
      if (show && !reduceMotion) p.animate([{ opacity: 0, transform: "translateY(16px) scale(.98)" }, { opacity: 1, transform: "none" }], { duration: 500, easing: "cubic-bezier(.22,1,.36,1)" });
    });
  }));

  // ---------- Glow kartu kontak ----------
  const card = $(".contact-card");
  card?.addEventListener("mousemove", (e) => {
    const r = card.getBoundingClientRect();
    card.style.setProperty("--mx", `${e.clientX - r.left}px`);
    card.style.setProperty("--my", `${e.clientY - r.top}px`);
  });

  // ---------- Salin email ----------
  $("#copyEmail").addEventListener("click", async () => {
    const email = "agunghidaya74@gmail.com";
    try { await navigator.clipboard.writeText(email); showToast("Email disalin ✓"); }
    catch { showToast(email); }
  });

  // =====================================================
  //  BACKEND: data dari /api/content (fallback ke HTML statis)
  // =====================================================

  const mockArt = (cat, i) => cat === "iot"
    ? `<div class="iot-art"><div class="box"><span class="lid"></span><span class="lock"></span></div><div class="signal"><i></i><i></i><i></i></div><div class="chip-esp">ESP32</div></div>`
    : [
        `<div class="mock"><div class="mock-bar"><i></i><i></i><i></i></div><div class="mock-body"><div class="mk-side"></div><div class="mk-main"><span class="w60"></span><div class="mk-cards"><span></span><span></span><span></span></div><span class="w80"></span><span class="w40"></span></div></div></div>`,
        `<div class="mock"><div class="mock-bar"><i></i><i></i><i></i></div><div class="mock-body col"><div class="mk-hero"><span class="w60"></span><span class="w40"></span></div><div class="mk-cards three"><span></span><span></span><span></span></div></div></div>`,
        `<div class="mock"><div class="mock-bar"><i></i><i></i><i></i></div><div class="mock-body col"><div class="mk-row"><span class="w40"></span><span class="pill-s"></span></div><div class="mk-table"><span></span><span></span><span></span><span></span></div></div></div>`,
      ][i % 3];

  const GH_ICON = `<svg viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M12 2a10 10 0 0 0-3.16 19.49c.5.09.68-.22.68-.48v-1.7c-2.78.6-3.37-1.34-3.37-1.34-.45-1.16-1.11-1.47-1.11-1.47-.91-.62.07-.6.07-.6 1 .07 1.53 1.03 1.53 1.03.9 1.52 2.34 1.08 2.91.83.09-.65.35-1.09.63-1.34-2.22-.25-4.55-1.11-4.55-4.94 0-1.09.39-1.98 1.03-2.68-.1-.25-.45-1.27.1-2.64 0 0 .84-.27 2.75 1.02a9.6 9.6 0 0 1 5 0c1.91-1.29 2.75-1.02 2.75-1.02.55 1.37.2 2.39.1 2.64.64.7 1.03 1.59 1.03 2.68 0 3.84-2.34 4.69-4.57 4.93.36.31.68.92.68 1.85v2.75c0 .27.18.58.69.48A10 10 0 0 0 12 2z"/></svg>`;
  const EXT_ICON = `<svg viewBox="0 0 24 24" width="16" height="16"><path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

  const renderProjects = (rows) => {
    const grid = $("#projectGrid");
    grid.innerHTML = rows.map((p, i) => {
      const img = safeUrl(p.image_url), demo = safeUrl(p.demo_url), repo = safeUrl(p.repo_url);
      const linksHtml = demo || repo
        ? `<div class="p-links">${demo ? `<a class="p-link" href="${esc(demo)}" target="_blank" rel="noopener">${EXT_ICON} Demo</a>` : ""}${repo ? `<a class="p-link" href="${esc(repo)}" target="_blank" rel="noopener">${GH_ICON} Kode</a>` : ""}</div>`
        : "";
      return `
        <article class="project reveal" data-cat="${esc(p.category)}" style="--d:${(i % 2) * 0.08}s">
          <div class="p-thumb t${(i % 6) + 1}${img ? " has-img" : ""}">
            ${img ? `<img class="p-img" src="${esc(img)}" alt="Tampilan ${esc(p.title)}" loading="lazy" />` : mockArt(p.category, i)}
            ${p.badge ? `<span class="p-badge">${esc(p.badge)}</span>` : ""}
          </div>
          <div class="p-body">
            <h3>${esc(p.title)}</h3>
            <p>${esc(p.description)}</p>
            <ul class="tags">${(p.tags || []).map((t) => `<li>${esc(t)}</li>`).join("")}</ul>
            ${linksHtml}
          </div>
        </article>`;
    }).join("");
    $('.filter[data-filter="ai"]').hidden = !rows.some((p) => p.category === "ai");
    observeReveal(grid);
    setCount($("#statProjects"), rows.length);
  };

  const renderSkills = (rows) => {
    ["web", "iot", "tools"].forEach((cat) => {
      const ul = $(`[data-skill-cat="${cat}"]`);
      const items = rows.filter((s) => s.category === cat);
      if (ul && items.length) ul.innerHTML = items.map((s) => `<li>${esc(s.name)}</li>`).join("");
    });
    const names = rows.map((s) => `<span>${esc(s.name)}</span>`).join("");
    $("#marqueeTrack").innerHTML = names + names;
    setCount($("#statSkills"), rows.length);
  };

  const renderExperiences = (rows) => {
    const tl = $("#timeline");
    tl.innerHTML = rows.map((x, i) => `
      <li class="tl-item reveal" style="--d:${i * 0.08}s">
        <span class="tl-dot"></span>
        <div class="tl-card">
          <span class="tl-date">${esc(x.period)}</span>
          <h3>${esc(x.title)}</h3>
          ${x.organization ? `<b>${esc(x.organization)}</b>` : ""}
          ${x.description ? `<p>${esc(x.description)}</p>` : ""}
        </div>
      </li>`).join("") + `
      <li class="tl-item reveal ghost"><span class="tl-dot"></span><div class="tl-card"><span class="tl-date">Berikutnya</span><h3>Perjalanan masih berlanjut</h3><p>Pengalaman baru akan terus ditambahkan.</p></div></li>`;
    observeReveal(tl);
  };

  const initials = (n) => n.trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
  const renderTestimonials = (rows) => {
    if (!rows.length) return;
    const list = $("#testiList");
    list.innerHTML = rows.map((t, i) => `
      <figure class="testi-card reveal" style="--d:${(i % 2) * 0.08}s">
        <p>${esc(t.message)}</p>
        <figcaption class="testi-who">
          <span class="avatar">${esc(initials(t.name))}</span>
          <span><b>${esc(t.name)}</b>${t.role ? `<small>${esc(t.role)}</small>` : ""}</span>
        </figcaption>
      </figure>`).join("");
    observeReveal(list);
  };

  const loadData = async () => {
    if (!IS_HTTP) return; // dibuka langsung sebagai file: pakai isi bawaan HTML
    try {
      const r = await fetch("/api/content");
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const d = await r.json();
      if (d.projects?.length) renderProjects(d.projects);
      if (d.skills?.length) renderSkills(d.skills);
      if (d.experiences?.length) renderExperiences(d.experiences);
      renderTestimonials(d.testimonials || []);
    } catch (e) {
      console.warn("Konten dari database belum tersedia, memakai isi bawaan:", e.message);
    }
  };
  loadData();

  // ---------- Catat kunjungan ----------
  if (IS_HTTP && !["localhost", "127.0.0.1"].includes(location.hostname) && !sessionStorageGet("pv")) {
    fetch("/api/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: location.pathname, referrer: document.referrer }),
      keepalive: true,
    }).then(() => sessionStorageSet("pv", "1")).catch(() => {});
  }
  function sessionStorageGet(k) { try { return sessionStorage.getItem(k); } catch { return null; } }
  function sessionStorageSet(k, v) { try { sessionStorage.setItem(k, v); } catch { /* abaikan */ } }

  // ---------- Form (kontak & testimoni) ----------
  $$("[data-for]").forEach((c) => {
    const input = document.getElementById(c.dataset.for);
    const max = input.maxLength;
    const upd = () => (c.textContent = `${input.value.length}/${max}`);
    input.addEventListener("input", upd);
    upd();
  });

  const validate = (form, rules) => {
    let ok = true;
    $$(".field", form).forEach((f) => f.classList.remove("invalid"));
    for (const [name, test, msg] of rules) {
      const el = form.elements[name];
      if (!test(el.value.trim())) {
        el.closest(".field").classList.add("invalid");
        if (ok) { showToast(msg, true); el.focus(); }
        ok = false;
      }
    }
    return ok;
  };

  const submitForm = async (form, endpoint, rules, successMsg) => {
    if (!validate(form, rules)) return;
    if (!IS_HTTP) return showToast("Form aktif setelah website di-deploy ke Vercel.", true);
    const btn = $("button[type=submit]", form);
    btn.classList.add("loading");
    try {
      const data = Object.fromEntries(new FormData(form));
      const r = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
      const out = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(out.error || "Terjadi kesalahan. Coba lagi.");
      form.reset();
      $$("[data-for]", form).forEach((c) => (c.textContent = `0/${document.getElementById(c.dataset.for).maxLength}`));
      showToast(successMsg);
    } catch (e) {
      showToast(e.message === "Failed to fetch" ? "Tidak dapat terhubung ke server." : e.message, true);
    } finally {
      btn.classList.remove("loading");
    }
  };

  const emailOk = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v);
  $("#contactForm").addEventListener("submit", (e) => {
    e.preventDefault();
    submitForm(e.target, "/api/contact", [
      ["name", (v) => v.length >= 2, "Nama minimal 2 karakter."],
      ["email", emailOk, "Masukkan email yang valid."],
      ["message", (v) => v.length >= 10, "Pesan minimal 10 karakter."],
    ], "Pesan terkirim! Saya akan segera membalas ✓");
  });

  $("#testiForm").addEventListener("submit", (e) => {
    e.preventDefault();
    submitForm(e.target, "/api/testimonial", [
      ["name", (v) => v.length >= 2, "Nama minimal 2 karakter."],
      ["message", (v) => v.length >= 10, "Testimoni minimal 10 karakter."],
    ], "Terima kasih! Testimoni akan tampil setelah disetujui ✓");
  });
})();
