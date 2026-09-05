// ============================================================================
// src/sms.js — POST /api/sms/ingest (admin-key auth). The Android SMS-
// forwarder app on the platform owner's phone posts every bKash/Nagad/
// Rocket/Upay confirmation SMS here; we store it and try to auto-match it
// to a pending invoice by Transaction ID, or by method+amount+time window.
// ============================================================================
import { json, readJson, requireAdmin, normalizeTrx, normalizeMethod, AMOUNT_TOLERANCE } from "./utils.js";
import { getInvoice } from "./invoices.js";
import { creditMerchantForInvoice } from "./invoices.js";
import { fireWebhook } from "./webhooks.js";

export async function ingestSms(request, env, ctx) {
  if (!requireAdmin(request, env)) return json({ error: "অননুমোদিত।" }, 401);
  const body = await readJson(request);
  const trxId = normalizeTrx(body.trxId);
  const amount = Number(body.amount);
  const method = normalizeMethod(body.method) || "bkash";
  const senderNumber = body.senderNumber ? String(body.senderNumber).trim() : null;
  const receivedAt = Number(body.receivedAt) || Date.now();
  const rawSms = body.rawSms ? String(body.rawSms).slice(0, 1000) : null;

  if (!trxId || !amount || amount <= 0) return json({ error: "trxId এবং একটি সঠিক amount আবশ্যক।" }, 400);

  const smsId = crypto.randomUUID();
  const now = Date.now();
  try {
    await env.DB.prepare(
      `INSERT INTO sms_transactions (id, trx_id, amount, sender_number, method, received_at, raw_sms, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(smsId, trxId, amount, senderNumber, method, receivedAt, rawSms, now).run();
  } catch (e) {
    return json({ ok: true, message: "ইতিমধ্যে রেকর্ড করা হয়েছে (ডুপ্লিকেট trxID)।" }, 200);
  }

  let invoice = await env.DB.prepare(
    `SELECT * FROM invoices WHERE trx_id = ? AND method = ? AND status = 'pending' AND ? BETWEEN created_at AND expires_at LIMIT 1`
  ).bind(trxId, method, receivedAt).first();

  if (!invoice) {
    const candidates = await env.DB.prepare(
      `SELECT * FROM invoices WHERE method = ? AND status = 'pending' AND trx_id IS NULL
         AND ? BETWEEN created_at AND expires_at AND ABS(amount - ?) <= ?`
    ).bind(method, receivedAt, amount, AMOUNT_TOLERANCE).all();
    if (candidates.results && candidates.results.length === 1) invoice = candidates.results[0];
  }
  if (!invoice) return json({ ok: true, matched: false, message: "SMS জমা হয়েছে, এখনো কোনো মিলে যাওয়া ইনভয়েস পাওয়া যায়নি।" }, 200);

  await env.DB.batch([
    env.DB.prepare(`UPDATE invoices SET status = 'verified', verified_by = 'sms', trx_id = ?, sender_number = COALESCE(sender_number, ?), verified_at = ? WHERE id = ?`)
      .bind(trxId, senderNumber, now, invoice.id),
    env.DB.prepare(`UPDATE sms_transactions SET matched_invoice_id = ? WHERE id = ?`).bind(invoice.id, smsId),
  ]);

  const verified = await getInvoice(invoice.id, env);
  await creditMerchantForInvoice(verified, env);
  const final = await getInvoice(invoice.id, env);
  await fireWebhook(final, env, ctx);
  return json({ ok: true, matched: true, invoiceId: invoice.id }, 200);
}
