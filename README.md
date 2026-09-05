# PayLink v2 — bKash / Nagad / Rocket / Upay মাল্টি-মার্চেন্ট পেমেন্ট প্ল্যাটফর্ম

Cloudflare Workers + D1 (SQLite) দিয়ে তৈরি একটি সম্পূর্ণ পেমেন্ট গেটওয়ে। প্ল্যাটফর্মের মালিক (আপনি) নিজের bKash/Nagad/Rocket/Upay নম্বর ব্যবহার করেন; মার্চেন্টরা সাইনআপ করে API key নিয়ে সেই শেয়ার্ড নম্বরের বিপরীতে ইনভয়েস তৈরি করে, আর পেমেন্ট Android SMS-ফরওয়ার্ডার অ্যাপ থেকে আসা SMS দিয়ে অটো-ভেরিফাই হয়।

---

## ১. ফোল্ডার স্ট্রাকচার ও প্রতিটি ফাইলের কাজ

```
/
├── public/                      ← স্ট্যাটিক ফ্রন্টএন্ড (Cloudflare Assets দিয়ে সার্ভ হয়)
│   ├── index.html                হোমপেজ / ল্যান্ডিং পেজ
│   ├── signup.html               মার্চেন্ট সাইনআপ ফর্ম
│   ├── login.html                মার্চেন্ট লগইন ফর্ম
│   ├── docs.html                 ডেভেলপার ডকস — API URL + ২টি কোড স্নিপেট + টেলিগ্রাম সাপোর্ট
│   ├── pay.html                  কাস্টমার-facing পেমেন্ট ফ্লো (মেথড সিলেক্ট → Trx ID → সফল/মেয়াদোত্তীর্ণ)
│   ├── dashboard.html            মার্চেন্ট ড্যাশবোর্ড (ব্যালেন্স, সাম্প্রতিক লেনদেন)
│   ├── wallet.html                মার্চেন্ট ওয়ালেট (উত্তোলনের অনুরোধ + ইতিহাস)
│   ├── keys.html                  মার্চেন্টের API key দেখা/রিজেনারেট করা
│   ├── admin.html                 অ্যাডমিন প্যানেল শেল (ADMIN_KEY দিয়ে গেটেড)
│   ├── css/style.css              সব পেজের একক ডিজাইন সিস্টেম
│   ├── js/app.js                  সব পেজে শেয়ার করা হেল্পার (আইকন, টোস্ট, authFetch, settings)
│   ├── js/auth.js                 signup.html + login.html এর লজিক
│   ├── js/invoice.js              pay.html চালায় — পুরো পেমেন্ট ফ্লো
│   ├── js/dashboard.js            dashboard.html এর লজিক
│   ├── js/wallet.js               wallet.html এর লজিক
│   ├── js/keys.js                 keys.html এর লজিক
│   ├── js/admin.js                admin.html এর লজিক (গেট + সব ট্যাব)
│   ├── js/docs.js                 docs.html এর লজিক (কোড ইনজেকশন + কপি বাটন)
│   └── assets/
│       ├── logo.svg               সাইট লোগো (বেসিক, পরে রিপ্লেস করার জন্য)
│       └── methods/               bkash.svg, nagad.svg, rocket.svg, upay.svg — বেসিক ব্র্যান্ড ব্যাজ
│
├── src/                          ← Cloudflare Worker ব্যাকএন্ড (শুধু /api/* এর জন্য চলে)
│   ├── index.js                   রাউটার — সব API রুট এখান থেকে ডিসপ্যাচ হয়
│   ├── utils.js                   জেনেরিক হেল্পার (json/cors, id/key generation, hash, HMAC sign)
│   ├── settings.js                `settings` টেবিলের ডিফল্ট + get/update + public subset
│   ├── auth.js                    সাইনআপ/লগইন/সেশন/মার্চেন্ট lookup
│   ├── invoices.js                ইনভয়েস তৈরি, স্ট্যাটাস, মেথড সিলেক্ট, ভেরিফাই, ব্যালেন্স ক্রেডিট
│   ├── wallet.js                   ব্যালেন্স সামারি + লেনদেনের ইতিহাস (merchant-facing)
│   ├── withdrawals.js              পেআউট রিকোয়েস্ট + অ্যাডমিন পেআউট প্রসেসিং
│   ├── webhooks.js                 ভেরিফাইড ইনভয়েসে সাইন করা webhook পাঠানো
│   └── sms.js                      Android SMS-ফরওয়ার্ডার থেকে আসা SMS ইনজেস্ট + অটো-ম্যাচ
│
│   (মূল ফোল্ডার স্ট্রাকচারে দেওয়া তালিকার বাইরে ২টি ফাইল অতিরিক্ত যোগ করা হয়েছে,
│    কারণ প্রজেক্টের আকারে এগুলো ছাড়া কোড অগোছালো হয়ে যেত:)
│   ├── admin.js                    অ্যাডমিন-শুধু রুট (ওভারভিউ, মার্চেন্ট, ব্যালেন্স সমন্বয়, ম্যানুয়াল ভেরিফাই)
│
├── database/
│   ├── schema.sql                 নতুন/ফ্রেশ ডাটাবেসের জন্য সম্পূর্ণ স্কিমা
│   └── migrations/
│       └── 0001_add_rocket_upay_and_adjustments.sql   পুরনো (শুধু bKash/Nagad) ডাটাবেস থেকে আপগ্রেডের জন্য
│
├── config/
│   └── config.example.js          কোন এনভায়রনমেন্ট ভ্যারিয়েবল/সিক্রেট লাগবে তার ডকুমেন্টেশন (রানটাইমে পড়া হয় না)
│
├── wrangler.toml                  Cloudflare Worker কনফিগ (D1 বাইন্ডিং, স্ট্যাটিক অ্যাসেট, ভ্যারিয়েবল)
├── package.json                   npm scripts (dev/deploy/db:apply ইত্যাদি)
└── README.md                      এই ফাইল
```

