/* ============================================================
   Saachi Crochet Corner — Data Layer
   ------------------------------------------------------------
  The browser cache is kept as an offline fallback, while the
  same-origin persistence service stores the complete database on
  the server. Every function remains an async API client so the
  UI does not need to know where the data is stored.

   See /server/schema.prisma and /server/API_ROUTES.md for the
  data model and API notes.
   ============================================================ */

const DB_KEYS = {
  PRODUCTS: 'scc_products',
  USERS: 'scc_users',
  ADMINS: 'scc_admins',
  ORDERS: 'scc_orders',
  CUSTOM_ORDERS: 'scc_custom_orders',
  HAMPER_REQUESTS: 'scc_hamper_requests',
  WISHLIST: 'scc_wishlist',
  CART: 'scc_cart',
  REVIEWS: 'scc_reviews',
  SUBSCRIBERS: 'scc_subscribers',
  MESSAGES: 'scc_messages',
  SETTINGS: 'scc_settings',
  SESSION: 'scc_session',
  ORDER_SEQ: 'scc_order_seq',
};

/* ---------- tiny helpers ---------- */

function delay(ms = 120) {
  return new Promise((res) => setTimeout(res, ms));
}

function readTable(key, fallback) {
  const raw = localStorage.getItem(key);
  if (raw === null) return structuredClone(fallback);
  try {
    return JSON.parse(raw);
  } catch {
    return structuredClone(fallback);
  }
}

function writeTable(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
  queueDatabaseSync();
}

let databaseSync = Promise.resolve();

function getDatabaseSnapshot() {
  const snapshot = {};
  Object.values(DB_KEYS).forEach((key) => { snapshot[key] = readTable(key, []); });
  return snapshot;
}

function queueDatabaseSync() {
  if (!navigator.onLine || !window.fetch) return;
  databaseSync = databaseSync
    .catch(() => {})
    .then(() => fetch('/api/database', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(getDatabaseSnapshot()),
    }))
    .catch(() => {});
}

async function loadDatabaseFromServer() {
  if (!window.fetch) return false;
  try {
    const response = await fetch('/api/database');
    if (!response.ok) return false;
    const snapshot = await response.json();
    Object.entries(snapshot).forEach(([key, value]) => {
      if (Object.values(DB_KEYS).includes(key)) localStorage.setItem(key, JSON.stringify(value));
    });
    return true;
  } catch {
    return false;
  }
}

