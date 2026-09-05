// ============================================================================
// src/withdrawals.js — merchant payout requests, and the admin side of
// marking them completed/rejected (the platform owner sends the money by
// hand — there is no personal-account payout API for bKash/Nagad/etc).
// ============================================================================
import { json, readJson, genId, requireAdmin, normalizeMethod } from "./utils.js";
import { getSettings } from "./settings.js";
import { getMerchantBySession } from "./auth.js";

export function payoutPublic(p) {
  return {
    id: p.id, amount: p.amount, feeAmount: p.fee_amount, netAmount: p.net_amount, method: p.method,
    payoutNumber: p.payout_number, status: p.status, note: p.note, createdAt: p.created_at, processedAt: p.processed_at,
  };
}

export async function requestPayout(request, env) {
  const merchant = await getMerchantBySession(request, env);
  if (!merchant) return json({ error: "অননুমোদিত।" }, 401);
  const settings = await getSettings(env);
  const body = await readJson(request);
  const amount = Number(body.amount);
  const method = normalizeMethod(body.method) || "bkash";
  const payoutNumber = String(body.payoutNumber || "").trim();

  if (!amount || amount < settings.PAYOUT_MIN) return json({ error: `সর্বনিম্ন উত্তোলনের পরিমাণ ৳${settings.PAYOUT_MIN}।` }, 400);
  if (!payoutNumber) return json({ error: "আপনার bKash/Nagad/Rocket/Upay নম্বর আবশ্যক।" }, 400);
  if (amount > merchant.balance) return json({ error: "পরিমাণটি আপনার available balance-এর চেয়ে বেশি।" }, 400);

  const feeAmount = Math.round(amount * settings.PAYOUT_FEE_PERCENT) / 100;
  const netAmount = Math.round((amount - feeAmount) * 100) / 100;
  const id = genId("PO-", 8);
  const now = Date.now();

  await env.DB.batch([
    env.DB.prepare(`UPDATE merchants SET balance = balance - ? WHERE id = ?`).bind(amount, merchant.id),
    env.DB.prepare(`INSERT INTO payouts (id, merchant_id, amount, fee_amount, net_amount, method, payout_number, status, created_at) VALUES (?,?,?,?,?,?,?, 'pending', ?)`)
      .bind(id, merchant.id, amount, feeAmount, netAmount, method, payoutNumber, now),
  ]);

  return json({ id, amount, feeAmount, netAmount, status: "pending" }, 201);
}

export async function walletPayouts(request, env) {
  const merchant = await getMerchantBySession(request, env);
  if (!merchant) return json({ error: "অননুমোদিত।" }, 401);
  const rows = await env.DB.prepare(`SELECT * FROM payouts WHERE merchant_id=? ORDER BY created_at DESC LIMIT 30`).bind(merchant.id).all();
  return json({ payouts: (rows.results || []).map(payoutPublic) }, 200);
}

// ---- admin side -----------------------------------------------------------

export async function adminPayouts(request, env, url) {
  if (!requireAdmin(request, env)) return json({ error: "অননুমোদিত।" }, 401);
  const status = url.searchParams.get("status") || "pending";
  let rows;
  if (status === "all") {
    rows = await env.DB.prepare(`SELECT p.*, m.full_name, m.email FROM payouts p JOIN merchants m ON m.id=p.merchant_id ORDER BY p.created_at DESC LIMIT 150`).all();
  } else {
    rows = await env.DB.prepare(`SELECT p.*, m.full_name, m.email FROM payouts p JOIN merchants m ON m.id=p.merchant_id WHERE p.status=? ORDER BY p.created_at ASC LIMIT 150`).bind(status).all();
  }
  return json({ payouts: (rows.results || []).map((p) => ({ ...payoutPublic(p), merchantName: p.full_name, merchantEmail: p.email })) }, 200);
}

export async function adminCompletePayout(id, request, env) {
  if (!requireAdmin(request, env)) return json({ error: "অননুমোদিত।" }, 401);
  const body = await readJson(request);
  const payout = await env.DB.prepare(`SELECT * FROM payouts WHERE id=?`).bind(id).first();
  if (!payout || payout.status !== "pending") return json({ error: "Payout পাওয়া যায়নি অথবা ইতিমধ্যে প্রসেস করা হয়েছে।" }, 404);
  await env.DB.prepare(`UPDATE payouts SET status='completed', note=?, processed_at=? WHERE id=?`).bind(body.note || null, Date.now(), id).run();
  return json({ ok: true }, 200);
}

export async function adminRejectPayout(id, request, env) {
  if (!requireAdmin(request, env)) return json({ error: "অননুমোদিত।" }, 401);
  const body = await readJson(request);
  const payout = await env.DB.prepare(`SELECT * FROM payouts WHERE id=?`).bind(id).first();
  if (!payout || payout.status !== "pending") return json({ error: "Payout পাওয়া যায়নি অথবা ইতিমধ্যে প্রসেস করা হয়েছে।" }, 404);
  const now = Date.now();
  await env.DB.batch([
    env.DB.prepare(`UPDATE payouts SET status='rejected', note=?, processed_at=? WHERE id=?`).bind(body.note || null, now, id),
    env.DB.prepare(`UPDATE merchants SET balance = balance + ? WHERE id=?`).bind(payout.amount, payout.merchant_id),
  ]);
  return json({ ok: true }, 200);
}