> **নোট:** ইউজারের দেওয়া মূল স্ট্রাকচারে শুধু ৫টি HTML (index/signup/login/docs/pay) এবং ৩টি JS ফাইল (app/auth/invoice) উল্লেখ ছিল। কিন্তু মার্চেন্ট ড্যাশবোর্ড, ওয়ালেট, API keys, এবং অ্যাডমিন প্যানেল ছাড়া প্ল্যাটফর্মটি অসম্পূর্ণ থাকত — তাই dashboard/wallet/keys/admin এর HTML + JS ফাইল এবং docs.js যোগ করা হয়েছে। এটাই "আরও ভালো করতে পারলে করুন" এর অংশ হিসেবে করা হয়েছে।

---

## ২. স্থাপত্য (Architecture) — কেন এভাবে সাজানো হলো

পুরনো ভার্সনে (v1) পুরো ওয়েবসাইট একটাই বড় `.js` ফাইলে ছিল, যেখানে প্রতিটি পেজের HTML একটা স্ট্রিং হিসেবে সার্ভার-সাইডে জেনারেট হতো। এখন:

- **`public/`** স্ট্যাটিক ফাইল হিসেবে থাকে এবং সরাসরি Cloudflare এর Asset layer দিয়ে সার্ভ হয় — Worker কোড টাচও করে না, তাই অনেক দ্রুত।
- **`src/index.js`**-এ `run_worker_first = ["/api/*"]` সেট করা আছে (দেখুন `wrangler.toml`), মানে শুধু `/api/*` রিকোয়েস্ট Worker-এ যায়; বাকি সব (`/dashboard`, `/pay` ইত্যাদি) সরাসরি স্ট্যাটিক ফাইল হিসেবে সার্ভ হয়ে যায় (`html_handling` অটো `.html` এক্সটেনশন যোগ করে দেয়)।
- প্রতিটি পেজ লোড হওয়ার পর নিজের JS ফাইল `GET /api/settings` কল করে সাইটের নাম, চালু থাকা পেমেন্ট মেথড, সাপোর্ট লিংক ইত্যাদি নিয়ে আসে — তাই সেটিংস পরিবর্তন করতে রিডেপ্লয়ের দরকার নেই।

---

## ৩. নিরাপত্তা সংক্রান্ত গুরুত্বপূর্ণ পরিবর্তন

