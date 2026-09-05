// ============================================================================
// src/invoices.js — invoice creation (merchant API key) and the public
// customer-facing lifecycle (fetch / select method / verify).
// ============================================================================
import { json, readJson, genId, normalizeMethod, normalizeTrx, AMOUNT_TOLERANCE } from "./utils.js";
import { getSettings, merchantNumberFor, isMethodEnabled } from "./settings.js";
import { getMerchantByApiKey } from "./auth.js";
import { fireWebhook } from "./webhooks.js";

export function invoiceToPublic(inv) {
  return {
    id: inv.id, reference: inv.reference, amount: inv.amount, feeAmount: inv.fee_amount, netAmount: inv.net_amount,
    method: inv.method, merchantNumber: inv.merchant_number, status: inv.status, trxId: inv.trx_id,
    senderNumber: inv.sender_number, createdAt: inv.created_at, expiresAt: inv.expires_at, verifiedAt: inv.verified_at,
  };
}

export async function createInvoice(request, env, url) {
  const merchant = await getMerchantByApiKey(request, env);
  if (!merchant) return json({ error: "অননুমোদিত। Authorization: Bearer <আপনার API key> পাঠান — API Keys পেজে পাবেন।" }, 401);
  if (merchant.status !== "active") return json({ error: "আপনার অ্যাকাউন্টটি সাসপেন্ড করা হয়েছে।" }, 403);

  const settings = await getSettings(env);
  const body = await readJson(request);
  const amount = Number(body.amount);
  const reference = body.reference ? String(body.reference).slice(0, 128) : null;
  const callbackUrl = body.callbackUrl ? String(body.callbackUrl).slice(0, 500) : null;
  const method = body.method ? normalizeMethod(body.method) : null;

  if (!amount || amount <= 0) return json({ error: "একটি সঠিক পরিমাণ ('amount') আবশ্যক।" }, 400);
  if (method && !isMethodEnabled(settings, method)) return json({ error: "এই পেমেন্ট মেথডটি বর্তমানে বন্ধ আছে।" }, 400);

  const merchantNumber = method ? merchantNumberFor(settings, method) : null;
  const id = genId("INV-", 8);
  const now = Date.now();
  const expiresAt = now + settings.INVOICE_TTL_MINUTES * 60 * 1000;

  await env.DB.prepare(
    `INSERT INTO invoices (id, merchant_id, reference, amount, fee_amount, net_amount, method, merchant_number, status, callback_url, created_at, expires_at)
     VALUES (?, ?, ?, ?, 0, 0, ?, ?, 'pending', ?, ?, ?)`
  ).bind(id, merchant.id, reference, amount, method, merchantNumber, callbackUrl, now, expiresAt).run();

  const payUrl = `${url.origin}/pay?id=${id}`;
  return json({ id, reference, amount, method, merchantNumber, status: "pending", createdAt: now, expiresAt, payUrl }, 201);
}

export async function getInvoice(id, env) {
  const invoice = await env.DB.prepare(`SELECT * FROM invoices WHERE id = ?`).bind(id).first();
  if (!invoice) return null;
  if (invoice.status === "pending" && Date.now() > invoice.expires_at) {
    await env.DB.prepare(`UPDATE invoices SET status = 'expired' WHERE id = ?`).bind(id).run();
    invoice.status = "expired";
  }
  return invoice;
}

export async function getInvoiceRoute(id, env) {
  const invoice = await getInvoice(id, env);
  if (!invoice) return json({ error: "ইনভয়েস পাওয়া যায়নি।" }, 404);
  return json(invoiceToPublic(invoice), 200);
}

export async function selectMethod(id, request, env) {
  const invoice = await getInvoice(id, env);
  if (!invoice) return json({ error: "ইনভয়েস পাওয়া যায়নি।" }, 404);
  if (invoice.status !== "pending") return json({ ...invoiceToPublic(invoice), error: "এই ইনভয়েসটি আর পেন্ডিং নেই।" }, 409);

  const settings = await getSettings(env);
  const body = await readJson(request);
  const method = normalizeMethod(body.method);
  if (!method) return json({ error: "method অবশ্যই bkash, nagad, rocket অথবা upay হতে হবে।" }, 400);
  if (!isMethodEnabled(settings, method)) return json({ error: "এই পেমেন্ট মেথডটি বর্তমানে বন্ধ আছে।" }, 400);

  const merchantNumber = merchantNumberFor(settings, method);
  await env.DB.prepare(`UPDATE invoices SET method = ?, merchant_number = ? WHERE id = ?`).bind(method, merchantNumber, id).run();
  return json(invoiceToPublic(await getInvoice(id, env)), 200);
}