function uid(prefix = 'id') {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

/* A simple, salted hash for the demo environment only.
   NOT a substitute for bcrypt/argon2 — the real backend
   (see server/API_ROUTES.md) must hash with bcrypt server-side.
   This exists purely so plaintext passwords are never the
   thing sitting in localStorage during this demo. */
async function hashPassword(password, salt) {
  const enc = new TextEncoder();
  const data = enc.encode(salt + ':' + password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function makeSalt() {
  return Array.from(crypto.getRandomValues(new Uint8Array(16)))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/* ---------- seed data ---------- */

const PLACEHOLDER_SVGS = {
  clip: 'clip', bouquet: 'bouquet', keychain: 'keychain',
  charm: 'charm', rakhi: 'rakhi', hamper: 'hamper',
};

const SEED_PRODUCTS = [
  {
    id: 'prod_1', sku: 'SC-HC-001', name: 'Blush Bloom Hair Clip',
    category: 'Hair Accessories', price: 249, stock: 18,
    description: 'A dainty crochet rose in dusty blush, hand-stitched onto a snag-free clip. Soft enough for baby-fine hair, sturdy enough for a full day out.',
    images: ['clip'], featured: true, newArrival: false, available: true,
    createdAt: Date.now() - 1000 * 60 * 60 * 24 * 40,
  },
  {
    id: 'prod_2', sku: 'SC-FL-002', name: 'Mini Daisy Crochet Bouquet',
    category: 'Crochet Flowers', price: 399, stock: 12,
    description: 'Five little daisies on wire stems, arranged in a bouquet that never wilts. Wrapped in kraft paper — ready to gift as-is.',
    images: ['bouquet'], featured: true, newArrival: true, available: true,
    createdAt: Date.now() - 1000 * 60 * 60 * 24 * 3,
  },
  {
    id: 'prod_3', sku: 'SC-KC-003', name: 'Sweetheart Keychain',
    category: 'Keychains', price: 199, stock: 30,
    description: 'A tiny puffed heart in your choice-on-request colour, finished with a brass keyring. Small enough to tuck into a card as a gift.',
    images: ['keychain'], featured: false, newArrival: false, available: true,
    createdAt: Date.now() - 1000 * 60 * 60 * 24 * 60,
  },
  {
    id: 'prod_4', sku: 'SC-PC-004', name: 'Pastel Phone Charm',
    category: 'Phone Charms', price: 179, stock: 25,
    description: 'A cluster of mini granny-square charms in pastel cotton thread, on a soft strap loop that fits every phone case.',
    images: ['charm'], featured: false, newArrival: true, available: true,
    createdAt: Date.now() - 1000 * 60 * 60 * 24 * 2,
  },
  {
    id: 'prod_5', sku: 'SC-RK-005', name: 'Handmade Rakhi',
    category: 'Rakhis', price: 149, stock: 40,
    description: 'A classic crochet flower rakhi on a soft cotton cord — lightweight for all-day wear, with a tiny bead centre.',
    images: ['rakhi'], featured: true, newArrival: false, available: true,
    createdAt: Date.now() - 1000 * 60 * 60 * 24 * 20,
  },
  {
    id: 'prod_6', sku: 'SC-GH-006', name: 'Cozy Mini Gift Hamper',
    category: 'Gift Hampers', price: 699, stock: 8,
    description: 'A curated little hamper: one keychain, one phone charm and a mini bouquet, boxed in cream and tied with ribbon.',
    images: ['hamper'], featured: true, newArrival: false, available: true,
    createdAt: Date.now() - 1000 * 60 * 60 * 24 * 15,
  },
];

const SEED_REVIEWS = [
  { id: uid('rev'), name: 'Ananya R.', rating: 5, text: 'The hair clip is even prettier in person — so well made!', image: null, approved: true, createdAt: Date.now() - 8.64e7 * 5 },
  { id: uid('rev'), name: 'Priya S.', rating: 5, text: 'Ordered a custom hamper for my sister and she loved every piece.', image: null, approved: true, createdAt: Date.now() - 8.64e7 * 12 },
  { id: uid('rev'), name: 'Meher K.', rating: 4, text: 'Rakhi was lovely and arrived well before the festival.', image: null, approved: true, createdAt: Date.now() - 8.64e7 * 20 },
];

const DEFAULT_SETTINGS = {
  upiId: 'pramilagandhi62-1@okaxis',
  bankAccountNumber: '3961000100019833',
  paymentInstructions: 'Pay the exact order total to the UPI ID above via any UPI app, then upload/share the screenshot on Instagram DM with your Order ID so we can confirm it quickly.',
  razorpayKeyId: '',
  deliveryCharge: 49,
  freeDeliveryAbove: 999,
};

const ORDER_STATUSES = ['Order Placed', 'Confirmed', 'Making', 'Packed', 'Shipped', 'Delivered'];

/* ---------- init ---------- */

async function initDatabase() {
  await loadDatabaseFromServer();
  if (!localStorage.getItem(DB_KEYS.PRODUCTS)) {
    writeTable(DB_KEYS.PRODUCTS, SEED_PRODUCTS);
  }
  if (!localStorage.getItem(DB_KEYS.REVIEWS)) {
    writeTable(DB_KEYS.REVIEWS, SEED_REVIEWS);
  }
  if (!localStorage.getItem(DB_KEYS.SETTINGS)) {
    writeTable(DB_KEYS.SETTINGS, DEFAULT_SETTINGS);
  }
  if (!localStorage.getItem(DB_KEYS.ORDER_SEQ)) {
    localStorage.setItem(DB_KEYS.ORDER_SEQ, '1000');
  }
  if (!localStorage.getItem(DB_KEYS.ADMINS)) {
    const salt1 = makeSalt();
    const salt2 = makeSalt();
    const admins = [
      { id: uid('admin'), email: 'sachigandhi935@gmail.com', salt: salt1, passwordHash: await hashPassword('12345678', salt1), mustChangePassword: true },
      { id: uid('admin'), email: 'jaiinneha52@gmail.com', salt: salt2, passwordHash: await hashPassword('12345678', salt2), mustChangePassword: true },
    ];
    writeTable(DB_KEYS.ADMINS, admins);
  }
  for (const k of [DB_KEYS.USERS, DB_KEYS.ORDERS, DB_KEYS.CUSTOM_ORDERS, DB_KEYS.HAMPER_REQUESTS, DB_KEYS.WISHLIST, DB_KEYS.CART, DB_KEYS.SUBSCRIBERS, DB_KEYS.MESSAGES]) {
    if (!localStorage.getItem(k)) writeTable(k, []);
  }
  queueDatabaseSync();
}

/* ============================================================
   API — Products
   ============================================================ */
const api = {

  async getProducts({ category, search, sort, featuredOnly, newOnly } = {}) {
    await delay();
    let items = readTable(DB_KEYS.PRODUCTS, []);
    if (category && category !== 'All') items = items.filter((p) => p.category === category);
    if (featuredOnly) items = items.filter((p) => p.featured);
    if (newOnly) items = items.filter((p) => p.newArrival);
    if (search) {
      const q = search.trim().toLowerCase();
      items = items.filter((p) => p.name.toLowerCase().includes(q) || p.category.toLowerCase().includes(q) || p.description.toLowerCase().includes(q));
    }
    if (sort === 'price-asc') items = items.slice().sort((a, b) => a.price - b.price);
    else if (sort === 'price-desc') items = items.slice().sort((a, b) => b.price - a.price);
    else if (sort === 'newest') items = items.slice().sort((a, b) => b.createdAt - a.createdAt);
    return items;
  },

  async getProduct(id) {
    await delay();
    const items = readTable(DB_KEYS.PRODUCTS, []);
    return items.find((p) => p.id === id) || null;
  },

  async createProduct(product) {
    await delay();
    const items = readTable(DB_KEYS.PRODUCTS, []);
    const newProduct = {
      id: uid('prod'),
      sku: product.sku || `SC-${Math.random().toString(36).slice(2, 7).toUpperCase()}`,
      createdAt: Date.now(),
      images: product.images && product.images.length ? product.images : ['placeholder'],
      ...product,
    };
    items.unshift(newProduct);
    writeTable(DB_KEYS.PRODUCTS, items);
    return newProduct;
  },

  async updateProduct(id, patch) {
    await delay();
    const items = readTable(DB_KEYS.PRODUCTS, []);
    const idx = items.findIndex((p) => p.id === id);
    if (idx === -1) throw new Error('Product not found');
    items[idx] = { ...items[idx], ...patch };
    writeTable(DB_KEYS.PRODUCTS, items);
    return items[idx];
  },

  async deleteProduct(id) {
    await delay();
    let items = readTable(DB_KEYS.PRODUCTS, []);
    items = items.filter((p) => p.id !== id);
    writeTable(DB_KEYS.PRODUCTS, items);
    return true;
  },

  /* ---------- Customer auth ---------- */

  async signup({ fullName, email, phone, password }) {
    await delay();
    const users = readTable(DB_KEYS.USERS, []);
    if (users.some((u) => u.email.toLowerCase() === email.toLowerCase())) {
      throw new Error('An account with this email already exists.');
    }
    const salt = makeSalt();
    const user = {
      id: uid('user'), fullName, email, phone,
      salt, passwordHash: await hashPassword(password, salt),
      addresses: [], createdAt: Date.now(),
    };
    users.push(user);
    writeTable(DB_KEYS.USERS, users);
    return { id: user.id, fullName: user.fullName, email: user.email, phone: user.phone };
  },

  async login({ email, password }) {
    await delay();
    const users = readTable(DB_KEYS.USERS, []);
    const user = users.find((u) => u.email.toLowerCase() === email.toLowerCase());
    if (!user) throw new Error('No account found with this email.');
    const hash = await hashPassword(password, user.salt);
    if (hash !== user.passwordHash) throw new Error('Incorrect password.');
    return { id: user.id, fullName: user.fullName, email: user.email, phone: user.phone };
  },

  async saveAddress(userId, address) {
    await delay();
    const users = readTable(DB_KEYS.USERS, []);
    const idx = users.findIndex((u) => u.id === userId);
    if (idx === -1) throw new Error('User not found');
    const addr = { id: uid('addr'), ...address };
    users[idx].addresses = users[idx].addresses || [];
    users[idx].addresses.push(addr);
    writeTable(DB_KEYS.USERS, users);
    return addr;
  },

  /* ---------- Admin auth ---------- */

  async adminLogin({ email, password }) {
    await delay();
    const admins = readTable(DB_KEYS.ADMINS, []);
    const admin = admins.find((a) => a.email.toLowerCase() === email.toLowerCase());
    if (!admin) throw new Error('No admin account with this email.');
    const hash = await hashPassword(password, admin.salt);
    if (hash !== admin.passwordHash) throw new Error('Incorrect password.');
    return { id: admin.id, email: admin.email, mustChangePassword: admin.mustChangePassword };
  },

  async changeAdminPassword(adminId, { currentPassword, newPassword }) {
    await delay();
    const admins = readTable(DB_KEYS.ADMINS, []);
    const idx = admins.findIndex((a) => a.id === adminId);
    if (idx === -1) throw new Error('Admin not found');
    const currentHash = await hashPassword(currentPassword, admins[idx].salt);
    if (currentHash !== admins[idx].passwordHash) throw new Error('Current password is incorrect.');
    if (newPassword.length < 8) throw new Error('New password must be at least 8 characters.');
    const salt = makeSalt();
    admins[idx].salt = salt;
    admins[idx].passwordHash = await hashPassword(newPassword, salt);
    admins[idx].mustChangePassword = false;
    writeTable(DB_KEYS.ADMINS, admins);
    return true;
  },

  /* ---------- Wishlist ---------- */

  async getWishlist(userId) {
    await delay();
    const all = readTable(DB_KEYS.WISHLIST, []);
    return all.filter((w) => w.userId === userId);
  },

  async toggleWishlist(userId, productId) {
    await delay();
    let all = readTable(DB_KEYS.WISHLIST, []);
    const exists = all.some((w) => w.userId === userId && w.productId === productId);
    if (exists) {
      all = all.filter((w) => !(w.userId === userId && w.productId === productId));
    } else {
      all.push({ id: uid('wish'), userId, productId, addedAt: Date.now() });
    }
    writeTable(DB_KEYS.WISHLIST, all);
    return !exists;
  },

  /* ---------- Cart (persisted per browser; merges into user on login) ---------- */

  getCart() {
    return readTable(DB_KEYS.CART, []);
  },

  saveCart(cart) {
    writeTable(DB_KEYS.CART, cart);
  },

  /* ---------- Orders ---------- */

  nextOrderId() {
    const seq = parseInt(localStorage.getItem(DB_KEYS.ORDER_SEQ) || '1000', 10) + 1;
    localStorage.setItem(DB_KEYS.ORDER_SEQ, String(seq));
    const year = new Date().getFullYear();
    return `SC${year}${String(seq).padStart(6, '0')}`;
  },

  async createOrder(order) {
    await delay();
    const orders = readTable(DB_KEYS.ORDERS, []);
    const newOrder = {
      id: this.nextOrderId(),
      status: 'Order Placed',
      paymentStatus: 'Pending Confirmation',
      createdAt: Date.now(),
      statusHistory: [{ status: 'Order Placed', at: Date.now() }],
      ...order,
    };
    orders.unshift(newOrder);
    writeTable(DB_KEYS.ORDERS, orders);
    // decrement stock
    const products = readTable(DB_KEYS.PRODUCTS, []);
    order.items.forEach((it) => {
      const p = products.find((pp) => pp.id === it.productId);
      if (p) p.stock = Math.max(0, p.stock - it.qty);
    });
    writeTable(DB_KEYS.PRODUCTS, products);
    return newOrder;
  },

  async getOrder(orderId) {
    await delay();
    const orders = readTable(DB_KEYS.ORDERS, []);
    return orders.find((o) => o.id.toLowerCase() === String(orderId).toLowerCase()) || null;
  },

  async getOrdersByUser(userId) {
    await delay();
    const orders = readTable(DB_KEYS.ORDERS, []);
    return orders.filter((o) => o.userId === userId).sort((a, b) => b.createdAt - a.createdAt);
  },

  async getAllOrders() {
    await delay();
    return readTable(DB_KEYS.ORDERS, []).sort((a, b) => b.createdAt - a.createdAt);
  },

  async updateOrderStatus(orderId, status) {
    await delay();
    const orders = readTable(DB_KEYS.ORDERS, []);
    const idx = orders.findIndex((o) => o.id === orderId);
    if (idx === -1) throw new Error('Order not found');
    orders[idx].status = status;
    orders[idx].statusHistory = orders[idx].statusHistory || [];
    orders[idx].statusHistory.push({ status, at: Date.now() });
    writeTable(DB_KEYS.ORDERS, orders);
    return orders[idx];
  },

  async updateOrderETA(orderId, eta) {
    await delay();
    const orders = readTable(DB_KEYS.ORDERS, []);
    const idx = orders.findIndex((o) => o.id === orderId);
    if (idx === -1) throw new Error('Order not found');
    orders[idx].estimatedDelivery = eta;
    writeTable(DB_KEYS.ORDERS, orders);
    return orders[idx];
  },

  /* ---------- Custom orders ---------- */

  async createCustomOrder(request) {
    await delay();
    const list = readTable(DB_KEYS.CUSTOM_ORDERS, []);
    const item = { id: uid('custom'), status: 'New', createdAt: Date.now(), ...request };
    list.unshift(item);
    writeTable(DB_KEYS.CUSTOM_ORDERS, list);
    return item;
  },

  async getCustomOrders() {
    await delay();
    return readTable(DB_KEYS.CUSTOM_ORDERS, []).sort((a, b) => b.createdAt - a.createdAt);
  },

  async updateCustomOrderStatus(id, status) {
    await delay();
    const list = readTable(DB_KEYS.CUSTOM_ORDERS, []);
    const idx = list.findIndex((c) => c.id === id);
    if (idx === -1) throw new Error('Request not found');
    list[idx].status = status;
    writeTable(DB_KEYS.CUSTOM_ORDERS, list);
    return list[idx];
  },

  /* ---------- Gift hamper custom requests ---------- */

  async createHamperRequest(request) {
    await delay();
    const list = readTable(DB_KEYS.HAMPER_REQUESTS, []);
    const item = { id: uid('hamper'), status: 'New', createdAt: Date.now(), ...request };
    list.unshift(item);
    writeTable(DB_KEYS.HAMPER_REQUESTS, list);
    return item;
  },

  async getHamperRequests() {
    await delay();
    return readTable(DB_KEYS.HAMPER_REQUESTS, []).sort((a, b) => b.createdAt - a.createdAt);
  },

  /* ---------- Reviews ---------- */

  async getApprovedReviews() {
    await delay();
    return readTable(DB_KEYS.REVIEWS, []).filter((r) => r.approved).sort((a, b) => b.createdAt - a.createdAt);
  },

  async getAllReviews() {
    await delay();
    return readTable(DB_KEYS.REVIEWS, []).sort((a, b) => b.createdAt - a.createdAt);
  },

  async submitReview(review) {
    await delay();
    const list = readTable(DB_KEYS.REVIEWS, []);
    const item = { id: uid('rev'), approved: false, createdAt: Date.now(), ...review };
    list.unshift(item);
    writeTable(DB_KEYS.REVIEWS, list);
    return item;
  },

  async setReviewApproval(id, approved) {
    await delay();
    const list = readTable(DB_KEYS.REVIEWS, []);
    const idx = list.findIndex((r) => r.id === id);
    if (idx === -1) throw new Error('Review not found');
    list[idx].approved = approved;
    writeTable(DB_KEYS.REVIEWS, list);
    return list[idx];
  },

  /* ---------- Newsletter ---------- */

  async subscribe(email) {
    await delay();
    const list = readTable(DB_KEYS.SUBSCRIBERS, []);
    if (list.some((s) => s.email.toLowerCase() === email.toLowerCase())) {
      return { alreadySubscribed: true };
    }
    list.unshift({ id: uid('sub'), email, subscribedAt: Date.now() });
    writeTable(DB_KEYS.SUBSCRIBERS, list);
    return { alreadySubscribed: false };
  },

  async getSubscribers() {
    await delay();
    return readTable(DB_KEYS.SUBSCRIBERS, []);
  },

  /* ---------- Contact messages ---------- */

  async sendMessage(message) {
    await delay();
    const list = readTable(DB_KEYS.MESSAGES, []);
    list.unshift({ id: uid('msg'), read: false, createdAt: Date.now(), ...message });
    writeTable(DB_KEYS.MESSAGES, list);
    return true;
  },

  async getMessages() {
    await delay();
    return readTable(DB_KEYS.MESSAGES, []);
  },

  /* ---------- Store settings ---------- */

  async getSettings() {
    await delay();
    return readTable(DB_KEYS.SETTINGS, DEFAULT_SETTINGS);
  },

  async updateSettings(patch) {
    await delay();
    const current = readTable(DB_KEYS.SETTINGS, DEFAULT_SETTINGS);
    const updated = { ...current, ...patch };
    writeTable(DB_KEYS.SETTINGS, updated);
    return updated;
  },

  /* ---------- Dashboard stats ---------- */

  async getDashboardStats() {
    await delay();
    const products = readTable(DB_KEYS.PRODUCTS, []);
    const orders = readTable(DB_KEYS.ORDERS, []);
    const users = readTable(DB_KEYS.USERS, []);
    const revenue = orders.reduce((sum, o) => sum + (o.total || 0), 0);
    return {
      totalProducts: products.length,
      totalOrders: orders.length,
      pendingOrders: orders.filter((o) => o.status !== 'Delivered' && o.status !== 'Cancelled').length,
      completedOrders: orders.filter((o) => o.status === 'Delivered').length,
      totalCustomers: users.length,
      revenue,
    };
  },
};
