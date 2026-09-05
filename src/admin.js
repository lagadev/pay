// ============================================================================
// src/admin.js — everything gated behind the ADMIN_KEY: platform overview,
// merchant management (suspend/reactivate, manual balance adjustments),
// manual invoice verification (when SMS matching fails), invoice search,
// and the settings editor.
// ============================================================================
import { json, readJson, requireAdmin, genId } from "./utils.js";
import { getSettings, updateSettings, DEFAULTS } from "./settings.js";
import { getInvoice, invoiceToPublic, creditMerchantForInvoice } from "./invoices.js";
import { fireWebhook } from "./webhooks.js";

export async function adminOverview(request, env) {
  if (!requireAdmin(request, env)) return json({ error: "অননুমোদিত।" }, 401);
  const merchants = await env.DB.prepare(`SELECT COUNT(*) c FROM merchants`).first();
  const volume = await env.DB.prepare(`SELECT COALESCE(SUM(amount),0) s, COALESCE(SUM(fee_amount),0) f FROM invoices WHERE status='verified'`).first();
  const pendingPayouts = await env.DB.prepare(`SELECT COUNT(*) c, COALESCE(SUM(amount),0) s FROM payouts WHERE status='pending'`).first();
  const invoices = await env.DB.prepare(`SELECT COUNT(*) c FROM invoices WHERE status='verified'`).first();
  const pendingInvoices = await env.DB.prepare(`SELECT COUNT(*) c FROM invoices WHERE status='pending'`).first();
  const today = new Date();
  const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  const todayVol = await env.DB.prepare(`SELECT COALESCE(SUM(amount),0) s, COUNT(*) c FROM invoices WHERE status='verified' AND verified_at>=?`).bind(startOfDay).first();

  return json({
    merchantCount: merchants.c, verifiedVolume: volume.s, platformRevenue: volume.f,
    pendingPayoutCount: pendingPayouts.c, pendingPayoutAmount: pendingPayouts.s,
    verifiedInvoiceCount: invoices.c, pendingInvoiceCount: pendingInvoices.c,
    todayVolume: todayVol.s, todayCount: todayVol.c,
  }, 200);
}

export async function adminMerchants(request, env, url) {
  if (!requireAdmin(request, env)) return json({ error: "অননুমোদিত।" }, 401);
  const q = (url.searchParams.get("q") || "").trim().toLowerCase();
  const rows = await env.DB.prepare(
    `SELECT m.*,
       (SELECT COUNT(*) FROM invoices i WHERE i.merchant_id=m.id AND i.status='verified') AS tx_count,
       (SELECT COALESCE(SUM(i.amount),0) FROM invoices i WHERE i.merchant_id=m.id AND i.status='verified') AS tx_volume
     FROM merchants m ORDER BY m.created_at DESC`
  ).all();
  let list = rows.results || [];
  if (q) list = list.filter((m) => (m.full_name + m.email + m.mobile).toLowerCase().includes(q));

  return json({
    merchants: list.map((m) => ({
      id: m.id, fullName: m.full_name, email: m.email, mobile: m.mobile, telegram: m.telegram,
      balance: m.balance, status: m.status, createdAt: m.created_at, transactionCount: m.tx_count, transactionVolume: m.tx_volume,
    })),
  }, 200);
}

export async function adminMerchantDetail(id, request, env) {
  if (!requireAdmin(request, env)) return json({ error: "অননুমোদিত।" }, 401);
  const merchant = await env.DB.prepare(`SELECT * FROM merchants WHERE id=?`).bind(id).first();
  if (!merchant) return json({ error: "মার্চেন্ট পাওয়া যায়নি।" }, 404);
  const invoices = await env.DB.prepare(`SELECT * FROM invoices WHERE merchant_id=? ORDER BY created_at DESC LIMIT 25`).bind(id).all();
  const adjustments = await env.DB.prepare(`SELECT * FROM balance_adjustments WHERE merchant_id=? ORDER BY created_at DESC LIMIT 25`).bind(id).all();
  return json({
    merchant: {
      id: merchant.id, fullName: merchant.full_name, email: merchant.email, mobile: merchant.mobile, telegram: merchant.telegram,
      balance: merchant.balance, status: merchant.status, createdAt: merchant.created_at,
    },
    invoices: (invoices.results || []).map((i) => ({ id: i.id, reference: i.reference, amount: i.amount, netAmount: i.net_amount, method: i.method, status: i.status, trxId: i.trx_id, createdAt: i.created_at, verifiedAt: i.verified_at })),
    adjustments: (adjustments.results || []).map((a) => ({ id: a.id, amount: a.amount, reason: a.reason, createdAt: a.created_at })),
  }, 200);
}

