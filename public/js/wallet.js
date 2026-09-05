/* ============================================================================
   public/js/wallet.js
============================================================================ */
(function () {
  var PL = window.PayLink;
  var el = function (id) { return document.getElementById(id); };
  if (!PL.requireSession()) return;

  document.getElementById("navSlot").outerHTML = PL.bottomNav("wallet");
  el("icPhone").innerHTML = PL.icon("phone");
  el("withdrawHeading").innerHTML = PL.icon("down") + " উত্তোলন করুন";
  el("historyHeading").innerHTML = PL.icon("clockSm") + " উত্তোলনের ইতিহাস";

  var METHOD_NAMES = { bkash: "bKash", nagad: "Nagad", rocket: "Rocket", upay: "Upay" };

  PL.loadSettings().then(function (settings) {
    if (PL.enforceMaintenance(settings)) return;
    el("minFeeLbl").textContent = "সর্বনিম্ন: ৳" + settings.payoutMin + " | ফি: " + settings.payoutFeePercent + "%";
  });

  function loadSummary() {
    PL.authFetch("/api/wallet/summary").then(function (r) { el("balanceVal").textContent = PL.fmt(r.data.balance); }).catch(function () {});
  }
  function loadPayouts() {
    PL.authFetch("/api/wallet/payouts").then(function (r) {
      var list = el("payoutList");
      var items = r.data.payouts || [];
      if (!items.length) { list.innerHTML = '<div class="empty">এখনো কোনো উত্তোলনের অনুরোধ নেই</div>'; return; }
      list.innerHTML = items.map(function (p) {
        var d1 = new Date(p.createdAt);
        var labels = { pending: "পেন্ডিং", completed: "সম্পন্ন", rejected: "বাতিল" };
        return (
          '<div class="row"><div class="l"><div class="t1">৳' + PL.fmt(p.amount) + " → " + p.payoutNumber + '</div>' +
          '<div class="t2">' + (METHOD_NAMES[p.method] || p.method) + " · নিট ৳" + PL.fmt(p.netAmount) + " · " + d1.toLocaleDateString("bn-BD") + "</div></div>" +
          '<div class="r"><span class="badge ' + p.status + '">' + (labels[p.status] || p.status) + "</span></div></div>"
        );
      }).join("");
    }).catch(function () {});
  }
  loadSummary(); loadPayouts();

  el("payoutForm").addEventListener("submit", function (e) {
    e.preventDefault();
    var errBox = el("errBox"), okBox = el("okBox");
    errBox.classList.remove("show"); okBox.classList.remove("show");
    var amount = Number(el("amount").value);
    var method = el("method").value;
    var payoutNumber = el("payoutNumber").value.trim();
    el("submitPayout").disabled = true;
    PL.authFetch("/api/wallet/payout", { method: "POST", body: JSON.stringify({ amount: amount, method: method, payoutNumber: payoutNumber }) })
      .then(function (r) {
        el("submitPayout").disabled = false;
        if (!r.res.ok) { errBox.textContent = r.data.error || "অনুরোধ পাঠানো যায়নি।"; errBox.classList.add("show"); return; }
        okBox.textContent = "উত্তোলনের অনুরোধ জমা হয়েছে — প্রসেস হলে টাকা পাবেন।";
        okBox.classList.add("show");
        el("payoutForm").reset();
        loadSummary(); loadPayouts();
      }).catch(function () { el("submitPayout").disabled = false; errBox.textContent = "নেটওয়ার্ক সমস্যা।"; errBox.classList.add("show"); });
  });
})();