1. **`ADMIN_KEY` আর কোডে হার্ডকোড করা নেই।** আগের ভার্সনে এটা সোর্স কোডে প্লেইন টেক্সটে লেখা ছিল, যেটা GitHub-এ আপলোড করলে সবাই দেখতে পেত। এখন এটা `env.ADMIN_KEY` — Cloudflare-এর এনক্রিপ্টেড সিক্রেট হিসেবে সেট করতে হয় (দেখুন সেকশন ৫)।
2. **Webhook সিগনেচার এখন মার্চেন্টের নিজের API key দিয়ে সাইন হয়, ADMIN_KEY দিয়ে নয়।** আগের ভার্সনে webhook `X-Signature` হেডার প্ল্যাটফর্মের মাস্টার `ADMIN_KEY` দিয়ে সাইন হতো — যার মানে মার্চেন্টকে সিগনেচার ভেরিফাই করতে হলে আপনার মাস্টার অ্যাডমিন কী জানতে হতো, যা একটা গুরুতর নিরাপত্তা সমস্যা। এখন প্রতিটি webhook সংশ্লিষ্ট মার্চেন্টের নিজের (গোপন) API key দিয়ে সাইন হয়, যেটা মার্চেন্ট নিজেই `/keys.html` পেজ থেকে জানে।

---

## ৪. পেমেন্ট মেথড ও পেমেন্ট ফ্লো

চারটি মেথড সাপোর্টেড: **bKash, Nagad, Rocket, Upay** — প্রতিটির নিজস্ব গ্রহণকারী নম্বর ও অন/অফ সুইচ `/admin` থেকে নিয়ন্ত্রণযোগ্য।

**`/pay?id=INV-XXXX` এর ফ্লো:**
1. **লোডিং** → ইনভয়েস তথ্য আনা হয়।
2. **মেথড সিলেকশন** (`selectMethodState`) — উপরে ব্যাক (← হোমে) ও ক্লোজ (✕, ইনভয়েস থেকে বের হওয়া) আইকন, ব্র্যান্ড কার্ড, সাপোর্ট আইকন রো, "মোবাইল ব্যাংকিং" লেবেল, ৪টি মেথডের গ্রিড (bKash/Nagad/Rocket/Upay), নিচে পরিমাণ দেখানো বার। কোনো মেথডে ক্লিক করলে সরাসরি সেই মেথডের পেমেন্ট পেজে চলে যায়।
3. **Transaction ID জমা** (`payState`) — উপরে শুধু ব্যাক আইকন (মেথড সিলেকশনে ফিরে যায়, "মেথড পরিবর্তন" জাতীয় কোনো টেক্সট নেই), মেথডের ব্র্যান্ড কালার থিমে পিংক/অরেঞ্জ/পার্পল/ব্লু কার্ড, ধাপে ধাপে নির্দেশনা, Transaction ID ইনপুট, "যাচাই করুন" বাটন।
4. **সফল** — সবুজ চেকমার্ক + Transaction ID।
5. **মেয়াদোত্তীর্ণ** — লাল ঘড়ি আইকন দেখিয়ে ঠিক **১ সেকেন্ড পর অটোমেটিক হোমপেজে রিডাইরেক্ট** করে দেয় (`public/js/invoice.js` এর `handleExpiry()` ফাংশন)।

---

## ৫. ডেপ্লয়মেন্ট — ধাপে ধাপে

```bash
npm install -g wrangler        # যদি না থাকে
wrangler login

# ১. D1 ডাটাবেস তৈরি করুন
wrangler d1 create paylink-db
# — আউটপুট থেকে database_id কপি করে wrangler.toml এ বসান

# ২. স্কিমা প্রয়োগ করুন (fresh install)
npm run db:apply:remote

# ৩. অ্যাডমিন কী সেট করুন (একবারই, সিক্রেট হিসেবে এনক্রিপ্টেড থাকবে)
wrangler secret put ADMIN_KEY
# — একটা লম্বা random string দিন, যেমন: openssl rand -hex 32

# ৪. ডেপ্লয় করুন
npm run deploy
```

ডেপ্লয়ের পর `https://your-worker.workers.dev/admin` এ গিয়ে সেই ADMIN_KEY দিয়ে লগইন করে bKash/Nagad/Rocket/Upay নম্বর, ফি, সাপোর্ট টেলিগ্রাম/হোয়াটসঅ্যাপ/ফোন ইত্যাদি সেট করে নিন।

**পুরনো (v1, শুধু bKash+Nagad) ডাটাবেস থেকে আপগ্রেড করলে** `db:apply:remote` না চালিয়ে বদলে চালান:
```bash
npm run db:migrate:remote
```

---

## ৬. SMS ইনজেশন (Android ফরওয়ার্ডার অ্যাপ)

আপনার ফোনে থাকা SMS-ফরওয়ার্ডার অ্যাপ থেকে প্রতিটি bKash/Nagad/Rocket/Upay কনফার্মেশন SMS নিচের এন্ডপয়েন্টে পাঠাতে হবে:

