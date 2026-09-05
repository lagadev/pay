/* ============================================================================
   public/js/docs.js — docs.html logic: injects the real deployed base URL
   into both snippets, wires copy buttons, and fills the Telegram support card.
============================================================================ */
(function () {
  var PL = window.PayLink;
  var el = function (id) { return document.getElementById(id); };

  el("icoIntegrate").innerHTML = PL.icon("bolt");
  el("icoWebhook").innerHTML = PL.icon("webhook");
  el("icoSupport").innerHTML = PL.icon("telegram");
  el("copyBaseBtn").innerHTML = PL.icon("copy");

  var base = location.origin;
  el("baseUrl").textContent = base;

  // very small, dependency-free syntax highlighter: comments + strings only
  function hl(code) {
    var esc = code.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    esc = esc.replace(/(\/\/[^\n]*)/g, '<span class="tok-com">$1</span>');
    esc = esc.replace(/("(?:[^"\\]|\\.)*")/g, '<span class="tok-str">$1</span>');
    return esc;
  }

  var integrateCode =
    '// আপনার সাইটে বসান — একটি ইনভয়েস তৈরি করে কাস্টমারকে পেমেন্ট পেজে পাঠায়\n' +
    'async function createInvoice(amount, reference) {\n' +
    '  const res = await fetch("' + base + '/api/invoices", {\n' +
    '    method: "POST",\n' +
    '    headers: {\n' +
    '      "Content-Type": "application/json",\n' +
    '      "Authorization": "Bearer YOUR_API_KEY" // /keys.html পেজ থেকে নিন\n' +
    '    },\n' +
    '    body: JSON.stringify({\n' +
    '      amount: amount,\n' +
    '      reference: reference,\n' +
    '      callbackUrl: "https://yoursite.com/webhook"\n' +
    '    })\n' +
    '  });\n\n' +
    '  const invoice = await res.json();\n' +
    '  window.location.href = invoice.payUrl; // কাস্টমারকে পেমেন্ট পেজে পাঠান\n' +
    '}';

  var webhookCode =
    '// POST /webhook — পেমেন্ট যাচাই হলে এখানে সিগনাল আসবে\n' +
    'const crypto = require("crypto");\n\n' +
    'app.post("/webhook", async (req, res) => {\n' +
    '  const signature = req.headers["x-signature"];\n' +
    '  const body = JSON.stringify(req.body);\n\n' +
    '  // সিগনেচার আপনার নিজের PayLink API Key দিয়ে সাইন করা — ADMIN_KEY নয়\n' +
    '  const expected = crypto.createHmac("sha256", process.env.PAYLINK_API_KEY)\n' +
    '    .update(body).digest("hex");\n\n' +
    '  if (signature !== expected) return res.status(401).send("Invalid signature");\n\n' +
    '  const { event, reference, amount, netAmount, trxId } = req.body;\n' +
    '  if (event === "invoice.verified") {\n' +
    '    // TODO: reference দিয়ে আপনার অর্ডারটি "paid" হিসেবে মার্ক করুন\n' +
    '  }\n\n' +
    '  res.status(200).send("ok");\n' +
    '});';

  el("codeIntegrate").innerHTML = hl(integrateCode);
  el("codeWebhook").innerHTML = hl(webhookCode);

  function flashCopied(btn, iconOnly) {
    var original = btn.innerHTML;
    btn.innerHTML = iconOnly ? PL.icon("check") : PL.icon("check") + " কপি হয়েছে";
    btn.classList.add("copied");
    setTimeout(function () { btn.innerHTML = original; btn.classList.remove("copied"); }, 1400);
  }

  el("copyBaseBtn").addEventListener("click", function () {
    navigator.clipboard.writeText(base).then(function () { flashCopied(el("copyBaseBtn"), true); });
  });

  Array.prototype.forEach.call(document.querySelectorAll(".copybtn"), function (btn) {
    btn.innerHTML = PL.icon("copy") + " কপি করুন";
    btn.addEventListener("click", function () {
      var target = el(btn.getAttribute("data-target"));
      navigator.clipboard.writeText(target.textContent).then(function () { flashCopied(btn); });
    });
  });

  PL.loadSettings().then(function (settings) {
    if (PL.enforceMaintenance(settings)) return;
    var telegram = settings.support && settings.support.telegram;
    var btn = el("supportBtn");
    if (telegram) {
      btn.href = "https://t.me/" + telegram.replace(/^@/, "");
      btn.innerHTML = PL.icon("telegram") + " সাপোর্টে যোগাযোগ করুন";
    } else {
      btn.style.display = "none";
    }
  });
})();
