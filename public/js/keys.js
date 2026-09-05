/* ============================================================================
   public/js/keys.js
============================================================================ */
(function () {
  var PL = window.PayLink;
  var el = function (id) { return document.getElementById(id); };
  if (!PL.requireSession()) return;

  document.getElementById("navSlot").outerHTML = PL.bottomNav("keys");
  el("keysHeading").innerHTML = PL.icon("key") + " API Keys";
  el("copyBtn").innerHTML = PL.icon("copy") + " API Key কপি করুন";
  el("regenBtn").innerHTML = "নতুন সিক্রেট কী তৈরি করুন";
  el("regenNote").textContent = "কী রিজেনারেট করলে পুরনো কী সাথে সাথে অকার্যকর হয়ে যাবে — ইন্টিগ্রেশন থাকলে সাথে সাথে আপডেট করুন।";
  el("docsLink").textContent = "ডেভেলপার ডকুমেন্টেশন";

  PL.loadSettings().then(PL.enforceMaintenance);

  function load() { PL.authFetch("/api/keys").then(function (r) { el("apiKeyBox").value = r.data.apiKey; }).catch(function () {}); }
  load();

  el("copyBtn").addEventListener("click", function () {
    navigator.clipboard.writeText(el("apiKeyBox").value).then(function () {
      el("copyBtn").innerHTML = "কপি হয়েছে!";
      setTimeout(function () { el("copyBtn").innerHTML = PL.icon("copy") + " API Key কপি করুন"; }, 1400);
    });
  });

  el("regenBtn").addEventListener("click", function () {
    if (!confirm("আপনার API key রিজেনারেট করতে চান? পুরনো কী সাথে সাথে কাজ করা বন্ধ করবে।")) return;
    PL.authFetch("/api/keys/regenerate", { method: "POST" }).then(function (r) { el("apiKeyBox").value = r.data.apiKey; }).catch(function () {});
  });
})();