export async function creditMerchantForInvoice(invoice, env) {
  const settings = await getSettings(env);
  const feePercent = settings.INVOICE_FEE_PERCENT;
  const feeAmount = Math.round(invoice.amount * feePercent) / 100;
  const netAmount = Math.round((invoice.amount - feeAmount) * 100) / 100;
  await env.DB.batch([
    env.DB.prepare(`UPDATE invoices SET fee_amount = ?, net_amount = ? WHERE id = ?`).bind(feeAmount, netAmount, invoice.id),
    env.DB.prepare(`UPDATE merchants SET balance = balance + ? WHERE id = ?`).bind(netAmount, invoice.merchant_id),
  ]);
}

export async function verifyInvoice(id, request, env, ctx) {
  const invoice = await getInvoice(id, env);
  if (!invoice) return json({ error: "ইনভয়েস পাওয়া যায়নি।" }, 404);
  if (invoice.status === "verified") return json({ ...invoiceToPublic(invoice), message: "ইতিমধ্যে যাচাই হয়ে গেছে।" }, 200);
  if (invoice.status === "expired") return json({ ...invoiceToPublic(invoice), message: "এই ইনভয়েসের মেয়াদ শেষ হয়ে গেছে। নতুন পেমেন্ট লিংক নিন।" }, 409);
  if (!invoice.method) return json({ error: "আগে একটি পেমেন্ট মেথড সিলেক্ট করুন।" }, 400);

  const body = await readJson(request);
  const trxId = normalizeTrx(body.trxId);
  const senderNumber = body.senderNumber ? String(body.senderNumber).trim() : null;
  if (!trxId || trxId.length < 5) return json({ error: "সঠিক একটি Transaction ID দিন।" }, 400);

  const reused = await env.DB.prepare(`SELECT id FROM invoices WHERE trx_id = ? AND status = 'verified' AND id != ?`).bind(trxId, id).first();
  if (reused) return json({ error: "এই Transaction ID দিয়ে ইতিমধ্যে অন্য একটি পেমেন্ট যাচাই করা হয়েছে।" }, 409);

  await env.DB.prepare(`UPDATE invoices SET trx_id = ?, sender_number = ? WHERE id = ?`).bind(trxId, senderNumber, id).run();

  const match = await env.DB.prepare(
    `SELECT * FROM sms_transactions WHERE trx_id = ? AND method = ? AND matched_invoice_id IS NULL
       AND received_at BETWEEN ? AND ? AND ABS(amount - ?) <= ? LIMIT 1`
  ).bind(trxId, invoice.method, invoice.created_at, invoice.expires_at, invoice.amount, AMOUNT_TOLERANCE).first();

  if (!match) {
    return json({
      ...invoiceToPublic(invoice), trxId, senderNumber, status: "pending",
      message: "SMS কনফার্মেশনের অপেক্ষায় আছি — এই পেজ খোলা রাখুন, কয়েক সেকেন্ডের মধ্যে নিজে থেকেই যাচাই হয়ে যাবে।",
    }, 202);
  }

  const now = Date.now();
  await env.DB.batch([
    env.DB.prepare(`UPDATE invoices SET status = 'verified', verified_by = 'sms', verified_at = ? WHERE id = ?`).bind(now, id),
    env.DB.prepare(`UPDATE sms_transactions SET matched_invoice_id = ? WHERE id = ?`).bind(id, match.id),
  ]);

  const updated = await getInvoice(id, env);
  await creditMerchantForInvoice(updated, env);
  const final = await getInvoice(id, env);
  await fireWebhook(final, env, ctx);
  return json({ ...invoiceToPublic(final), message: "পেমেন্ট সফলভাবে যাচাই হয়েছে।" }, 200);
}
