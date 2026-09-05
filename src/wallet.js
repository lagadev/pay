// ============================================================================
// src/wallet.js — merchant-facing balance summary and transaction history.
// Withdrawal requests live in src/withdrawals.js.
// ============================================================================
import { json } from "./utils.js";
import { getMerchantBySession } from "./auth.js";

export async function walletSummary(request, env) {
  const merchant = await getMerchantBySession(request, env);
  if (!merchant) return json({ error: "অননুমোদিত।" }, 401);

  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();

  const today = await env.DB.prepare(`SELECT COALESCE(SUM(net_amount),0) s FROM invoices WHERE merchant_id=? AND status='verified' AND verified_at>=?`).bind(merchant.id, startOfDay).first();
  const month = await env.DB.prepare(`SELECT COALESCE(SUM(net_amount),0) s FROM invoices WHERE merchant_id=? AND status='verified' AND verified_at>=?`).bind(merchant.id, startOfMonth).first();
  const total = await env.DB.prepare(`SELECT COALESCE(SUM(net_amount),0) s, COUNT(*) c FROM invoices WHERE merchant_id=? AND status='verified'`).bind(merchant.id).first();

  return json({ balance: merchant.balance, today: today.s, monthly: month.s, totalVolume: total.s, transactions: total.c }, 200);
}

export async function walletTransactions(request, env) {
  const merchant = await getMerchantBySession(request, env);
  if (!merchant) return json({ error: "অননুমোদিত।" }, 401);
  const rows = await env.DB.prepare(
    `SELECT id, reference, amount, net_amount, method, trx_id, status, verified_at, created_at FROM invoices
     WHERE merchant_id=? AND status='verified' ORDER BY verified_at DESC LIMIT 30`
  ).bind(merchant.id).all();
  return json({
    transactions: (rows.results || []).map((r) => ({
      id: r.id, reference: r.reference, amount: r.amount, netAmount: r.net_amount, method: r.method,
      trxId: r.trx_id, verifiedAt: r.verified_at, createdAt: r.created_at,
    })),
  }, 200);
}
