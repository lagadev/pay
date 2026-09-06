/* ============================================================================
   public/js/invoice.js — drives pay.html through: loading -> select method
   -> enter transaction ID -> success / expired.
============================================================================ */
(function () {
  var PL = window.PayLink;
  var el = function (id) { return document.getElementById(id); };
  var qs = new URLSearchParams(location.search);
  var invoiceId = qs.get("id");

  var states = ["loadingState", "errorState", "selectMethodState", "payState", "successState", "expiredState"];
  function show(id) { states.forEach(function (s) { el(s).classList.toggle("hidden", s !== id); }); }

  var METHOD_META = {
    bkash: { name: "bKash", ussd: "*247#", color: "var(--bkash)", logo: "/assets/methods/bkash.svg" },
    nagad: { name: "Nagad", ussd: "*167#", color: "var(--nagad)", logo: "/assets/methods/nagad.svg" },
    rocket: { name: "Rocket", ussd: "*322#", color: "var(--rocket)", logo: "/assets/methods/rocket.svg" },
    upay: { name: "Upay", ussd: "*268#", color: "var(--upay)", logo: "/assets/methods/upay.svg" },
  };

  var invoice = null, settings = null, pollTimer = null, tickTimer = null, expiredHandled = false;

  el("errIcon").innerHTML = PL.icon("x");
  el("successIcon").innerHTML = PL.icon("bigcheck");
  el("expiredIcon").innerHTML = PL.icon("clock");
  el("backHomeBtn1").innerHTML = PL.icon("arrowLeft");
  el("closeBtn").innerHTML = PL.icon("x");
  el("backMethodBtn").innerHTML = PL.icon("arrowLeft");
  el("secureFoot").innerHTML = PL.icon("lock") + "<span>নিরাপদ পেমেন্ট</span>";

  el("backHomeBtn1").addEventListener("click", function () { location.href = "/index.html"; });
  el("closeBtn").addEventListener("click", function () {
    if (confirm("আপনি কি পেমেন্ট থেকে বের হয়ে যেতে চান?")) location.href = "/index.html";
  });
  el("backMethodBtn").addEventListener("click", function () {
    clearInterval(tickTimer);
    if (pollTimer) clearInterval(pollTimer);
    renderMethodGrid();
    show("selectMethodState");
    tickTimer = setInterval(renderTimer, 1000);
  });

  el("viewDetailsBtn").addEventListener("click", function () {
    var box = el("detailsBox");
    box.classList.toggle("show");
    if (box.classList.contains("show") && invoice) {
      box.innerHTML =
        "<div>ইনভয়েস আইডিঃ <b>" + invoice.id + "</b></div>" +
        (invoice.reference ? "<div>রেফারেন্সঃ <b>" + invoice.reference + "</b></div>" : "") +
        "<div>পরিমাণঃ <b>৳" + PL.fmt(invoice.amount) + "</b></div>";
    }
  });

  function renderContactRow() {
    var s = settings.support || {};
    var items = [];
    if (s.telegram) items.push('<a class="ic" href="https://t.me/' + s.telegram.replace(/^@/, "") + '" target="_blank" rel="noopener">' + PL.icon("headset") + "</a>");
    if (s.whatsapp) items.push('<a class="ic wa" href="https://wa.me/' + s.whatsapp.replace(/\D/g, "") + '" target="_blank" rel="noopener">' + PL.icon("phone") + "</a>");
    if (s.phone) items.push('<a class="ic call" href="tel:' + s.phone + '">' + PL.icon("phone") + "</a>");
    el("contactRow").innerHTML = items.join("");
    if (!items.length) el("contactRow").style.display = "none";
  }

  function renderMethodGrid() {
    var order = ["bkash", "nagad", "rocket", "upay"];
    el("methodGrid").innerHTML = order.map(function (key) {
      var meta = METHOD_META[key];
      var enabled = settings.methods && settings.methods[key];
      return (
        '<button class="method-card" data-method="' + key + '"' + (enabled ? "" : " disabled") + '>' +
        '<img src="' + meta.logo + '" alt="' + meta.name + '" />' +
        '<span class="name">' + meta.name + "</span></button>"
      );
    }).join("");
    Array.prototype.forEach.call(document.querySelectorAll(".method-card"), function (btn) {
      btn.addEventListener("click", function () { if (!btn.disabled) pickMethod(btn.getAttribute("data-method")); });
    });
  }

  function buildInstructions(method, number, amount) {
    var m = METHOD_META[method] || METHOD_META.bkash;
    var brand = m.name.toUpperCase();
    return (
      '<li><span class="dot"></span><span>' + m.ussd + " ডায়াল করে আপনার " + brand + " মোবাইল মেনুতে যান অথবা " + brand + ' অ্যাপে যান।</span></li>' +
      '<li><span class="dot"></span><span><span class="hl">"Send Money"</span> -এ ক্লিক করুন।</span></li>' +
      '<li><span class="dot"></span><span>প্রাপক নম্বর হিসেবে এই নম্বরটি লিখুনঃ<br/><span class="hl">' + number + '</span><button class="copytag" id="copyNumBtn" type="button">Copy</button></span></li>' +
      '<li><span class="dot"></span><span>টাকার পরিমাণঃ <span class="hl">৳' + PL.fmt(amount) + '</span></span></li>' +
      '<li><span class="dot"></span><span>নিশ্চিত করতে এখন আপনার ' + brand + ' মোবাইল মেনু পিন লিখুন।</span></li>' +
      '<li><span class="dot"></span><span>সবকিছু ঠিক থাকলে, আপনি ' + brand + ' থেকে একটি নিশ্চিতকরণ বার্তা পাবেন।</span></li>' +
      '<li><span class="dot"></span><span>এখন উপরের বক্সে আপনার Transaction ID দিন এবং নিচের VERIFY বাটনে ক্লিক করুন।</span></li>'
    );
  }

  function applyPayTheme(method) {
    var m = METHOD_META[method] || METHOD_META.bkash;
    document.documentElement.style.setProperty("--pay-accent", m.color);
    el("methodLogoBox").innerHTML = '<img src="' + m.logo + '" alt="' + m.name + '" /><span class="lbl">' + m.name + "</span>";
  }

  function renderTimer() {
    if (!invoice) return;
    var remainingMs = invoice.expiresAt - Date.now();
    if (remainingMs <= 0) {
      handleExpiry();
      return;
    }
    var s = Math.floor(remainingMs / 1000);
    var text = String(Math.floor(s / 60)).padStart(2, "0") + ":" + String(s % 60).padStart(2, "0");
    if (el("timerText1")) el("timerText1").textContent = text;
    if (el("timerText2")) el("timerText2").textContent = text;
  }

  function handleExpiry() {
    if (expiredHandled) return;
    expiredHandled = true;
    clearInterval(tickTimer);
    if (pollTimer) clearInterval(pollTimer);
    show("expiredState");
    setTimeout(function () { location.href = "/index.html"; }, 1000);
  }

  function showSuccess(trxId) {
    clearInterval(tickTimer);
    if (pollTimer) clearInterval(pollTimer);
    el("successTrx").textContent = "Transaction ID: " + trxId;
    show("successState");
  }

  function enterPayState() {
    applyPayTheme(invoice.method);
    el("instrList").innerHTML = buildInstructions(invoice.method, invoice.merchantNumber, invoice.amount);
    show("payState");
    renderTimer();
    tickTimer = setInterval(renderTimer, 1000);
    pollTimer = setInterval(pollInvoice, 4000);
  }

  function showPayLoading() { el("payFormContent").classList.add("hidden"); el("payLoading").classList.add("show"); }
  function hidePayLoading() { el("payLoading").classList.remove("show"); el("payFormContent").classList.remove("hidden"); }

  function loadInvoice() {
    if (!invoiceId) {
      el("errorTitle").textContent = "লিংকটি সঠিক নয়";
      el("errorMsg").textContent = "কোনো Invoice ID পাওয়া যায়নি।";
      show("errorState");
      return;
    }
    PL.api("/api/invoices/" + encodeURIComponent(invoiceId)).then(function (r) {
      if (!r.res.ok) {
        el("errorTitle").textContent = "ইনভয়েস খুঁজে পাওয়া যায়নি";
        el("errorMsg").textContent = r.data.error || "";
        show("errorState");
        return;
      }
      invoice = r.data;
      el("selectAmount").textContent = PL.fmt(invoice.amount);
      if (invoice.status === "verified") { showSuccess(invoice.trxId); return; }
      if (invoice.status === "expired") { handleExpiry(); return; }
      renderContactRow();
      if (!invoice.method) { renderMethodGrid(); show("selectMethodState"); tickTimer = setInterval(renderTimer, 1000); renderTimer(); return; }
      enterPayState();
    }).catch(function () {
      el("errorTitle").textContent = "নেটওয়ার্ক সমস্যা";
      el("errorMsg").textContent = "ইনভয়েস লোড করা যায়নি। আবার চেষ্টা করুন।";
      show("errorState");
    });
  }

  function pickMethod(method) {
    Array.prototype.forEach.call(document.querySelectorAll(".method-card"), function (b) { b.disabled = true; });
    PL.api("/api/invoices/" + encodeURIComponent(invoiceId) + "/select-method", { method: "POST", body: JSON.stringify({ method: method }) })
      .then(function (r) {
        if (!r.res.ok || r.data.error) { renderMethodGrid(); PL.showToast(r.data.error || "মেথড সিলেক্ট করা যায়নি।", "bad"); return; }
        invoice = r.data;
        clearInterval(tickTimer);
        enterPayState();
      }).catch(function () { renderMethodGrid(); });
  }

  function pollInvoice() {
    if (!invoice) return;
    PL.api("/api/invoices/" + encodeURIComponent(invoice.id)).then(function (r) {
      if (!r.res.ok) return;
      invoice.status = r.data.status;
      if (r.data.status === "verified") showSuccess(r.data.trxId);
      else if (r.data.status === "expired") handleExpiry();
    }).catch(function () {});
  }

  el("verifyForm").addEventListener("submit", function (e) {
    e.preventDefault();
    if (!invoice) return;
    var trxId = el("trxId").value.trim();
    if (!trxId) return;
    el("submitBtn").disabled = true;
    showPayLoading();
    var verifyCall = PL.api("/api/invoices/" + encodeURIComponent(invoice.id) + "/verify", { method: "POST", body: JSON.stringify({ trxId: trxId }) })
      .catch(function (err) { return { res: null, data: { error: String(err) } }; });
    var minWait = new Promise(function (resolve) { setTimeout(resolve, 5000); });
    Promise.all([verifyCall, minWait]).then(function (results) {
      var r = results[0];
      if (r.res && r.res.status === 409) {
        hidePayLoading(); el("submitBtn").disabled = false;
        PL.showToast(r.data.error || r.data.message || "এই Transaction ID আগেই ব্যবহার হয়েছে।", "bad");
        return;
      }
      if (r.data && r.data.status === "verified") { showSuccess(r.data.trxId); return; }
      PL.api("/api/invoices/" + encodeURIComponent(invoice.id)).then(function (r2) {
        if (r2.data && r2.data.status === "verified") { showSuccess(r2.data.trxId); return; }
        if (r2.data && r2.data.status === "expired") { handleExpiry(); return; }
        hidePayLoading(); el("submitBtn").disabled = false;
        PL.showToast("TrxID এখনো পাওয়া যায়নি। একটু পর আবার চেষ্টা করুন।", "bad");
      }).catch(function () { hidePayLoading(); el("submitBtn").disabled = false; PL.showToast("নেটওয়ার্ক সমস্যা হয়েছে।", "bad"); });
    });
  });

  el("instrList").addEventListener("click", function (e) {
    if (e.target && e.target.id === "copyNumBtn") {
      navigator.clipboard.writeText(invoice.merchantNumber).then(function () {
        e.target.textContent = "Copied";
        e.target.classList.add("copied");
        setTimeout(function () { e.target.textContent = "Copy"; e.target.classList.remove("copied"); }, 1200);
      });
    }
  });

  PL.loadSettings().then(function (s) {
    settings = s;
    loadInvoice();
  });
})();
