// ============================================================================
// src/index.js — PayLink Worker entry point.
//
// Static pages (public/*.html, css, js, assets) are served directly by
// Cloudflare's asset layer (see [assets] in wrangler.toml). This file only
// ever runs for /api/* — everything else falls through to the static files.
// ============================================================================
import { json, corsHeaders } from "./utils.js";
import { getSettings, publicSettings } from "./settings.js";
import { signup, login, logout, me, getKeys, regenerateKey } from "./auth.js";
import { createInvoice, getInvoiceRoute, selectMethod, verifyInvoice } from "./invoices.js";
import { ingestSms } from "./sms.js";
import { walletSummary, walletTransactions } from "./wallet.js";
import { requestPayout, walletPayouts, adminPayouts, adminCompletePayout, adminRejectPayout } from "./withdrawals.js";
import {
  adminOverview, adminMerchants, adminMerchantDetail, adminSetMerchantStatus, adminAdjustBalance,
  adminSearchInvoices, adminManualVerify, adminGetSettings, adminUpdateSettings,
} from "./admin.js";

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const { pathname } = url;
    const method = request.method;

    if (method === "OPTIONS") return new Response(null, { headers: corsHeaders() });

    try {
      // ---- public, no-auth: safe settings subset for the frontend --------
      if (pathname === "/api/settings" && method === "GET") {
        return json(publicSettings(await getSettings(env)), 200);
      }
      if (pathname === "/api/health") return json({ ok: true, time: Date.now() }, 200);

      // ---- auth -----------------------------------------------------------
      if (pathname === "/api/auth/signup" && method === "POST") return await signup(request, env);
      if (pathname === "/api/auth/login" && method === "POST") return await login(request, env);
      if (pathname === "/api/auth/logout" && method === "POST") return await logout(request, env);
      if (pathname === "/api/me" && method === "GET") return await me(request, env);

      // ---- invoices ---------------------------------------------------------
      if (pathname === "/api/invoices" && method === "POST") return await createInvoice(request, env, url);
      let m = pathname.match(/^\/api\/invoices\/([a-zA-Z0-9-]+)$/);
      if (m && method === "GET") return await getInvoiceRoute(m[1], env);
      m = pathname.match(/^\/api\/invoices\/([a-zA-Z0-9-]+)\/select-method$/);
      if (m && method === "POST") return await selectMethod(m[1], request, env);
      m = pathname.match(/^\/api\/invoices\/([a-zA-Z0-9-]+)\/verify$/);
      if (m && method === "POST") return await verifyInvoice(m[1], request, env, ctx);

      // ---- sms ingestion ------------------------------------------------------
      if (pathname === "/api/sms/ingest" && method === "POST") return await ingestSms(request, env, ctx);

      // ---- wallet --------------------------------------------------------------
      if (pathname === "/api/wallet/summary" && method === "GET") return await walletSummary(request, env);
      if (pathname === "/api/wallet/transactions" && method === "GET") return await walletTransactions(request, env);
      if (pathname === "/api/wallet/payout" && method === "POST") return await requestPayout(request, env);
      if (pathname === "/api/wallet/payouts" && method === "GET") return await walletPayouts(request, env);

      // ---- api keys -----------------------------------------------------------
      if (pathname === "/api/keys" && method === "GET") return await getKeys(request, env);
      if (pathname === "/api/keys/regenerate" && method === "POST") return await regenerateKey(request, env);

      // ---- admin: overview / merchants / balance ------------------------------
      if (pathname === "/api/admin/overview" && method === "GET") return await adminOverview(request, env);
      if (pathname === "/api/admin/merchants" && method === "GET") return await adminMerchants(request, env, url);
      m = pathname.match(/^\/api\/admin\/merchants\/([a-zA-Z0-9-]+)$/);
      if (m && method === "GET") return await adminMerchantDetail(m[1], request, env);
      m = pathname.match(/^\/api\/admin\/merchants\/([a-zA-Z0-9-]+)\/status$/);
      if (m && method === "POST") return await adminSetMerchantStatus(m[1], request, env);
      m = pathname.match(/^\/api\/admin\/merchants\/([a-zA-Z0-9-]+)\/adjust-balance$/);
      if (m && method === "POST") return await adminAdjustBalance(m[1], request, env);

      // ---- admin: invoices ------------------------------------------------------
      if (pathname === "/api/admin/invoices" && method === "GET") return await adminSearchInvoices(request, env, url);
      m = pathname.match(/^\/api\/admin\/invoices\/([a-zA-Z0-9-]+)\/verify$/);
      if (m && method === "POST") return await adminManualVerify(m[1], request, env, ctx);

      // ---- admin: payouts -----------------------------------------------------
      if (pathname === "/api/admin/payouts" && method === "GET") return await adminPayouts(request, env, url);
      m = pathname.match(/^\/api\/admin\/payouts\/([a-zA-Z0-9-]+)\/complete$/);
      if (m && method === "POST") return await adminCompletePayout(m[1], request, env);
      m = pathname.match(/^\/api\/admin\/payouts\/([a-zA-Z0-9-]+)\/reject$/);
      if (m && method === "POST") return await adminRejectPayout(m[1], request, env);

      // ---- admin: settings ------------------------------------------------------
      if (pathname === "/api/admin/settings" && method === "GET") return await adminGetSettings(request, env);
      if (pathname === "/api/admin/settings" && method === "POST") return await adminUpdateSettings(request, env);

      return json({ error: "Not found." }, 404);
    } catch (err) {
      return json({ error: "সার্ভারে সমস্যা হয়েছে।", detail: String(err && err.message) }, 500);
    }
  },
};
