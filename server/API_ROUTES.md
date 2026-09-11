# API Routes — real backend upgrade path

This maps every function in `/js/data.js` (the `api` object the frontend
already calls) to the real REST endpoint it should become once you stand
up a Node/Express (or Next.js API routes) server against the Prisma
schema in `schema.prisma`. Because the frontend was written entirely
against `api.xxx()` calls, upgrading only means rewriting the *bodies*
of those functions in `js/data.js` to call `fetch('/api/...')` instead
of `localStorage` — no other file needs to change.

## Auth
| Frontend call | Route | Notes |
|---|---|---|
| `api.signup` | `POST /api/auth/signup` | bcrypt-hash password server-side, return JWT/session cookie |
| `api.login` | `POST /api/auth/login` | verify bcrypt hash, return JWT/session cookie |
| `api.adminLogin` | `POST /api/admin/auth/login` | separate table, separate JWT scope (`role: admin`) |
| `api.changeAdminPassword` | `POST /api/admin/auth/change-password` | requires valid admin session |

## Products
| Frontend call | Route |
|---|---|
| `api.getProducts` | `GET /api/products?category=&search=&sort=&featured=&new=` |
| `api.getProduct` | `GET /api/products/:id` |
| `api.createProduct` | `POST /api/admin/products` (admin only) |
| `api.updateProduct` | `PATCH /api/admin/products/:id` (admin only) |
| `api.deleteProduct` | `DELETE /api/admin/products/:id` (admin only) |

Image uploads: the admin dashboard's file input should upload to
`POST /api/admin/products/:id/images` as `multipart/form-data`, which
the server streams to Cloudinary/S3/Supabase Storage and stores only
the resulting URL in `ProductImage.url` — never the raw file or a
base64 blob in the database.

## Wishlist / Cart
| Frontend call | Route |
|---|---|
| `api.getWishlist` | `GET /api/wishlist` (auth required) |
| `api.toggleWishlist` | `POST /api/wishlist/:productId/toggle` (auth required) |
| `api.getCart` / `api.saveCart` | Cart can stay client-side (localStorage) even in production, or move to `GET/PUT /api/cart` if you want cross-device persistence for logged-in users |

## Orders
| Frontend call | Route |
|---|---|
| `api.createOrder` | `POST /api/orders` — generate the `SCyyyy######` ID server-side, decrement stock in a transaction |
| `api.getOrder` | `GET /api/orders/:id` — public (order-ID lookup is the "track order" auth model) |
| `api.getOrdersByUser` | `GET /api/orders?mine=true` (auth required) |
| `api.getAllOrders` | `GET /api/admin/orders` (admin only) |
| `api.updateOrderStatus` | `PATCH /api/admin/orders/:id/status` (admin only) |
| `api.updateOrderETA` | `PATCH /api/admin/orders/:id/eta` (admin only) |

## Custom orders / Hampers / Reviews / Newsletter / Contact
Each follows the same public-write / admin-read-and-moderate pattern:
- `POST /api/custom-orders`, `GET /api/admin/custom-orders`, `PATCH /api/admin/custom-orders/:id`
- `POST /api/hamper-requests`, `GET /api/admin/hamper-requests`
- `POST /api/reviews`, `GET /api/reviews` (approved only), `GET /api/admin/reviews`, `PATCH /api/admin/reviews/:id/approve`
- `POST /api/newsletter/subscribe`, `GET /api/admin/newsletter`
- `POST /api/contact`, `GET /api/admin/messages`

## Store settings
| Frontend call | Route |
|---|---|
| `api.getSettings` | `GET /api/settings` — public (checkout needs the UPI ID) |
| `api.updateSettings` | `PATCH /api/admin/settings` (admin only) |

## Security requirements for the real backend
- Hash all passwords with **bcrypt** (cost factor ≥ 10), never SHA-256-in-the-browser (that trick is only used in the current demo because there is no server to hash on).
- Issue **httpOnly, secure** session cookies or short-lived JWTs; never store tokens in `localStorage` in production.
- Every `/api/admin/*` route must verify an admin session server-side — the frontend hiding the admin nav is not access control.
- Validate file type and size **server-side** as well as client-side (client checks are a UX nicety, not a security boundary).
- Load all secrets (`DATABASE_URL`, `JWT_SECRET`, `CLOUDINARY_*`, `RAZORPAY_KEY_SECRET`) from environment variables — see `.env.example`.
