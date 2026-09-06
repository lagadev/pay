/* ============================================================================
   public/js/app.js — shared helpers loaded on every page.
   Exposes a single global: window.PayLink
============================================================================ */
(function () {
  const ICONS = {
    user: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 4-6 8-6s8 2 8 6"/></svg>',
    mail: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/></svg>',
    phone: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 4h4l2 5-2.5 1.5a11 11 0 005 5L15 13l5 2v4a2 2 0 01-2 2A16 16 0 013 6a2 2 0 012-2z"/></svg>',
    telegram: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 3L2 11l6 2m14-10L15 21l-7-8m14-10L8 13"/></svg>',
    lock: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="10" width="16" height="10" rx="2"/><path d="M8 10V7a4 4 0 018 0v3"/></svg>',
    check: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>',
    copy: '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a1 1 0 01-1-1V4a1 1 0 011-1h10a1 1 0 011 1v1"/></svg>',
    home: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 11l9-7 9 7"/><path d="M5 10v9a1 1 0 001 1h4v-6h4v6h4a1 1 0 001-1v-9"/></svg>',
    wallet: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="6" width="18" height="13" rx="2"/><path d="M3 10h18"/><circle cx="16" cy="14" r="1.2" fill="currentColor" stroke="none"/></svg>',
    key: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="8" cy="14" r="4"/><path d="M11 11l9-9m-3 3l2 2m-6 2l2 2"/></svg>',
    logout: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><path d="M16 17l5-5-5-5M21 12H9"/></svg>',
    x: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6L6 18M6 6l12 12"/></svg>',
    arrowLeft: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5M11 18l-6-6 6-6"/></svg>',
    bigcheck: '<svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>',
    clock: '<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/></svg>',
    bolt: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2L4 14h6l-1 8 9-12h-6z"/></svg>',
    sms: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>',
    webhook: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 007.07 0l1.93-1.93a5 5 0 00-7.07-7.07L10.5 5.5"/><path d="M14 11a5 5 0 00-7.07 0L5 12.93a5 5 0 007.07 7.07L13.5 18.5"/></svg>',
    shield: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l7 3v6c0 4.5-3 7.7-7 9-4-1.3-7-4.5-7-9V6z"/><path d="M9 12l2 2 4-4"/></svg>',
    trend: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 17l6-6 4 4 8-8"/><path d="M15 7h6v6"/></svg>',
    calendar: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>',
    coins: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="9" r="6"/><path d="M14.5 8.5A6 6 0 1114 20a6 6 0 01-2.5-.5"/></svg>',
    repeat: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 2l4 4-4 4"/><path d="M3 11V9a4 4 0 014-4h14M7 22l-4-4 4-4"/><path d="M21 13v2a4 4 0 01-4 4H3"/></svg>',
    down: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M6 13l6 6 6-6"/></svg>',
    clockSm: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/></svg>',
    megaphone: '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 11v2a2 2 0 002 2h1l4 5V5L6 9H5a2 2 0 00-2 2z"/><path d="M14 8a4 4 0 010 8"/><path d="M17 4a8 8 0 010 16"/></svg>',
    book: '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4.5A2.5 2.5 0 016.5 2H20v18H6.5A2.5 2.5 0 004 17.5v-13z"/><path d="M4 17.5A2.5 2.5 0 016.5 15H20"/></svg>',
    headset: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 13v-1a8 8 0 0116 0v1"/><rect x="2" y="13" width="5" height="7" rx="1.5"/><rect x="17" y="13" width="5" height="7" rx="1.5"/><path d="M20 20v1a3 3 0 01-3 3h-2"/></svg>',
  };

  function fmt(n) {
    return Number(n || 0).toLocaleString("en-BD", { maximumFractionDigits: 2 });
  }

  function icon(name) { return ICONS[name] || ""; }

  function showToast(message, kind) {
    let wrap = document.getElementById("plToastWrap");
    if (!wrap) {
      wrap = document.createElement("div");
      wrap.id = "plToastWrap";
      wrap.className = "toast-wrap";
      document.body.appendChild(wrap);
    }
    const t = document.createElement("div");
    t.className = "toast" + (kind ? " " + kind : "");
    t.innerHTML = '<span class="dot"></span><span>' + message + "</span>";
    wrap.appendChild(t);
    requestAnimationFrame(function () { t.classList.add("show"); });
    setTimeout(function () {
      t.classList.remove("show");
      setTimeout(function () { wrap.removeChild(t); }, 300);
    }, 3000);
  }

  function api(path, opts) {
    opts = opts || {};
    opts.headers = Object.assign({ "Content-Type": "application/json" }, opts.headers || {});
    return fetch(path, opts).then(function (res) {
      return res.json().then(function (data) { return { res: res, data: data }; }).catch(function () {
        return { res: res, data: {} };
      });
    });
  }

  function authFetch(path, opts, opt_redirectOn401) {
    const token = localStorage.getItem("pl_token");
    if (!token) { location.href = "/login.html"; return Promise.reject(new Error("no token")); }
    opts = opts || {};
    opts.headers = Object.assign({ "Content-Type": "application/json" }, opts.headers || {}, { Authorization: "Bearer " + token });
    return fetch(path, opts).then(function (res) {
      if (res.status === 401 && opt_redirectOn401 !== false) {
        localStorage.removeItem("pl_token");
        location.href = "/login.html";
        return Promise.reject(new Error("unauthorized"));
      }
      return res.json().then(function (data) { return { res: res, data: data }; });
    });
  }

  function requireSession() {
    if (!localStorage.getItem("pl_token")) { location.href = "/login.html"; return false; }
    return true;
  }

  function bottomNav(active) {
    function item(id, iconName, label, href) {
      const on = id === active;
      return '<a class="navitem' + (on ? " active" : "") + '" href="' + href + '">' + icon(iconName) + "<span>" + label + "</span></a>";
    }
    return (
      '<nav class="bottomnav"><div class="inner">' +
      item("home", "home", "হোম", "/dashboard.html") +
      item("wallet", "wallet", "ওয়ালেট", "/wallet.html") +
      item("keys", "key", "API", "/keys.html") +
      "</div></nav>"
    );
  }

  let _settingsCache = null;
  function loadSettings() {
    if (_settingsCache) return Promise.resolve(_settingsCache);
    return api("/api/settings").then(function (r) {
      _settingsCache = r.data;
      applySettingsToDom(r.data);
      return r.data;
    });
  }

  function applySettingsToDom(settings) {
    document.querySelectorAll("[data-site-name]").forEach(function (el) { el.textContent = settings.siteName; });
    document.querySelectorAll("[data-site-mark]").forEach(function (el) {
      if (settings.logoUrl) {
        el.innerHTML = '<img src="' + settings.logoUrl + '" alt="' + (settings.siteName || "Logo") + '" />';
      } else {
        el.textContent = (settings.siteName || "P").charAt(0);
      }
    });
    if (settings.announcement) {
      document.querySelectorAll("[data-announcement]").forEach(function (el) {
        el.innerHTML = icon("megaphone") + "<span>" + settings.announcement + "</span>";
        el.style.display = "flex";
      });
    }
  }

  function enforceMaintenance(settings) {
    if (settings.maintenanceMode) {
      document.body.innerHTML =
        '<div class="page" style="padding-top:90px; text-align:center;">' +
        '<div class="pill gold" style="margin-bottom:18px;">রক্ষণাবেক্ষণ চলছে</div>' +
        "<h1 style=\"font-size:22px;\">" + (settings.siteName || "PayLink") + " সাময়িকভাবে বন্ধ আছে</h1>" +
        '<p style="color:var(--ink-soft); font-size:14px; margin-top:10px;">আমরা কিছু উন্নতির কাজ করছি। একটু পরে আবার চেষ্টা করুন।</p>' +
        "</div>";
      return true;
    }
    return false;
  }

  window.PayLink = {
    ICONS, icon, fmt, showToast, api, authFetch, requireSession, bottomNav, loadSettings, enforceMaintenance,
  };
})();
