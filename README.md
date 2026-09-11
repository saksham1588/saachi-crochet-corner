# Saachi Crochet Corner ♡

Handmade happiness, one loop at a time.

## What this is

A fully working, end-to-end ecommerce frontend for a handmade crochet
shop, built to the full spec: customer accounts, wishlist, cart,
checkout, order tracking, custom orders, gift hampers, reviews, an
admin dashboard with full product/order/settings management, and admin
authentication — all functioning, all persisting across a page
refresh.

**Every button works.** Nothing here is a static mockup: adding a
product in the admin dashboard really adds it to the shop, placing an
order really generates an order ID and a trackable status timeline,
changing the UPI ID in Payment Settings really changes what customers
see at checkout.

## How it's built

This runs entirely as a static site — `index.html` + `css/style.css` +
`js/data.js` + `js/app.js` — with `js/data.js` acting as a **mock
backend**: it exposes the exact same async `api.xxxx()` functions a
real backend client would, but persists to the browser's `localStorage`
instead of a server database. This was a deliberate choice so the
entire app runs immediately, in any browser, with zero setup — while
staying structured so it's a small, mechanical step to a real
production backend (see below).

## Running it

Just open `index.html` in a browser. For full compatibility (some
browsers restrict parts of the Web Crypto API on `file://` pages),
serve it from a tiny local server instead:

```bash
cd saachi
python3 -m http.server 8080
# then open http://localhost:8080
```

**Build command:** none — it's static HTML/CSS/JS.
**Start command:** any static file server (the one above, `npx serve`, Netlify, Vercel, GitHub Pages, etc.) pointed at this folder.

## Logging in

- **Customer:** use "Login / Sign Up" from the header — create a new account, it's stored locally.
- **Admin:** go to `#/admin/login`, or the 🔐 icon, with either
  `sachigandhi935@gmail.com` or `jaiinneha52@gmail.com`, temporary
  password `12345678`. You'll want to change this immediately from
  **Admin Dashboard → Change Password** — it's a temporary password by
  design, and the dashboard nudges you to change it.

## Upgrading to a real production backend

This demo intentionally keeps all "backend" logic inside one file,
`js/data.js`, and nowhere else, specifically so upgrading is
mechanical:

1. Stand up a Node/Express (or Next.js API routes) server against
   `server/schema.prisma` (PostgreSQL + Prisma), following the route
   plan in `server/API_ROUTES.md`.
2. Rewrite each function body in `js/data.js` to call the matching
   `fetch('/api/...')` route instead of reading/writing `localStorage`.
3. Nothing in `js/app.js` or any `.html`/`.css` file needs to change —
   they only ever talk to `api.xxxx()`.
4. Move password hashing from the browser-side SHA-256 stand-in (only
   there so no plaintext password sits in `localStorage` during the
   demo) to real **bcrypt**, done server-side.
5. Move product images and custom-order reference photos from
   base64-in-localStorage to real uploads (Cloudinary / S3 / Supabase
   Storage), storing only the resulting URL.
6. Copy `.env.example` to `.env` and fill in real secrets — never put
   real credentials in source code.

## What's deliberately out of scope for the static version

- A live payment gateway charge (Razorpay etc.) — the Payment
  Settings tab stores a public key ID and UPI instructions for
  customers to pay manually and get confirmed by DM, exactly as
  specified; a real gateway charge requires a server to hold the
  secret key.
- Cross-device sync of accounts/orders/cart, since everything lives in
  one browser's `localStorage` until the real backend is wired up.

## Project structure

```
saachi/
├── index.html              # single page-shell; all views render into #app-view
├── css/style.css            # design system (see design notes below)
├── js/
│   ├── data.js               # mock backend / database layer (swap this for real API calls)
│   └── app.js                 # router + all page rendering + UI logic
├── server/
│   ├── schema.prisma          # real Postgres schema for the upgrade path
│   └── API_ROUTES.md          # route-by-route upgrade plan
└── .env.example              # environment variables for the real backend
```

## Design notes

Palette: cream `#FBF5EC` background, blush `#F3D7DD` accents, dusty
rose `#C97B8D` as the primary action color, deep plum-brown `#6E4335`
for headings. Typefaces: **Fraunces** (a characterful, slightly
old-style serif) for headings, **Quicksand** (rounded, soft) for body
text and UI. The signature motif is a hand-stitched dashed border and
a single yarn-trail line, used instead of generic drop-shadow cards, to
keep the "handmade" feeling structural rather than decorative.
