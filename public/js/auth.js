/* ============================================================================
   public/js/auth.js — signup.html + login.html logic (mode read from the
   data-mode attribute on this script tag).
============================================================================ */
(function () {
  var PL = window.PayLink;
  var el = function (id) { return document.getElementById(id); };
  var thisScript = document.currentScript;
  var isSignup = thisScript.getAttribute("data-mode") === "signup";

  if (localStorage.getItem("pl_token")) { location.href = "/dashboard.html"; return; }

  PL.loadSettings().then(function (settings) {
    if (PL.enforceMaintenance(settings)) return;
    if (isSignup && !settings.signupEnabled) {
      el("errBox").textContent = "নতুন সাইনআপ সাময়িকভাবে বন্ধ আছে।";
      el("errBox").classList.add("show");
      el("submitBtn").disabled = true;
    }
  });

  if (isSignup) {
    el("icUser").innerHTML = PL.icon("user");
    el("icMail").innerHTML = PL.icon("mail");
    el("icPhone").innerHTML = PL.icon("phone");
    el("icTelegram").innerHTML = PL.icon("telegram");
    el("icLock1").innerHTML = PL.icon("lock");
    el("icLock2").innerHTML = PL.icon("check");
    el("icSubmit").innerHTML = PL.icon("user");
  } else {
    el("icMail").innerHTML = PL.icon("mail");
    el("icLock1").innerHTML = PL.icon("lock");
  }

  el("authForm").addEventListener("submit", function (e) {
    e.preventDefault();
    var errBox = el("errBox");
    errBox.classList.remove("show");
    errBox.textContent = "";

    var payload;
    if (isSignup) {
      var p1 = el("password").value, p2 = el("password2").value;
      if (p1 !== p2) {
        errBox.textContent = "পাসওয়ার্ড দুটি মিলছে না।";
        errBox.classList.add("show");
        return;
      }
      payload = { fullName: el("fullName").value, email: el("email").value, mobile: el("mobile").value, telegram: el("telegram").value, password: p1 };
    } else {
      payload = { email: el("email").value, password: el("password").value };
    }

    el("submitBtn").disabled = true;
    PL.api("/api/auth/" + (isSignup ? "signup" : "login"), { method: "POST", body: JSON.stringify(payload) }).then(function (r) {
      if (!r.res.ok) {
        errBox.textContent = r.data.error || "কিছু একটা সমস্যা হয়েছে।";
        errBox.classList.add("show");
        el("submitBtn").disabled = false;
        return;
      }
      localStorage.setItem("pl_token", r.data.token);
      location.href = "/dashboard.html";
    }).catch(function () {
      errBox.textContent = "নেটওয়ার্ক সমস্যা হয়েছে। আবার চেষ্টা করুন।";
      errBox.classList.add("show");
      el("submitBtn").disabled = false;
    });
  });
})();