```
POST /api/sms/ingest
Authorization: Bearer <ADMIN_KEY>
Content-Type: application/json

{
  "trxId": "8N7A9X2K1L",
  "amount": 500,
  "method": "bkash",
  "senderNumber": "01812345678",
  "rawSms": "You have received Tk 500.00 from 018XXXXXXXX..."
}
```

মিলে গেলে সংশ্লিষ্ট ইনভয়েস স্বয়ংক্রিয়ভাবে `verified` হয়ে মার্চেন্টের ব্যালেন্সে (ফি বাদে) জমা হয়ে যাবে এবং webhook পাঠানো হবে। না মিললে অ্যাডমিন প্যানেলের **ইনভয়েস** ট্যাব থেকে ম্যানুয়ালি যাচাই করা যাবে।

---

## ৭. অ্যাডমিন প্যানেলের ফিচার (`/admin`)

| ট্যাব | কী করা যায় |
|---|---|
| **ওভারভিউ** | মোট মার্চেন্ট, আজকের/মোট ভলিউম, প্ল্যাটফর্ম রেভিনিউ, পেন্ডিং উত্তোলন/ইনভয়েস |
| **মার্চেন্ট** | সার্চ, সাসপেন্ড/সক্রিয় করা, **ম্যানুয়াল ব্যালেন্স সমন্বয়** (কারণসহ, অডিট ট্রেইল রাখা হয়) |
| **ইনভয়েস** | ID/TrxID/রেফারেন্স/ইমেইল দিয়ে সার্চ, স্ট্যাটাস ফিল্টার, **ম্যানুয়াল ভেরিফাই** (SMS না মিললে) |
| **উত্তোলন** | পেন্ডিং/সম্পন্ন/বাতিল/সব — "পাঠানো হয়েছে" বা "বাতিল" করা যায়, ঐচ্ছিক নোটসহ |
| **সেটিংস** | সাইটের নাম, ৪টি মেথডের নম্বর ও অন/অফ, ফি, সর্বনিম্ন উত্তোলন, টেলিগ্রাম/হোয়াটসঅ্যাপ/ফোন সাপোর্ট লিংক, ড্যাশবোর্ড ঘোষণা, রক্ষণাবেক্ষণ মোড |

---

## ৮. API সংক্ষিপ্ত রেফারেন্স

```
GET  /api/settings                      পাবলিক সেটিংস (সাইট নাম, চালু মেথড, সাপোর্ট লিংক)

POST /api/auth/signup | /login | /logout
GET  /api/me

POST /api/invoices                      (Bearer merchant API key)
GET  /api/invoices/:id                  (public)
POST /api/invoices/:id/select-method    (public)
POST /api/invoices/:id/verify           (public)

POST /api/sms/ingest                    (Bearer ADMIN_KEY)

GET  /api/wallet/summary | /transactions | /payouts   (Bearer session token)
POST /api/wallet/payout
GET  /api/keys           POST /api/keys/regenerate

--- সব admin রুট Bearer ADMIN_KEY দিয়ে গেটেড ---
GET  /api/admin/overview
GET  /api/admin/merchants?q=
GET  /api/admin/merchants/:id
POST /api/admin/merchants/:id/status
POST /api/admin/merchants/:id/adjust-balance
GET  /api/admin/invoices?q=&status=
POST /api/admin/invoices/:id/verify
GET  /api/admin/payouts?status=
POST /api/admin/payouts/:id/complete | /reject
GET  /api/admin/settings   POST /api/admin/settings
```

সম্পূর্ণ ইন্টিগ্রেশন কোড ও `/webhook` হ্যান্ডলার উদাহরণ `public/docs.html` পেজে (ডেপ্লয়ের পর `/docs.html`-এ) দেখুন — কপি বাটন সহ।

---

## ৯. যা এখনো নিজে করতে হবে

- `public/assets/methods/*.svg` এবং `public/assets/logo.svg` — এগুলো এখন পরিষ্কার কিন্তু বেসিক প্লেসহোল্ডার (ট্রেডমার্কড লোগো হুবহু কপি করা হয়নি)। আসল bKash/Nagad/Rocket/Upay লোগো ও নিজের ব্র্যান্ড লোগো দিয়ে রিপ্লেস করে নিন।
- `wrangler.toml` এ `database_id` বসান এবং `wrangler secret put ADMIN_KEY` চালান।
- `/admin` থেকে সঠিক bKash/Nagad/Rocket/Upay নম্বর ও টেলিগ্রাম/হোয়াটসঅ্যাপ সাপোর্ট লিংক বসান।
