// ============================================================================
// src/webhooks.js — fires a signed POST to the merchant's callbackUrl the
// instant an invoice is verified. See public/docs.html for the merchant-
// facing snippet that verifies X-Signature on their end.
//
// SECURITY: the signature is HMAC'd with the *merchant's own API key*, never
// the platform ADMIN_KEY. The ADMIN_KEY is the master secret that gates
// /admin — it must never be told to a merchant. Merchants already hold their
// own API key privately (visible on their /keys page), so it's the correct
// shared secret for verifying that a webhook really came from us.
// ============================================================================
import { signPayload } from "./utils.js";

export async function fireWebhook(invoice, env, ctx) {
  if (!invoice.callback_url) return;

  const send = (async () => {
    const merchant = await env.DB.prepare(`SELECT api_key FROM merchants WHERE id = ?`).bind(invoice.merchant_id).first();
    if (!merchant) return;

    const payload = JSON.stringify({
      event: "invoice.verified",
      id: invoice.id,
      reference: invoice.reference,
      amount: invoice.amount,
      netAmount: invoice.net_amount,
      method: invoice.method,
      trxId: invoice.trx_id,
      senderNumber: invoice.sender_number,
      verifiedAt: invoice.verified_at,
    });

    const signature = await signPayload(payload, merchant.api_key);
    await fetch(invoice.callback_url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Signature": signature },
      body: payload,
    }).catch(() => {});
  })();

  if (ctx && ctx.waitUntil) ctx.waitUntil(send);
  else await send;
}
