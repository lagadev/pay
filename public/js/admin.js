/* ============================================================================
   public/js/admin.js — everything behind the ADMIN_KEY gate: overview,
   merchant management + manual balance adjustments, invoice search + manual
   verification, withdrawal processing, and the live settings editor.
============================================================================ */
(function () {
  var PL = window.PayLink;
  var qsa = function (s, root) { return Array.prototype.slice.call((root || document).querySelectorAll(s)); };
  var METHOD_NAMES = { bkash: "bKash", nagad: "Nagad", rocket: "Rocket", upay: "Upay" };
  var STATUS_LABELS = { pending: "পেন্ডিং", verified: "যাচাইকৃত", expired: "মেয়াদোত্তীর্ণ", completed: "সম্পন্ন", rejected: "বাতিল", active: "সক্রিয়", suspended: "সাসপেন্ড" };
  var key = sessionStorage.getItem("pl_admin_key");

  function adminFetch(url, opts) {
    opts = opts || {};
    opts.headers = Object.assign({ "Content-Type": "application/json" }, opts.headers || {}, { Authorization: "Bearer " + key });
    return fetch(url, opts).then(function (res) {
      return res.json().then(function (data) { return { res: res, data: data }; }).catch(function () { return { res: res, data: {} }; });
    });
  }

  // ---- gate ---------------------------------------------------------------

  function gateBody() {
    return (
      '<div class="admin-gate">' +
      '<div class="mark">' + PL.icon("shield") + '</div>' +
      '<h1>অ্যাডমিন অ্যাক্সেস</h1>' +
      '<p>চালিয়ে যেতে আপনার অ্যাডমিন কী দিন।</p>' +
      '<div class="alert bad" id="gateErr"></div>' +
      '<input id="adminKeyInput" type="password" placeholder="অ্যাডমিন কী" />' +
      '<button class="btn btn-primary btn-block" id="gateBtn">আনলক করুন</button>' +
      '</div>'
    );
  }

  function showGate(msg) {
    document.getElementById("appRoot").innerHTML = gateBody();
    if (msg) { var e = document.getElementById("gateErr"); e.textContent = msg; e.classList.add("show"); }
    document.getElementById("gateBtn").addEventListener("click", tryUnlock);
    document.getElementById("adminKeyInput").addEventListener("keydown", function (e) { if (e.key === "Enter") tryUnlock(); });
  }

  function tryUnlock() {
    var val = document.getElementById("adminKeyInput").value.trim();
    if (!val) return;
    key = val;
    adminFetch("/api/admin/overview").then(function (r) {
      if (!r.res.ok) { showGate("ভুল অ্যাডমিন কী।"); key = null; return; }
      sessionStorage.setItem("pl_admin_key", val);
      boot();
    });
  }

  // ---- shell + tabs ---------------------------------------------------------

  function panelBody() {
    return (
      '<div class="admin-wrap">' +
        '<div class="admin-topbar"><div class="t">' + PL.icon("shield") + ' অ্যাডমিন প্যানেল</div><button class="icon-btn" id="adminLogout"></button></div>' +
        '<div class="admin-tabs">' +
          '<button data-tab="overview" class="active">ওভারভিউ</button>' +
          '<button data-tab="merchants">মার্চেন্ট</button>' +
          '<button data-tab="invoices">ইনভয়েস</button>' +
          '<button data-tab="withdrawals">উত্তোলন</button>' +
          '<button data-tab="settings">সেটিংস</button>' +
        '</div>' +

        '<div class="admin-view active" id="tab-overview"><div class="ov-grid" id="ovGrid"></div></div>' +

        '<div class="admin-view" id="tab-merchants">' +
          '<div class="searchrow"><input id="merchantSearch" placeholder="নাম, ইমেইল বা মোবাইল দিয়ে খুঁজুন" /></div>' +
          '<div id="merchantList"><div class="empty">লোড হচ্ছে…</div></div>' +
        '</div>' +

        '<div class="admin-view" id="tab-invoices">' +
          '<div class="searchrow">' +
            '<input id="invoiceSearch" placeholder="ID, TrxID, রেফারেন্স বা ইমেইল দিয়ে খুঁজুন" />' +
            '<select id="invoiceStatus"><option value="all">সব</option><option value="pending">পেন্ডিং</option><option value="verified">যাচাইকৃত</option><option value="expired">মেয়াদোত্তীর্ণ</option></select>' +
          '</div>' +
          '<div id="invoiceList"><div class="empty">লোড হচ্ছে…</div></div>' +
        '</div>' +

        '<div class="admin-view" id="tab-withdrawals">' +
          '<div class="po-tabs">' +
            '<button data-status="pending" class="active">পেন্ডিং</button>' +
            '<button data-status="completed">সম্পন্ন</button>' +
            '<button data-status="rejected">বাতিল</button>' +
            '<button data-status="all">সব</button>' +
          '</div>' +
          '<div id="payoutList"><div class="empty">লোড হচ্ছে…</div></div>' +
        '</div>' +

        '<div class="admin-view" id="tab-settings"><div class="card-p settings-form" id="settingsForm"><div class="empty">লোড হচ্ছে…</div></div></div>' +
      '</div>'
    );
  }

  function wireTabs() {
    qsa(".admin-tabs button").forEach(function (btn) {
      btn.addEventListener("click", function () {
        qsa(".admin-tabs button").forEach(function (b) { b.classList.remove("active"); });
        qsa(".admin-view").forEach(function (v) { v.classList.remove("active"); });
        btn.classList.add("active");
        document.getElementById("tab-" + btn.dataset.tab).classList.add("active");
      });
    });
  }

  function boot() {
    document.getElementById("appRoot").innerHTML = panelBody();
    wireTabs();
    document.getElementById("adminLogout").innerHTML = PL.icon("logout");
    document.getElementById("adminLogout").addEventListener("click", function () {
      sessionStorage.removeItem("pl_admin_key");
      location.reload();
    });

    loadOverview();
    loadMerchants();
    loadInvoices();
    loadPayouts("pending");
    loadSettings();

    document.getElementById("merchantSearch").addEventListener("input", debounce(loadMerchants, 300));
    document.getElementById("invoiceSearch").addEventListener("input", debounce(loadInvoices, 300));
    document.getElementById("invoiceStatus").addEventListener("change", loadInvoices);
    document.addEventListener("click", function (e) {
      if (e.target.matches && e.target.matches(".po-tabs button")) {
        qsa(".po-tabs button").forEach(function (b) { b.classList.remove("active"); });
        e.target.classList.add("active");
        loadPayouts(e.target.dataset.status);
      }
    });
  }

  function debounce(fn, ms) {
    var t;
    return function () { clearTimeout(t); var args = arguments; t = setTimeout(function () { fn.apply(null, args); }, ms); };
  }

  // ---- overview ---------------------------------------------------------------

  function loadOverview() {
    adminFetch("/api/admin/overview").then(function (r) {
      if (!r.res.ok) return;
      var d = r.data;
      document.getElementById("ovGrid").innerHTML =
        card("মোট মার্চেন্ট", d.merchantCount, "user") +
        card("আজকের ভলিউম", "৳" + PL.fmt(d.todayVolume) + " (" + d.todayCount + "টি)", "calendar") +
        card("যাচাইকৃত ভলিউম", "৳" + PL.fmt(d.verifiedVolume), "trend") +
        card("প্ল্যাটফর্ম রেভিনিউ", "৳" + PL.fmt(d.platformRevenue), "coins") +
        card("পেন্ডিং উত্তোলন", d.pendingPayoutCount + " (৳" + PL.fmt(d.pendingPayoutAmount) + ")", "down") +
        card("পেন্ডিং ইনভয়েস", d.pendingInvoiceCount, "clockSm");
    });
  }
  function card(lbl, val, iconName) {
    return '<div class="ov-card"><div class="lbl">' + PL.icon(iconName) + " " + lbl + '</div><div class="val">' + val + "</div></div>";
  }

  // ---- merchants ---------------------------------------------------------------

  function loadMerchants() {
    var q = document.getElementById("merchantSearch").value.trim();
    adminFetch("/api/admin/merchants?q=" + encodeURIComponent(q)).then(function (r) {
      if (!r.res.ok) return;
      var list = document.getElementById("merchantList");
      var rows = r.data.merchants || [];
      if (!rows.length) { list.innerHTML = '<div class="empty">কোনো মার্চেন্ট পাওয়া যায়নি</div>'; return; }
      list.innerHTML = rows.map(function (m) {
        return (
          '<div class="merchant-card">' +
            '<div class="mtop"><div><div class="mname">' + m.fullName + '</div>' +
            '<div class="mmeta">' + m.email + " · " + m.mobile + (m.telegram ? " · " + m.telegram : "") + '<br/>যোগ দিয়েছেন ' + new Date(m.createdAt).toLocaleDateString("bn-BD") + '</div></div>' +
            '<span class="badge ' + m.status + '">' + (STATUS_LABELS[m.status] || m.status) + '</span></div>' +
            '<div class="mstats"><div>ব্যালেন্স<b>৳' + PL.fmt(m.balance) + '</b></div><div>লেনদেন<b>' + m.transactionCount + '</b></div><div>ভলিউম<b>৳' + PL.fmt(m.transactionVolume) + '</b></div></div>' +
            '<div class="mactions">' +
              '<button data-id="' + m.id + '" data-next="' + (m.status === "active" ? "suspended" : "active") + '" class="toggleStatus">' + (m.status === "active" ? "সাসপেন্ড করুন" : "সক্রিয় করুন") + '</button>' +
              '<button data-id="' + m.id + '" class="adjustBalance">ব্যালেন্স সমন্বয়</button>' +
            '</div>' +
          '</div>'
        );
      }).join("");
      qsa(".toggleStatus").forEach(function (btn) {
        btn.addEventListener("click", function () {
          adminFetch("/api/admin/merchants/" + btn.dataset.id + "/status", { method: "POST", body: JSON.stringify({ status: btn.dataset.next }) }).then(function () { loadMerchants(); });
        });
      });
      qsa(".adjustBalance").forEach(function (btn) {
        btn.addEventListener("click", function () {
          var amount = prompt("কত টাকা যোগ (ধনাত্মক) বা বিয়োগ (ঋণাত্মক) করবেন?");
          if (amount === null || !Number(amount)) return;
          var reason = prompt("কারণ লিখুন (ঐচ্ছিক):") || "";
          adminFetch("/api/admin/merchants/" + btn.dataset.id + "/adjust-balance", { method: "POST", body: JSON.stringify({ amount: Number(amount), reason: reason }) })
            .then(function (r) {
              if (!r.res.ok) { PL.showToast(r.data.error || "সমন্বয় করা যায়নি।", "bad"); return; }
              PL.showToast("ব্যালেন্স সফলভাবে সমন্বয় করা হয়েছে।", "good");
              loadMerchants(); loadOverview();
            });
        });
      });
    });
  }

  // ---- invoices ---------------------------------------------------------------

  function loadInvoices() {
    var q = document.getElementById("invoiceSearch").value.trim();
    var status = document.getElementById("invoiceStatus").value;
    adminFetch("/api/admin/invoices?q=" + encodeURIComponent(q) + "&status=" + status).then(function (r) {
      if (!r.res.ok) return;
      var list = document.getElementById("invoiceList");
      var rows = r.data.invoices || [];
      if (!rows.length) { list.innerHTML = '<div class="empty">কোনো ইনভয়েস পাওয়া যায়নি</div>'; return; }
      list.innerHTML = rows.map(function (i) {
        var canVerify = i.status === "pending";
        return (
          '<div class="inv-card">' +
            '<div class="top"><span class="id">' + i.id + '</span><span class="badge ' + i.status + '">' + (STATUS_LABELS[i.status] || i.status) + '</span></div>' +
            '<div class="meta">' + i.merchantName + " (" + i.merchantEmail + ")<br/>" +
            "৳" + PL.fmt(i.amount) + " · " + (METHOD_NAMES[i.method] || i.method || "—") + (i.trxId ? " · Trx: " + i.trxId : "") + (i.verifiedBy ? " · " + (i.verifiedBy === "admin" ? "ম্যানুয়াল ভেরিফাই" : "SMS ভেরিফাই") : "") + "<br/>" +
            new Date(i.createdAt).toLocaleString("bn-BD") + "</div>" +
            (canVerify ? '<div class="actions"><button data-id="' + i.id + '" class="manualVerify">ম্যানুয়ালি যাচাই করুন</button></div>' : "") +
          "</div>"
        );
      }).join("");
      qsa(".manualVerify").forEach(function (btn) {
        btn.addEventListener("click", function () {
          if (!confirm("এই ইনভয়েসটি ম্যানুয়ালি যাচাই করে মার্চেন্টের ব্যালেন্সে জমা করতে চান?")) return;
          var trxId = prompt("Transaction ID (থাকলে দিন, না থাকলে ফাঁকা রাখুন):") || "";
          adminFetch("/api/admin/invoices/" + btn.dataset.id + "/verify", { method: "POST", body: JSON.stringify({ trxId: trxId }) })
            .then(function (r) {
              if (!r.res.ok) { PL.showToast(r.data.error || "যাচাই করা যায়নি।", "bad"); return; }
              PL.showToast("ইনভয়েস যাচাই করে ব্যালেন্সে জমা করা হয়েছে।", "good");
              loadInvoices(); loadOverview();
            });
        });
      });
    });
  }

  // ---- withdrawals ---------------------------------------------------------------

  function loadPayouts(status) {
    adminFetch("/api/admin/payouts?status=" + status).then(function (r) {
      if (!r.res.ok) return;
      var list = document.getElementById("payoutList");
      var rows = r.data.payouts || [];
      if (!rows.length) { list.innerHTML = '<div class="empty">কোনো ' + (STATUS_LABELS[status] || status) + ' উত্তোলন নেই</div>'; return; }
      list.innerHTML = rows.map(function (p) {
        var actions = p.status === "pending"
          ? '<div class="actions"><button class="complete" data-id="' + p.id + '" data-act="complete">পাঠানো হয়েছে</button><button class="reject" data-id="' + p.id + '" data-act="reject">বাতিল করুন</button></div>'
          : (p.note ? '<div class="meta" style="margin-top:6px;">নোটঃ ' + p.note + '</div>' : "");
        return (
          '<div class="po-card"><div class="top"><div class="amt">৳' + PL.fmt(p.amount) + '</div><span class="badge ' + p.status + '">' + (STATUS_LABELS[p.status] || p.status) + '</span></div>' +
          '<div class="meta">' + p.merchantName + " (" + p.merchantEmail + ")<br/>" + (METHOD_NAMES[p.method] || p.method) + " → " + p.payoutNumber + " · নিট ৳" + PL.fmt(p.netAmount) + " · " + new Date(p.createdAt).toLocaleString("bn-BD") + '</div>' +
          actions + "</div>"
        );
      }).join("");
      qsa(".po-card button[data-act]").forEach(function (btn) {
        btn.addEventListener("click", function () {
          var note = btn.dataset.act === "reject" ? (prompt("বাতিলের কারণ (ঐচ্ছিক):") || "") : (prompt("নোট (ঐচ্ছিক):") || "");
          adminFetch("/api/admin/payouts/" + btn.dataset.id + "/" + btn.dataset.act, { method: "POST", body: JSON.stringify({ note: note }) })
            .then(function () { loadPayouts(status); loadOverview(); });
        });
      });
    });
  }

  // ---- settings ---------------------------------------------------------------

  function loadSettings() {
    adminFetch("/api/admin/settings").then(function (r) {
      if (!r.res.ok) return;
      var s = r.data;
      var f = document.getElementById("settingsForm");

      function text(id, label, val, monoCls) {
        return '<div class="field' + (monoCls ? " mono" : "") + '"><label>' + label + '</label><input id="' + id + '" value="' + (val === undefined || val === null ? "" : val) + '" /></div>';
      }
      function toggle(id, label, val) {
        return '<div class="toggle-row"><span class="tl">' + label + '</span><label class="switch"><input type="checkbox" id="' + id + '" ' + (val ? "checked" : "") + '><span class="slider"></span></label></div>';
      }
      function groupTitle(iconName, label) { return '<div class="settings-group-title">' + PL.icon(iconName) + " " + label + "</div>"; }

      f.innerHTML =
        groupTitle("shield", "সাইট") +
        text("SITE_NAME", "সাইটের নাম", s.SITE_NAME) +

        groupTitle("wallet", "পেমেন্ট মেথড — নম্বর") +
        text("MERCHANT_BKASH_NUMBER", "bKash গ্রহণকারী নম্বর", s.MERCHANT_BKASH_NUMBER, true) +
        text("MERCHANT_NAGAD_NUMBER", "Nagad গ্রহণকারী নম্বর", s.MERCHANT_NAGAD_NUMBER, true) +
        text("MERCHANT_ROCKET_NUMBER", "Rocket গ্রহণকারী নম্বর", s.MERCHANT_ROCKET_NUMBER, true) +
        text("MERCHANT_UPAY_NUMBER", "Upay গ্রহণকারী নম্বর", s.MERCHANT_UPAY_NUMBER, true) +

        groupTitle("coins", "ফি ও সীমা") +
        text("INVOICE_TTL_MINUTES", "ইনভয়েসের মেয়াদ (মিনিট)", s.INVOICE_TTL_MINUTES) +
        text("INVOICE_FEE_PERCENT", "ইনভয়েসে প্ল্যাটফর্ম ফি (%)", s.INVOICE_FEE_PERCENT) +
        text("PAYOUT_FEE_PERCENT", "উত্তোলনে ফি (%)", s.PAYOUT_FEE_PERCENT) +
        text("PAYOUT_MIN", "সর্বনিম্ন উত্তোলন (৳)", s.PAYOUT_MIN) +

        groupTitle("telegram", "সাপোর্ট যোগাযোগ") +
        text("SUPPORT_TELEGRAM", "টেলিগ্রাম ইউজারনেম (@ ছাড়া)", s.SUPPORT_TELEGRAM) +
        text("SUPPORT_WHATSAPP", "হোয়াটসঅ্যাপ নম্বর", s.SUPPORT_WHATSAPP, true) +
        text("SUPPORT_PHONE", "ফোন নম্বর", s.SUPPORT_PHONE, true) +

        groupTitle("megaphone", "ঘোষণা") +
        text("ANNOUNCEMENT_TEXT", "ড্যাশবোর্ডের ঘোষণা (ফাঁকা রাখলে দেখাবে না)", s.ANNOUNCEMENT_TEXT) +

        '<div class="settings-group-title">' + PL.icon("bolt") + " সুইচসমূহ</div>" +
        toggle("SIGNUP_ENABLED", "নতুন সাইনআপ চালু রাখুন", s.SIGNUP_ENABLED) +
        toggle("BKASH_ENABLED", "bKash চালু রাখুন", s.BKASH_ENABLED) +
        toggle("NAGAD_ENABLED", "Nagad চালু রাখুন", s.NAGAD_ENABLED) +
        toggle("ROCKET_ENABLED", "Rocket চালু রাখুন", s.ROCKET_ENABLED) +
        toggle("UPAY_ENABLED", "Upay চালু রাখুন", s.UPAY_ENABLED) +
        toggle("MAINTENANCE_MODE", "রক্ষণাবেক্ষণ মোড (সাইট বন্ধ রাখুন)", s.MAINTENANCE_MODE) +

        '<div class="alert good" id="saveOk" style="margin-top:16px;">সেটিংস সংরক্ষণ করা হয়েছে।</div>' +
        '<button class="btn btn-primary btn-block" id="saveSettings" style="margin-top:4px;">সেটিংস সংরক্ষণ করুন</button>';

      document.getElementById("saveSettings").addEventListener("click", function () {
        var ids = [
          "SITE_NAME", "MERCHANT_BKASH_NUMBER", "MERCHANT_NAGAD_NUMBER", "MERCHANT_ROCKET_NUMBER", "MERCHANT_UPAY_NUMBER",
          "INVOICE_TTL_MINUTES", "INVOICE_FEE_PERCENT", "PAYOUT_FEE_PERCENT", "PAYOUT_MIN",
          "SUPPORT_TELEGRAM", "SUPPORT_WHATSAPP", "SUPPORT_PHONE", "ANNOUNCEMENT_TEXT",
        ];
        var toggles = ["SIGNUP_ENABLED", "BKASH_ENABLED", "NAGAD_ENABLED", "ROCKET_ENABLED", "UPAY_ENABLED", "MAINTENANCE_MODE"];
        var patch = {};
        ids.forEach(function (id) { patch[id] = document.getElementById(id).value; });
        toggles.forEach(function (id) { patch[id] = document.getElementById(id).checked; });
        adminFetch("/api/admin/settings", { method: "POST", body: JSON.stringify(patch) }).then(function () {
          var ok = document.getElementById("saveOk");
          ok.classList.add("show");
          setTimeout(function () { ok.classList.remove("show"); }, 2500);
        });
      });
    });
  }

  if (key) { adminFetch("/api/admin/overview").then(function (r) { if (r.res.ok) boot(); else showGate(); }); }
  else { showGate(); }
})();