export async function adminSetMerchantStatus(id, request, env) {
  if (!requireAdmin(request, env)) return json({ error: "অননুমোদিত।" }, 401);
  const body = await readJson(request);
  const status = body.status === "suspended" ? "suspended" : "active";
  await env.DB.prepare(`UPDATE merchants SET status=? WHERE id=?`).bind(status, id).run();
  return json({ ok: true, status }, 200);
}

export async function adminAdjustBalance(id, request, env) {
  if (!requireAdmin(request, env)) return json({ error: "অননুমোদিত।" }, 401);
  const body = await readJson(request);
  const amount = Number(body.amount);
  const reason = body.reason ? String(body.reason).slice(0, 250) : null;
  if (!amount) return json({ error: "amount আবশ্যক (ক্রেডিটের জন্য ধনাত্মক, ডেবিটের জন্য ঋণাত্মক সংখ্যা)।" }, 400);

  const merchant = await env.DB.prepare(`SELECT * FROM merchants WHERE id=?`).bind(id).first();
  if (!merchant) return json({ error: "মার্চেন্ট পাওয়া যায়নি।" }, 404);
  if (amount < 0 && merchant.balance + amount < 0) return json({ error: "এই পরিমাণ ডেবিট করলে ব্যালেন্স ঋণাত্মক হয়ে যাবে।" }, 400);

  const adjId = genId("ADJ-", 8);
  const now = Date.now();
  await env.DB.batch([
    env.DB.prepare(`UPDATE merchants SET balance = balance + ? WHERE id=?`).bind(amount, id),
    env.DB.prepare(`INSERT INTO balance_adjustments (id, merchant_id, amount, reason, created_at) VALUES (?,?,?,?,?)`).bind(adjId, id, amount, reason, now),
  ]);
  return json({ ok: true }, 200);
}

// ---- invoice search + manual verification --------------------------------

export async function adminSearchInvoices(request, env, url) {
  if (!requireAdmin(request, env)) return json({ error: "অননুমোদিত।" }, 401);
  const q = (url.searchParams.get("q") || "").trim();
  const status = url.searchParams.get("status") || "all";
  let sql = `SELECT i.*, m.full_name, m.email FROM invoices i JOIN merchants m ON m.id=i.merchant_id WHERE 1=1`;
  const params = [];
  if (status !== "all") { sql += ` AND i.status=?`; params.push(status); }
  if (q) { sql += ` AND (i.id LIKE ? OR i.trx_id LIKE ? OR i.reference LIKE ? OR m.email LIKE ?)`; params.push(`%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`); }
  sql += ` ORDER BY i.created_at DESC LIMIT 100`;
  const rows = await env.DB.prepare(sql).bind(...params).all();
  return json({
    invoices: (rows.results || []).map((i) => ({
      id: i.id, reference: i.reference, amount: i.amount, netAmount: i.net_amount, method: i.method,
      status: i.status, trxId: i.trx_id, verifiedBy: i.verified_by, merchantName: i.full_name, merchantEmail: i.email,
      createdAt: i.created_at, verifiedAt: i.verified_at,
    })),
  }, 200);
}

export async function adminManualVerify(id, request, env, ctx) {
  if (!requireAdmin(request, env)) return json({ error: "অননুমোদিত।" }, 401);
  const invoice = await getInvoice(id, env);
  if (!invoice) return json({ error: "ইনভয়েস পাওয়া যায়নি।" }, 404);
  if (invoice.status === "verified") return json({ error: "ইতিমধ্যে যাচাই করা হয়েছে।" }, 409);

  const body = await readJson(request);
  const trxId = body.trxId ? String(body.trxId).trim().toUpperCase() : invoice.trx_id;
  const now = Date.now();
  await env.DB.prepare(`UPDATE invoices SET status='verified', verified_by='admin', trx_id=COALESCE(?, trx_id), verified_at=? WHERE id=?`).bind(trxId, now, id).run();

  const updated = await getInvoice(id, env);
  await creditMerchantForInvoice(updated, env);
  const final = await getInvoice(id, env);
  await fireWebhook(final, env, ctx);
  return json(invoiceToPublic(final), 200);
}

// ---- settings ---------------------------------------------------------------

export async function adminGetSettings(request, env) {
  if (!requireAdmin(request, env)) return json({ error: "অননুমোদিত।" }, 401);
  return json(await getSettings(env), 200);
}
export async function adminUpdateSettings(request, env) {
  if (!requireAdmin(request, env)) return json({ error: "অননুমোদিত।" }, 401);
  const body = await readJson(request);
  const patch = {};
  for (const k of Object.keys(DEFAULTS)) if (body[k] !== undefined) patch[k] = body[k];
  await updateSettings(env, patch);
  return json(await getSettings(env), 200);
}
