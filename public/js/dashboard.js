/* ============================================================================
   public/js/dashboard.js
============================================================================ */
(function () {
  var PL = window.PayLink;
  var el = function (id) { return document.getElementById(id); };
  if (!PL.requireSession()) return;

  document.getElementById("navSlot").outerHTML = PL.bottomNav("home");
  el("logoutBtn").innerHTML = PL.icon("logout");
  el("lblMonthly").innerHTML = PL.icon("trend") + " মাসিক";
  el("lblToday").innerHTML = PL.icon("calendar") + " আজকের";
  el("lblVolume").innerHTML = PL.icon("coins") + " মোট লেনদেন";
  el("lblCount").innerHTML = PL.icon("repeat") + " ট্রানজেকশন";
  el("txHeading").innerHTML = PL.icon("clockSm") + " সাম্প্রতিক লেনদেন";

  PL.loadSettings().then(PL.enforceMaintenance);

  PL.authFetch("/api/me").then(function (r) {
    var m = r.data;
    el("whoName").textContent = "হ্যালো, " + (m.fullName || "").split(" ")[0] + "!";
    el("avatarLetter").textContent = (m.fullName || "?").charAt(0).toUpperCase();
  }).catch(function () {});

  PL.authFetch("/api/wallet/summary").then(function (r) {
    var s = r.data;
    el("balanceVal").textContent = PL.fmt(s.balance);
    el("monthlyVal").textContent = PL.fmt(s.monthly);
    el("todayVal").textContent = PL.fmt(s.today);
    el("volumeVal").textContent = PL.fmt(s.totalVolume);
    el("txCountVal").textContent = s.transactions;
  }).catch(function () {});

  var METHOD_NAMES = { bkash: "bKash", nagad: "Nagad", rocket: "Rocket", upay: "Upay" };

  PL.authFetch("/api/wallet/transactions").then(function (r) {
    var list = el("txList");
    var items = r.data.transactions || [];
    if (!items.length) { list.innerHTML = '<div class="empty">এখনো কোনো লেনদেন হয়নি</div>'; return; }
    list.innerHTML = items.map(function (t) {
      var d1 = new Date(t.verifiedAt);
      return (
        '<div class="row"><div class="l"><div class="t1">' + (t.reference || t.id) + '</div>' +
        '<div class="t2">' + (METHOD_NAMES[t.method] || t.method) + " · " + t.trxId + " · " + d1.toLocaleString("bn-BD") + "</div></div>" +
        '<div class="r"><div class="amt">+৳' + PL.fmt(t.netAmount) + "</div></div></div>"
      );
    }).join("");
  }).catch(function () {});

  el("logoutBtn").addEventListener("click", function () {
    PL.authFetch("/api/auth/logout", { method: "POST" }, false).catch(function () {}).finally(function () {
      localStorage.removeItem("pl_token");
      location.href = "/login.html";
    });
  });
})();
