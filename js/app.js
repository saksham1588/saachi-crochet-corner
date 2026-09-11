/* ============================================================
   Saachi Crochet Corner — Application Logic
   Hash-based SPA router + all page renderers + cart/wishlist/
   auth/admin flows. Talks only to the `api` object from data.js
   so a real backend can be swapped in without touching this file.
   ============================================================ */

/* ---------------------------------------------------------- */
/* Global state                                                */
/* ---------------------------------------------------------- */

const state = {
  session: readTable(DB_KEYS.SESSION, { user: null, admin: null }),
  cart: api.getCart(),
  wishlist: [],           // array of productId, for the logged-in user
  products: [],
  settings: null,
  adminTab: 'dashboard',
  adminEditingProductId: null,
  shopFilters: { category: 'All', search: '', sort: 'featured' },
  productGalleryIndex: 0,
  customOrderImage: null,
  hamperImage: null,
  reviewImage: null,
};

function saveSession() {
  writeTable(DB_KEYS.SESSION, state.session);
}

function isLoggedIn() { return !!state.session.user; }
function isAdmin() { return !!state.session.admin; }

/* ---------------------------------------------------------- */
/* Utilities                                                   */
/* ---------------------------------------------------------- */

function formatINR(n) {
  return '₹' + Number(n).toLocaleString('en-IN');
}

function formatDate(ts) {
  return new Date(ts).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatDateTime(ts) {
  return new Date(ts).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function escapeHtml(str = '') {
  return String(str).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function slugStatus(s) { return s.replace(/\s+/g, '-'); }

function qs(sel, root = document) { return root.querySelector(sel); }
function qsa(sel, root = document) { return Array.from(root.querySelectorAll(sel)); }

function toast(message) {
  const stack = qs('#toast-stack');
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = message;
  stack.appendChild(el);
  setTimeout(() => el.remove(), 2600);
}

function mount(html) { qs('#app-view').innerHTML = html; window.scrollTo({ top: 0, behavior: 'smooth' }); }
function overlay(html) { qs('#overlay-mount').innerHTML = html; }
function closeOverlay() { qs('#overlay-mount').innerHTML = ''; }

/* ---------------------------------------------------------- */
/* Illustration placeholders (hand-drawn style inline SVG)      */
/* ---------------------------------------------------------- */

function productArt(kind) {
  const arts = {
    clip: `<svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg"><rect width="200" height="200" fill="#F3D7DD"/><circle cx="100" cy="95" r="42" fill="#C97B8D"/><circle cx="100" cy="95" r="14" fill="#6E4335"/><path d="M60 150 Q100 135 140 150" stroke="#6E4335" stroke-width="4" fill="none" stroke-linecap="round"/></svg>`,
    bouquet: `<svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg"><rect width="200" height="200" fill="#ECDFC9"/><g><circle cx="80" cy="80" r="20" fill="#C97B8D"/><circle cx="120" cy="70" r="20" fill="#E3AAB8"/><circle cx="100" cy="110" r="20" fill="#C97B8D"/><circle cx="130" cy="110" r="16" fill="#E3AAB8"/><rect x="95" y="110" width="6" height="60" fill="#8A6F5E"/></g></svg>`,
    keychain: `<svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg"><rect width="200" height="200" fill="#F3D7DD"/><circle cx="100" cy="60" r="16" fill="none" stroke="#6E4335" stroke-width="5"/><path d="M100 76 L100 100" stroke="#6E4335" stroke-width="4"/><path d="M75 100 Q100 80 125 100 Q135 140 100 150 Q65 140 75 100Z" fill="#C97B8D"/></svg>`,
    charm: `<svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg"><rect width="200" height="200" fill="#ECDFC9"/><rect x="86" y="40" width="8" height="40" fill="#8A6F5E"/><g><rect x="70" y="80" width="26" height="26" rx="6" fill="#C97B8D"/><rect x="104" y="80" width="26" height="26" rx="6" fill="#E3AAB8"/><rect x="87" y="112" width="26" height="26" rx="6" fill="#C97B8D"/></g></svg>`,
    rakhi: `<svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg"><rect width="200" height="200" fill="#F3D7DD"/><circle cx="100" cy="90" r="36" fill="none" stroke="#C97B8D" stroke-width="10"/><circle cx="100" cy="90" r="12" fill="#6E4335"/><path d="M60 150 Q100 130 140 150" stroke="#8A6F5E" stroke-width="4" fill="none"/></svg>`,
    hamper: `<svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg"><rect width="200" height="200" fill="#ECDFC9"/><rect x="45" y="90" width="110" height="70" rx="8" fill="#C97B8D"/><rect x="45" y="90" width="110" height="18" fill="#A85F72"/><path d="M90 90 Q100 60 110 90" stroke="#6E4335" stroke-width="5" fill="none"/></svg>`,
    placeholder: `<svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg"><rect width="200" height="200" fill="#F3D7DD"/><circle cx="100" cy="100" r="34" fill="none" stroke="#C97B8D" stroke-width="8" stroke-dasharray="6 8"/><circle cx="100" cy="100" r="10" fill="#C97B8D"/></svg>`,
  };
  return arts[kind] || arts.placeholder;
}

function productThumb(product, className = 'product-thumb') {
  const img = product.images && product.images[0];
  const isDataUrl = img && img.startsWith('data:');
  return `<div class="${className}">${isDataUrl ? `<img src="${img}" alt="${escapeHtml(product.name)}"/>` : productArt(img)}</div>`;
}

/* ---------------------------------------------------------- */
/* Cart helpers                                                */
/* ---------------------------------------------------------- */

function cartCount() { return state.cart.reduce((s, i) => s + i.qty, 0); }

function persistCart() { api.saveCart(state.cart); updateHeaderBadges(); }

function addToCart(productId, qty = 1) {
  const line = state.cart.find((i) => i.productId === productId);
  if (line) line.qty += qty; else state.cart.push({ productId, qty });
  persistCart();
  toast('Added to cart 🧶');
}

function setCartQty(productId, qty) {
  const line = state.cart.find((i) => i.productId === productId);
  if (!line) return;
  if (qty <= 0) { state.cart = state.cart.filter((i) => i.productId !== productId); }
  else line.qty = qty;
  persistCart();
}

function removeFromCart(productId) {
  state.cart = state.cart.filter((i) => i.productId !== productId);
  persistCart();
  toast('Removed from cart');
}

async function cartLinesWithProducts() {
  const lines = [];
  for (const item of state.cart) {
    const p = await api.getProduct(item.productId);
    if (p) lines.push({ ...item, product: p });
  }
  return lines;
}

async function cartTotals() {
  const lines = await cartLinesWithProducts();
  const subtotal = lines.reduce((s, l) => s + l.product.price * l.qty, 0);
  const settings = state.settings || (await api.getSettings());
  const delivery = subtotal === 0 || subtotal >= settings.freeDeliveryAbove ? 0 : settings.deliveryCharge;
  return { lines, subtotal, delivery, total: subtotal + delivery };
}

/* ---------------------------------------------------------- */
/* Wishlist helpers                                            */
/* ---------------------------------------------------------- */

async function refreshWishlist() {
  if (!isLoggedIn()) { state.wishlist = []; return; }
  const rows = await api.getWishlist(state.session.user.id);
  state.wishlist = rows.map((r) => r.productId);
}

async function toggleWishlist(productId) {
  if (!isLoggedIn()) { openAuthModal('login'); toast('Please log in to save favourites'); return; }
  const nowActive = await api.toggleWishlist(state.session.user.id, productId);
  await refreshWishlist();
  updateHeaderBadges();
  toast(nowActive ? 'Added to wishlist ♡' : 'Removed from wishlist');
  qsa(`.wish-btn[data-id="${productId}"]`).forEach((b) => b.classList.toggle('active', nowActive));
}

/* ---------------------------------------------------------- */
/* Header behaviors                                            */
/* ---------------------------------------------------------- */

function updateHeaderBadges() {
  const cartBadge = qs('#cart-badge');
  const count = cartCount();
  cartBadge.textContent = count;
  cartBadge.classList.toggle('hidden', count === 0);

  const wishBadge = qs('#wishlist-badge');
  wishBadge.textContent = state.wishlist.length;
  wishBadge.classList.toggle('hidden', state.wishlist.length === 0);

  qsa('.main-nav a').forEach((a) => a.classList.toggle('active', a.dataset.route === currentPath().split('?')[0]));

  const label = qs('#account-label');
  if (label) label.textContent = isAdmin() ? 'Admin' : (isLoggedIn() ? state.session.user.fullName.split(' ')[0] : 'Login');
}

function currentPath() {
  return (location.hash || '#/').slice(1) || '/';
}

/* ---------------------------------------------------------- */
/* Router                                                       */
/* ---------------------------------------------------------- */

const routes = [
  { pattern: /^\/$/, view: renderHome },
  { pattern: /^\/shop$/, view: renderShop },
  { pattern: /^\/product\/([^/]+)$/, view: renderProductDetail },
  { pattern: /^\/custom-orders$/, view: renderCustomOrders },
  { pattern: /^\/gift-hampers$/, view: renderGiftHampers },
  { pattern: /^\/reviews$/, view: renderReviews },
  { pattern: /^\/track-order(?:\/([^/]+))?$/, view: renderTrackOrder },
  { pattern: /^\/contact$/, view: renderContact },
  { pattern: /^\/account$/, view: renderAccount },
  { pattern: /^\/checkout$/, view: renderCheckout },
  { pattern: /^\/order-success\/([^/]+)$/, view: renderOrderSuccess },
  { pattern: /^\/admin\/login$/, view: renderAdminLogin },
  { pattern: /^\/admin\/dashboard$/, view: renderAdminDashboard },
];

async function router() {
  closeOverlay();
  const fullPath = currentPath();
  const path = fullPath.split('?')[0];
  updateHeaderBadges();
  const match = routes.find((r) => r.pattern.test(path));
  if (!match) { mount(render404()); return; }
  const params = path.match(match.pattern).slice(1);
  try {
    await match.view(...params);
  } catch (err) {
    console.error(err);
    mount(`<div class="container empty-state"><span class="emoji">😿</span><p>Something went wrong loading this page.</p></div>`);
  }
  updateHeaderBadges();
}

function render404() {
  return `<div class="container empty-state"><span class="emoji">🧶</span><h2>This loop got dropped</h2><p>We couldn't find that page.</p><a href="#/" class="btn btn-primary" data-link>Back Home</a></div>`;
}

function navigate(path) { location.hash = '#' + path; }

/* ---------------------------------------------------------- */
/* Shared: nav bar chips / product card partial                */
/* ---------------------------------------------------------- */

function productCard(p) {
  const wished = state.wishlist.includes(p.id);
  const tag = p.newArrival ? 'New' : (p.featured ? 'Featured' : '');
  return `
  <div class="product-card">
    <a href="#/product/${p.id}" data-link>
      ${productThumb(p)}
    </a>
    ${tag ? `<span class="product-tag">${tag}</span>` : ''}
    <button class="wish-btn ${wished ? 'active' : ''}" data-id="${p.id}" data-action="wish" aria-label="Wishlist">${wished ? '❤️' : '🤍'}</button>
    <div class="product-body">
      <a href="#/product/${p.id}" data-link style="color:inherit">
        <div class="product-cat">${escapeHtml(p.category)}</div>
        <div class="product-name">${escapeHtml(p.name)}</div>
      </a>
      <div class="product-price">${formatINR(p.price)}</div>
      ${p.stock === 0 ? '<div class="stock-out">Out of stock</div>' : (p.stock <= 3 ? `<div class="stock-low">Only ${p.stock} left</div>` : '')}
    </div>
    <div class="product-foot">
      <button class="btn btn-primary btn-sm btn-block" data-action="add-cart" data-id="${p.id}" ${p.stock === 0 ? 'disabled' : ''}>Add to Cart</button>
    </div>
  </div>`;
}

/* ---------------------------------------------------------- */
/* HOME                                                        */
/* ---------------------------------------------------------- */

async function renderHome() {
  mount(`<div class="skeleton" style="height:400px;margin:20px"></div>`);
  const [featured, newArrivals, reviews] = await Promise.all([
    api.getProducts({ featuredOnly: true }),
    api.getProducts({ newOnly: true }),
    api.getApprovedReviews(),
  ]);

  const categories = [
    { name: 'Rakhis', emoji: '🧵' }, { name: 'Crochet Flowers', emoji: '🌸' },
    { name: 'Hair Accessories', emoji: '🎀' }, { name: 'Keychains', emoji: '🔑' },
    { name: 'Phone Charms', emoji: '📱' }, { name: 'Gift Hampers', emoji: '🎁' },
    { name: 'Custom Orders', emoji: '✨' },
  ];

  mount(`
  <section class="hero">
    <div class="container hero-grid">
      <div>
        <span class="hero-eyebrow-tag">🧶 Handmade in small batches</span>
        <h1>Little loops,<br/><em>big love.</em></h1>
        <p class="lead">Sweet crochet treasures, flowers and thoughtful gifts — lovingly made one stitch at a time.</p>
        <div class="hero-btns">
          <a href="#/shop" class="btn btn-primary" data-link>Shop Collection</a>
          <a href="#/custom-orders" class="btn btn-outline" data-link>Create a Custom Order</a>
        </div>
      </div>
      <div class="hero-art">
        <svg viewBox="0 0 320 320" xmlns="http://www.w3.org/2000/svg">
          <circle cx="160" cy="160" r="150" fill="#F3D7DD"/>
          <circle cx="120" cy="150" r="50" fill="#C97B8D"/>
          <circle cx="120" cy="150" r="16" fill="#6E4335"/>
          <circle cx="205" cy="120" r="34" fill="#E3AAB8"/>
          <circle cx="205" cy="200" r="30" fill="#ECDFC9" stroke="#C97B8D" stroke-width="6"/>
          <path d="M80 240 Q160 270 240 240" stroke="#6E4335" stroke-width="4" fill="none" stroke-linecap="round" stroke-dasharray="2 10"/>
        </svg>
      </div>
    </div>
  </section>

  <section class="section">
    <div class="container">
      <div class="section-head"><div><h2>Featured Favourites</h2><p>The pieces our little shop is best known for.</p></div>
      <a href="#/shop" data-link class="btn btn-ghost btn-sm">View all →</a></div>
      <div class="product-grid" id="home-featured">${featured.length ? featured.map(productCard).join('') : emptyRow('No featured products yet.')}</div>
    </div>
  </section>

  <section class="section section-alt">
    <div class="container">
      <div class="section-head"><div><h2>New Arrivals</h2><p>Fresh off the hook this month.</p></div></div>
      <div class="product-grid" id="home-new">${newArrivals.length ? newArrivals.map(productCard).join('') : emptyRow('New pieces are on the way — check back soon!')}</div>
    </div>
  </section>

  <section class="section">
    <div class="container">
      <div class="section-head"><div><h2>Shop by Category</h2><p>Find exactly the little something you're after.</p></div></div>
      <div class="cat-grid">
        ${categories.map((c) => `
          <a class="cat-card" href="#/${c.name === 'Custom Orders' ? 'custom-orders' : c.name === 'Gift Hampers' ? 'gift-hampers' : 'shop'}${c.name !== 'Custom Orders' && c.name !== 'Gift Hampers' ? `?category=${encodeURIComponent(c.name)}` : ''}" data-link>
            <span class="cat-emoji">${c.emoji}</span><span class="cat-name">${c.name}</span>
          </a>`).join('')}
      </div>
    </div>
  </section>

  <section class="section section-alt">
    <div class="container">
      <div class="section-head"><div><h2>Why Choose Us</h2></div></div>
      <div class="why-grid">
        <div class="why-card"><span class="emoji">🧶</span><h4>Handmade</h4><p>Every piece stitched by hand, never mass-produced.</p></div>
        <div class="why-card"><span class="emoji">🎨</span><h4>Customizable</h4><p>Pick your own colours, sizes and little details.</p></div>
        <div class="why-card"><span class="emoji">🎁</span><h4>Gift Ready</h4><p>Thoughtfully packaged and ready to hand over.</p></div>
        <div class="why-card"><span class="emoji">♡</span><h4>Made With Love</h4><p>Small-batch, slow-made, from our hands to yours.</p></div>
      </div>
    </div>
  </section>

  ${reviews.length ? `
  <section class="section">
    <div class="container">
      <div class="section-head"><div><h2>What Customers Say</h2></div>
      <a href="#/reviews" data-link class="btn btn-ghost btn-sm">See all reviews →</a></div>
      <div class="review-grid">
        ${reviews.slice(0, 3).map(reviewCard).join('')}
      </div>
    </div>
  </section>` : ''}

  <section class="section section-alt">
    <div class="container">
      <div class="insta-banner">
        <h3>Follow along on Instagram</h3>
        <p class="insta-handle">@saachi_crrochet.corner</p>
        <a href="https://instagram.com/saachi_crrochet.corner" target="_blank" rel="noopener" class="btn btn-primary">Follow on Instagram</a>
      </div>
    </div>
  </section>

  <section class="section">
    <div class="container">
      <div class="newsletter">
        <h3>Be the first to know about our new handmade collections.</h3>
        <p>No spam — just sweet new arrivals, sometimes.</p>
        <form class="newsletter-form" id="newsletter-form">
          <input type="email" placeholder="you@example.com" required id="newsletter-email"/>
          <button class="btn btn-primary" type="submit">Subscribe</button>
        </form>
      </div>
    </div>
  </section>
  `);

  qs('#newsletter-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = qs('#newsletter-email').value.trim();
    const res = await api.subscribe(email);
    toast(res.alreadySubscribed ? "You're already on the list ♡" : 'Subscribed! Watch your inbox ♡');
    e.target.reset();
  });
}

function emptyRow(msg) {
  return `<div class="empty-state" style="grid-column:1/-1"><span class="emoji">🧶</span><p>${msg}</p></div>`;
}

function reviewCard(r) {
  return `<div class="review-card">
    <div class="stars">${'★'.repeat(r.rating)}${'☆'.repeat(5 - r.rating)}</div>
    <p>"${escapeHtml(r.text)}"</p>
    <div class="review-name">— ${escapeHtml(r.name)}</div>
  </div>`;
}

/* ---------------------------------------------------------- */
/* SHOP                                                         */
/* ---------------------------------------------------------- */

async function renderShop() {
  const hash = location.hash.split('?')[1] || '';
  const params = new URLSearchParams(hash);
  if (params.get('category')) state.shopFilters.category = params.get('category');

  mount(shopShell());
  await refreshShopResults();

  qsa('.chip[data-cat]').forEach((chip) => chip.addEventListener('click', () => {
    state.shopFilters.category = chip.dataset.cat;
    refreshShopResults();
  }));
  qs('#shop-search').addEventListener('input', debounce((e) => {
    state.shopFilters.search = e.target.value;
    refreshShopResults();
  }, 250));
  qs('#shop-sort').addEventListener('change', (e) => {
    state.shopFilters.sort = e.target.value;
    refreshShopResults();
  });
}

function shopShell() {
  const cats = ['All', 'Rakhis', 'Crochet Flowers', 'Hair Accessories', 'Keychains', 'Phone Charms', 'Gift Hampers', 'Custom'];
  return `
  <div class="page-hero container">
    <h1>Shop the Collection</h1>
    <p>Every piece handmade to order — browse, favourite, and find your perfect little thing.</p>
  </div>
  <div class="container">
    <div class="filter-bar">
      <div class="search-box"><input id="shop-search" type="text" placeholder="Search products..." value="${escapeHtml(state.shopFilters.search)}"/></div>
      <select id="shop-sort" class="sort-select">
        <option value="featured" ${state.shopFilters.sort === 'featured' ? 'selected' : ''}>Featured</option>
        <option value="newest" ${state.shopFilters.sort === 'newest' ? 'selected' : ''}>Newest</option>
        <option value="price-asc" ${state.shopFilters.sort === 'price-asc' ? 'selected' : ''}>Price: Low to High</option>
        <option value="price-desc" ${state.shopFilters.sort === 'price-desc' ? 'selected' : ''}>Price: High to Low</option>
      </select>
    </div>
    <div class="filter-bar">
      ${cats.map((c) => `<button class="chip ${state.shopFilters.category === c ? 'active' : ''}" data-cat="${c}">${c}</button>`).join('')}
    </div>
    <div class="product-grid" id="shop-results"><div class="skeleton" style="height:260px"></div></div>
  </div>`;
}

async function refreshShopResults() {
  qsa('.chip[data-cat]').forEach((c) => c.classList.toggle('active', c.dataset.cat === state.shopFilters.category));
  qs('#shop-sort').value = state.shopFilters.sort;
  const items = await api.getProducts({
    category: state.shopFilters.category,
    search: state.shopFilters.search,
    sort: state.shopFilters.sort === 'featured' ? null : state.shopFilters.sort,
    featuredOnly: state.shopFilters.sort === 'featured' ? false : false,
  });
  let list = items;
  if (state.shopFilters.sort === 'featured') {
    list = list.slice().sort((a, b) => (b.featured === a.featured) ? 0 : (b.featured ? 1 : -1));
  }
  qs('#shop-results').innerHTML = list.length ? list.map(productCard).join('') : emptyRow('No products match your search yet.');
}

function debounce(fn, ms) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}

/* ---------------------------------------------------------- */
/* PRODUCT DETAIL                                               */
/* ---------------------------------------------------------- */

async function renderProductDetail(id) {
  mount(`<div class="container"><div class="skeleton" style="height:500px"></div></div>`);
  const p = await api.getProduct(id);
  if (!p) { mount(`<div class="container empty-state"><span class="emoji">🧶</span><p>That product could not be found.</p></div>`); return; }
  state.productGalleryIndex = 0;
  const wished = state.wishlist.includes(p.id);

  mount(`
  <div class="container" style="padding-top:24px">
    <div class="breadcrumb"><a href="#/shop" data-link>Shop</a> / ${escapeHtml(p.category)} / ${escapeHtml(p.name)}</div>
    <div class="pd-grid">
      <div>
        <div class="pd-gallery-main" id="pd-main">${galleryFrame(p, 0)}</div>
        ${p.images.length > 1 ? `<div class="pd-thumbs">${p.images.map((img, i) => `<button class="pd-thumb ${i === 0 ? 'active' : ''}" data-idx="${i}">${img.startsWith('data:') ? `<img src="${img}"/>` : productArt(img)}</button>`).join('')}</div>` : ''}
      </div>
      <div>
        <div class="product-cat">${escapeHtml(p.category)}</div>
        <h1>${escapeHtml(p.name)}</h1>
        <div class="pd-price-row"><span class="pd-price">${formatINR(p.price)}</span></div>
        <p>${escapeHtml(p.description)}</p>
        <div class="pd-meta">
          <div class="pd-meta-item"><b>${p.available && p.stock > 0 ? 'In Stock' : 'Out of Stock'}</b>Availability</div>
          <div class="pd-meta-item"><b>${escapeHtml(p.category)}</b>Category</div>
          <div class="pd-meta-item"><b>100% Handmade</b>Crafted to order</div>
        </div>
        <div class="field" style="max-width:160px">
          <label>Quantity</label>
          <div class="qty-control">
            <button id="pd-minus" type="button">–</button><span id="pd-qty">1</span><button id="pd-plus" type="button">+</button>
          </div>
        </div>
        <div class="pd-actions">
          <button class="btn btn-primary" id="pd-add-cart" ${p.stock === 0 ? 'disabled' : ''}>Add to Cart</button>
          <button class="btn btn-outline" id="pd-buy-now" ${p.stock === 0 ? 'disabled' : ''}>Buy Now</button>
          <button class="btn btn-ghost" id="pd-wish">${wished ? '❤️ Saved' : '🤍 Wishlist'}</button>
        </div>
      </div>
    </div>
  </div>`);

  let qty = 1;
  qs('#pd-minus').addEventListener('click', () => { qty = Math.max(1, qty - 1); qs('#pd-qty').textContent = qty; });
  qs('#pd-plus').addEventListener('click', () => { qty = Math.min(p.stock || 1, qty + 1); qs('#pd-qty').textContent = qty; });
  qs('#pd-add-cart').addEventListener('click', () => addToCart(p.id, qty));
  qs('#pd-buy-now').addEventListener('click', () => { addToCart(p.id, qty); navigate('/checkout'); });
  qs('#pd-wish').addEventListener('click', async () => { await toggleWishlist(p.id); renderProductDetail(id); });
  qsa('.pd-thumb').forEach((btn) => btn.addEventListener('click', () => {
    qsa('.pd-thumb').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    qs('#pd-main').innerHTML = galleryFrame(p, Number(btn.dataset.idx));
  }));
}

function galleryFrame(p, idx) {
  const img = p.images[idx];
  return img.startsWith('data:') ? `<img src="${img}" alt="${escapeHtml(p.name)}"/>` : productArt(img);
}

/* ---------------------------------------------------------- */
/* CUSTOM ORDERS                                                */
/* ---------------------------------------------------------- */

function renderCustomOrders() {
  mount(`
  <div class="page-hero container">
    <h1>Custom Crochet Orders</h1>
    <p>Tell us what you're dreaming of — colours, size, occasion — and we'll stitch it just for you.</p>
  </div>
  <div class="container" style="max-width:640px;padding-bottom:60px">
    <form id="custom-order-form" class="form-card">
      <div class="field-row">
        <div class="field"><label>Full Name *</label><input required id="co-name" type="text"/></div>
        <div class="field"><label>Email *</label><input required id="co-email" type="email"/></div>
      </div>
      <div class="field-row">
        <div class="field"><label>Phone *</label><input required id="co-phone" type="tel"/></div>
        <div class="field"><label>Product Type *</label>
          <select required id="co-product">
            <option value="">Select...</option>
            <option>Rakhi</option><option>Crochet Flower</option><option>Hair Accessory</option>
            <option>Keychain</option><option>Phone Charm</option><option>Gift Hamper</option><option>Other</option>
          </select>
        </div>
      </div>
      <div class="field-row">
        <div class="field"><label>Colour(s) *</label><input required id="co-colour" type="text" placeholder="e.g. blush pink, cream"/></div>
        <div class="field"><label>Size</label><input id="co-size" type="text" placeholder="e.g. small, 3 inch"/></div>
      </div>
      <div class="field-row">
        <div class="field"><label>Quantity *</label><input required id="co-qty" type="number" min="1" value="1"/></div>
        <div class="field"><label>Budget (₹)</label><input id="co-budget" type="number" min="0" placeholder="Optional"/></div>
      </div>
      <div class="field">
        <label>Special Instructions</label>
        <textarea id="co-desc" placeholder="Anything else we should know?"></textarea>
      </div>
      <div class="field">
        <label>Reference Photo (optional)</label>
        <input id="co-image" type="file" accept="image/*"/>
        <div class="field-hint">Max 3MB. Helps us match your vision exactly.</div>
        <div class="preview-strip" id="co-preview"></div>
      </div>
      <button type="submit" class="btn btn-primary btn-block">Send Custom Request ✨</button>
    </form>
  </div>`);

  state.customOrderImage = null;
  qs('#co-image').addEventListener('change', (e) => handleImagePreview(e, '#co-preview', (dataUrl) => { state.customOrderImage = dataUrl; }));

  qs('#custom-order-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector('button[type=submit]');
    btn.disabled = true; btn.textContent = 'Sending...';
    try {
      await api.createCustomOrder({
        name: qs('#co-name').value, email: qs('#co-email').value, phone: qs('#co-phone').value,
        product: qs('#co-product').value, colour: qs('#co-colour').value, size: qs('#co-size').value,
        quantity: Number(qs('#co-qty').value), budget: qs('#co-budget').value, description: qs('#co-desc').value,
        referenceImage: state.customOrderImage, userId: state.session.user ? state.session.user.id : null,
      });
      mount(`<div class="container confirm-box" style="padding:70px 20px"><div class="big-emoji">✨</div><h2>Your custom request has been sent!</h2><p>We'll reach out over email or Instagram DM to confirm the details and a quote.</p><a href="#/shop" class="btn btn-primary" data-link>Continue Browsing</a></div>`);
    } catch (err) {
      toast(err.message || 'Something went wrong');
      btn.disabled = false; btn.textContent = 'Send Custom Request ✨';
    }
  });
}

function handleImagePreview(e, previewSel, onLoaded) {
  const file = e.target.files[0];
  if (!file) return;
  if (!file.type.startsWith('image/')) { toast('Please upload an image file'); e.target.value = ''; return; }
  if (file.size > 3 * 1024 * 1024) { toast('Image must be under 3MB'); e.target.value = ''; return; }
  const reader = new FileReader();
  reader.onload = () => {
    onLoaded(reader.result);
    qs(previewSel).innerHTML = `<div class="preview-thumb"><img src="${reader.result}"/></div>`;
  };
  reader.readAsDataURL(file);
}

/* ---------------------------------------------------------- */
/* GIFT HAMPERS                                                 */
/* ---------------------------------------------------------- */

async function renderGiftHampers() {
  const hampers = await api.getProducts({ category: 'Gift Hampers' });
  mount(`
  <div class="page-hero container">
    <h1>Gift Hampers</h1>
    <p>Ready-made or fully custom — a little bundle of handmade joy for someone you love.</p>
  </div>
  <div class="container">
    <div class="section-head"><div><h2>Ready-Made Hampers</h2></div></div>
    <div class="product-grid">${hampers.length ? hampers.map(productCard).join('') : emptyRow('New hampers coming soon.')}</div>
  </div>
  <div class="container section-alt" style="border-radius:26px;margin:40px auto;padding:40px 20px">
    <div class="section-head"><div><h2>Build a Custom Hamper</h2><p>Tell us the vibe and we'll curate it.</p></div></div>
    <form id="hamper-form" class="form-card" style="max-width:640px;margin:0 auto">
      <div class="field-row">
        <div class="field"><label>Full Name *</label><input required id="h-name" type="text"/></div>
        <div class="field"><label>Email *</label><input required id="h-email" type="email"/></div>
      </div>
      <div class="field-row">
        <div class="field"><label>Phone *</label><input required id="h-phone" type="tel"/></div>
        <div class="field"><label>Budget (₹) *</label><input required id="h-budget" type="number" min="0"/></div>
      </div>
      <div class="field-row">
        <div class="field"><label>Theme</label><input id="h-theme" type="text" placeholder="e.g. birthday, rakhi, thank you"/></div>
        <div class="field"><label>Preferred Colours</label><input id="h-colours" type="text"/></div>
      </div>
      <div class="field"><label>Which products would you like inside?</label><textarea id="h-products" placeholder="e.g. 2 keychains, 1 mini bouquet, 1 phone charm"></textarea></div>
      <div class="field"><label>Message/Card Text</label><textarea id="h-message" placeholder="What should the gift card say?"></textarea></div>
      <button type="submit" class="btn btn-primary btn-block">Send Hamper Request ✨</button>
    </form>
  </div>`);

  qs('#hamper-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    await api.createHamperRequest({
      name: qs('#h-name').value, email: qs('#h-email').value, phone: qs('#h-phone').value,
      budget: qs('#h-budget').value, theme: qs('#h-theme').value, colours: qs('#h-colours').value,
      products: qs('#h-products').value, message: qs('#h-message').value,
    });
    toast('Hamper request sent ♡ We will follow up shortly!');
    e.target.reset();
  });
}

/* ---------------------------------------------------------- */
/* REVIEWS                                                       */
/* ---------------------------------------------------------- */

async function renderReviews() {
  const reviews = await api.getApprovedReviews();
  mount(`
  <div class="page-hero container">
    <h1>Customer Reviews</h1>
    <p>Real words from our little handmade family.</p>
  </div>
  <div class="container">
    <div class="review-grid" style="margin-bottom:40px">${reviews.length ? reviews.map(reviewCard).join('') : emptyRow('Be the first to leave a review!')}</div>
    <div class="form-card" style="max-width:560px;margin:0 auto 60px">
      <h3>Share Your Experience</h3>
      <form id="review-form">
        <div class="field"><label>Your Name *</label><input required id="rv-name" type="text"/></div>
        <div class="field"><label>Rating *</label>
          <select required id="rv-rating">
            <option value="5">★★★★★ Excellent</option>
            <option value="4">★★★★☆ Great</option>
            <option value="3">★★★☆☆ Good</option>
            <option value="2">★★☆☆☆ Okay</option>
            <option value="1">★☆☆☆☆ Poor</option>
          </select>
        </div>
        <div class="field"><label>Your Review *</label><textarea required id="rv-text"></textarea></div>
        <div class="field"><label>Photo (optional)</label><input id="rv-image" type="file" accept="image/*"/><div class="preview-strip" id="rv-preview"></div></div>
        <button type="submit" class="btn btn-primary btn-block">Submit Review</button>
        <div class="field-hint" style="text-align:center;margin-top:10px">Reviews are checked before appearing publicly.</div>
      </form>
    </div>
  </div>`);

  state.reviewImage = null;
  qs('#rv-image').addEventListener('change', (e) => handleImagePreview(e, '#rv-preview', (d) => state.reviewImage = d));
  qs('#review-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    await api.submitReview({ name: qs('#rv-name').value, rating: Number(qs('#rv-rating').value), text: qs('#rv-text').value, image: state.reviewImage });
    toast('Thank you! Your review is awaiting approval ♡');
    e.target.reset(); qs('#rv-preview').innerHTML = '';
  });
}

/* ---------------------------------------------------------- */
/* TRACK ORDER                                                  */
/* ---------------------------------------------------------- */

async function renderTrackOrder(prefillId) {
  mount(`
  <div class="page-hero container">
    <h1>Track Your Order</h1>
    <p>Enter your Order ID to see exactly where your handmade goodies are.</p>
  </div>
  <div class="container" style="max-width:520px">
    <form id="track-form" class="form-card">
      <div class="field"><label>Order ID</label><input id="track-id" type="text" placeholder="e.g. SC2026001234" value="${prefillId ? escapeHtml(prefillId) : ''}" required/></div>
      <button class="btn btn-primary btn-block" type="submit">Track Order</button>
    </form>
    <div id="track-result" style="margin-top:26px"></div>
  </div>`);

  qs('#track-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = qs('#track-id').value.trim();
    const order = await api.getOrder(id);
    qs('#track-result').innerHTML = order ? orderTrackingCard(order) : `<div class="empty-state"><span class="emoji">🔎</span><p>No order found with that ID. Double check and try again.</p></div>`;
  });

  if (prefillId) {
    qs('#track-form').dispatchEvent(new Event('submit', { cancelable: true }));
  }
}

function orderTrackingCard(order) {
  const idx = ORDER_STATUSES.indexOf(order.status);
  const cancelled = order.status === 'Cancelled';
  return `
  <div class="admin-card">
    <div class="row-between"><b>Order ${order.id}</b><span class="status-pill status-${slugStatus(order.status)}">${order.status}</span></div>
    <div class="field-hint">Placed on ${formatDate(order.createdAt)}${order.estimatedDelivery ? ` · Estimated delivery: ${escapeHtml(order.estimatedDelivery)}` : ''}</div>
    ${cancelled ? '<p style="margin-top:16px">This order was cancelled. Please contact us if this is unexpected.</p>' : `
    <div class="timeline">
      ${ORDER_STATUSES.map((s, i) => `
        <div class="timeline-step ${i < idx ? 'done' : ''} ${i === idx ? 'current' : ''}">
          ${i < ORDER_STATUSES.length - 1 ? '<div class="timeline-line"></div>' : ''}
          <div class="timeline-dot">${i <= idx ? '✓' : ''}</div>
          <div><div class="timeline-label">${s}</div>${(order.statusHistory.find((h) => h.status === s)) ? `<div class="timeline-time">${formatDateTime(order.statusHistory.find((h) => h.status === s).at)}</div>` : ''}</div>
        </div>`).join('')}
    </div>`}
    <div class="row-between" style="margin-top:10px"><span>Items</span><span>${order.items.length}</span></div>
    <div class="row-between"><span>Total</span><b>${formatINR(order.total)}</b></div>
  </div>`;
}

/* ---------------------------------------------------------- */
/* CONTACT                                                       */
/* ---------------------------------------------------------- */

function renderContact() {
  mount(`
  <div class="page-hero container">
    <h1>Get In Touch</h1>
    <p>Questions, custom ideas, or just want to say hi? We'd love to hear from you.</p>
  </div>
  <div class="container two-col" style="padding-bottom:60px">
    <div class="form-card">
      <h3>Send a Message</h3>
      <form id="contact-form">
        <div class="field"><label>Name *</label><input required id="ct-name" type="text"/></div>
        <div class="field"><label>Email *</label><input required id="ct-email" type="email"/></div>
        <div class="field"><label>Phone</label><input id="ct-phone" type="tel"/></div>
        <div class="field"><label>Message *</label><textarea required id="ct-message"></textarea></div>
        <button class="btn btn-primary btn-block" type="submit">Send Message</button>
      </form>
    </div>
    <div class="form-card">
      <h3>Reach Us Directly</h3>
      <p>📧 sachigandhi935@gmail.com</p>
      <p>📸 @saachi_crrochet.corner</p>
      <a href="https://instagram.com/saachi_crrochet.corner" target="_blank" rel="noopener" class="btn btn-outline btn-block">DM to Order</a>
    </div>
  </div>`);

  qs('#contact-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    await api.sendMessage({ name: qs('#ct-name').value, email: qs('#ct-email').value, phone: qs('#ct-phone').value, message: qs('#ct-message').value });
    toast('Message sent — we will reply soon ♡');
    e.target.reset();
  });
}

/* ---------------------------------------------------------- */
/* ACCOUNT                                                       */
/* ---------------------------------------------------------- */

async function renderAccount() {
  if (!isLoggedIn()) {
    mount(`<div class="container empty-state"><span class="emoji">👤</span><h2>Log in to view your account</h2><p>Track orders, save favourites and store your addresses.</p><button class="btn btn-primary" id="acc-login-btn">Login / Sign Up</button></div>`);
    qs('#acc-login-btn').addEventListener('click', () => openAuthModal('login'));
    return;
  }
  const user = state.session.user;
  const [orders, wishlistRows] = await Promise.all([api.getOrdersByUser(user.id), api.getWishlist(user.id)]);
  const wishProducts = await Promise.all(wishlistRows.map((w) => api.getProduct(w.productId)));

  mount(`
  <div class="page-hero container"><h1>My Account</h1><p>Welcome back, ${escapeHtml(user.fullName)} ♡</p></div>
  <div class="container" style="padding-bottom:60px">
    <div class="admin-card">
      <h3>Profile</h3>
      <p><b>Name:</b> ${escapeHtml(user.fullName)}</p>
      <p><b>Email:</b> ${escapeHtml(user.email)}</p>
      <p><b>Phone:</b> ${escapeHtml(user.phone || '—')}</p>
      <button class="btn btn-outline btn-sm" id="acc-logout">Logout</button>
    </div>

    <div class="admin-card">
      <h3>My Orders</h3>
      ${orders.length ? `<table class="data-table"><thead><tr><th>Order ID</th><th>Date</th><th>Items</th><th>Total</th><th>Status</th><th></th></tr></thead><tbody>
        ${orders.map((o) => `<tr><td>${o.id}</td><td>${formatDate(o.createdAt)}</td><td>${o.items.length}</td><td>${formatINR(o.total)}</td><td><span class="status-pill status-${slugStatus(o.status)}">${o.status}</span></td><td><a href="#/track-order/${o.id}" data-link class="btn btn-ghost btn-sm">Track</a></td></tr>`).join('')}
      </tbody></table>` : `<p class="center-note">No orders yet — <a href="#/shop" data-link>start shopping</a>.</p>`}
    </div>

    <div class="admin-card">
      <h3>My Wishlist</h3>
      ${wishProducts.filter(Boolean).length ? `<div class="product-grid">${wishProducts.filter(Boolean).map(productCard).join('')}</div>` : `<p class="center-note">Nothing saved yet — tap the ❤️ on any product.</p>`}
    </div>

    <div class="admin-card">
      <h3>Saved Addresses</h3>
      <div id="acc-addresses">${(user.addresses || []).length ? user.addresses.map((a) => `<p>${escapeHtml(a.fullName)}, ${escapeHtml(a.address)}, ${escapeHtml(a.city)}, ${escapeHtml(a.state)} - ${escapeHtml(a.pin)}</p>`).join('') : '<p class="center-note">No saved addresses yet. Addresses are saved automatically at checkout.</p>'}</div>
    </div>
  </div>`);

  qs('#acc-logout').addEventListener('click', () => {
    state.session.user = null; saveSession(); state.wishlist = [];
    toast('Logged out'); navigate('/');
  });
}

/* ---------------------------------------------------------- */
/* CHECKOUT                                                      */
/* ---------------------------------------------------------- */

function openPaymentPortal({ total, customer, settings, onSuccess }) {
  const upiLink = `upi://pay?pa=${encodeURIComponent(settings.upiId)}&pn=${encodeURIComponent('Saachi Crochet Corner')}&am=${encodeURIComponent(total.toFixed(2))}&cu=INR`;
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(upiLink)}`;

  overlay(`
  <div class="modal-overlay" id="payment-overlay">
    <div class="modal modal-wide">
      <button class="modal-close" id="payment-close" aria-label="Close payment portal">✕</button>
      <h2>Choose a payment method</h2>
      <p>Amount to pay: <strong>${formatINR(total)}</strong></p>
      <div class="hero-btns" style="margin:18px 0;flex-wrap:wrap">
        <button class="btn btn-primary" id="pay-card">Credit Card</button>
        <button class="btn btn-primary" id="pay-debit-card">Debit Card</button>
        <button class="btn btn-primary" id="pay-upi">UPI via Google Pay</button>
      </div>
      <div class="upi-box" style="text-align:center">
        <h3>Scan to pay with UPI</h3>
        <img src="${qrUrl}" alt="UPI payment QR code" width="220" height="220" style="max-width:100%;background:#fff;padding:8px;border-radius:8px" />
        <p><strong>${escapeHtml(settings.upiId)}</strong></p>
        ${settings.bankAccountNumber ? `<p style="font-size:0.85rem">Bank account number: ${escapeHtml(settings.bankAccountNumber)}</p>` : ''}
      </div>
      <p class="field-hint">Cards use Razorpay Checkout. UPI opens Google Pay when available. Card details are never stored on this website.</p>
    </div>
  </div>`);

  qs('#payment-close').addEventListener('click', closeOverlay);
  qs('#payment-overlay').addEventListener('click', (e) => { if (e.target.id === 'payment-overlay') closeOverlay(); });

  const openRazorpay = (method) => {
    if (!settings.razorpayKeyId) {
      toast('Card payments are not configured yet. Add the Razorpay Key ID in Admin → Payment Settings.');
      return;
    }
    if (!window.Razorpay) {
      toast('Payment service could not be loaded. Please try again.');
      return;
    }
    const checkout = new window.Razorpay({
      key: settings.razorpayKeyId,
      amount: Math.round(total * 100), currency: 'INR',
      name: 'Saachi Crochet Corner', description: 'Crochet order payment',
      prefill: { name: customer.name, email: customer.email, contact: customer.phone },
      notes: { payment_method_requested: method },
      theme: { color: '#c97b8d' },
      handler: (response) => onSuccess({ paymentStatus: 'Paid', paymentId: response.razorpay_payment_id, paymentMethod: method }),
    });
    checkout.on('payment.failed', () => toast('Payment failed or was cancelled. Please try again.'));
    checkout.open();
  };

  qs('#pay-card').addEventListener('click', () => openRazorpay('Credit Card'));
  qs('#pay-debit-card').addEventListener('click', () => openRazorpay('Debit Card'));
  let upiStarted = false;
  qs('#pay-upi').addEventListener('click', () => {
    if (upiStarted) {
      onSuccess({ paymentStatus: 'Pending Confirmation', paymentMethod: 'Google Pay UPI' });
      return;
    }
    upiStarted = true;
    qs('#pay-upi').textContent = 'I have paid - continue';
    window.location.href = `tez://upi/pay?pa=${encodeURIComponent(settings.upiId)}&pn=${encodeURIComponent('Saachi Crochet Corner')}&am=${encodeURIComponent(total.toFixed(2))}&cu=INR`;
    window.setTimeout(() => {
      if (document.visibilityState === 'visible') window.location.href = upiLink;
    }, 1200);
  });
}

async function renderCheckout() {
  const { lines, subtotal, delivery, total } = await cartTotals();
  if (!lines.length) {
    mount(`<div class="container empty-state"><span class="emoji">🛒</span><h2>Your cart is empty</h2><a href="#/shop" class="btn btn-primary" data-link>Browse the Shop</a></div>`);
    return;
  }
  state.settings = await api.getSettings();
  const u = state.session.user;

  mount(`
  <div class="page-hero container"><h1>Checkout</h1><p>Almost there — just a few details.</p></div>
  <div class="container" style="padding-bottom:60px">
    ${!isLoggedIn() ? `<div class="info-note" style="margin-bottom:20px">Checking out as a guest. <button id="co-login-link" style="background:none;border:none;color:var(--rose-dark);font-weight:700;text-decoration:underline;cursor:pointer">Log in</button> to save this order to your account.</div>` : ''}
    <div class="checkout-grid">
      <form class="form-card" id="checkout-form">
        <h3>Delivery Details</h3>
        <div class="field-row">
          <div class="field"><label>Full Name *</label><input required id="ch-name" value="${escapeHtml(u ? u.fullName : '')}"/></div>
          <div class="field"><label>Phone *</label><input required id="ch-phone" value="${escapeHtml(u ? u.phone || '' : '')}"/></div>
        </div>
        <div class="field"><label>Email *</label><input required type="email" id="ch-email" value="${escapeHtml(u ? u.email : '')}"/></div>
        <div class="field"><label>Address *</label><textarea required id="ch-address" placeholder="House no, street, area"></textarea></div>
        <div class="field-row">
          <div class="field"><label>City *</label><input required id="ch-city"/></div>
          <div class="field"><label>State *</label><input required id="ch-state"/></div>
        </div>
        <div class="field"><label>PIN Code *</label><input required id="ch-pin" pattern="[0-9]{6}" maxlength="6"/></div>

        <h3 style="margin-top:20px">Payment</h3>
        <div class="upi-box">
          <p style="margin:0">Pay via Google Pay / UPI to:</p>
          <code>${escapeHtml(state.settings.upiId)}</code>
          ${state.settings.bankAccountNumber ? `<p style="margin:10px 0 0">Bank account number: <code>${escapeHtml(state.settings.bankAccountNumber)}</code></p>` : ''}
          <p style="margin-top:10px;font-size:0.85rem">${escapeHtml(state.settings.paymentInstructions)}</p>
        </div>
        <div class="field-hint">Choose a card or UPI payment after entering your delivery details.</div>

        <button class="btn btn-primary btn-block" style="margin-top:20px" type="submit">Continue to Payment</button>
      </form>

      <div class="summary-card">
        <h3>Order Summary</h3>
        ${lines.map((l) => `<div class="row-between"><span>${escapeHtml(l.product.name)} × ${l.qty}</span><span>${formatINR(l.product.price * l.qty)}</span></div>`).join('')}
        <div class="row-between"><span>Subtotal</span><span>${formatINR(subtotal)}</span></div>
        <div class="row-between"><span>Delivery</span><span>${delivery === 0 ? 'Free' : formatINR(delivery)}</span></div>
        <div class="total-row"><span>Total</span><span>${formatINR(total)}</span></div>
      </div>
    </div>
  </div>`);

  qs('#co-login-link')?.addEventListener('click', () => openAuthModal('login'));

  qs('#checkout-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector('button[type=submit]');
    btn.disabled = true; btn.textContent = 'Opening payment...';
    const address = {
      fullName: qs('#ch-name').value, address: qs('#ch-address').value,
      city: qs('#ch-city').value, state: qs('#ch-state').value, pin: qs('#ch-pin').value,
    };
    try {
      const { lines: freshLines, subtotal: st, delivery: dl, total: tt } = await cartTotals();
      const customer = { name: qs('#ch-name').value, phone: qs('#ch-phone').value, email: qs('#ch-email').value };
      openPaymentPortal({ total: tt, customer, settings: state.settings, onSuccess: async (payment) => {
        try {
          const order = await api.createOrder({
            userId: state.session.user ? state.session.user.id : null,
            customer, address,
            items: freshLines.map((l) => ({ productId: l.product.id, name: l.product.name, price: l.product.price, qty: l.qty })),
            subtotal: st, delivery: dl, total: tt, ...payment,
          });
          if (state.session.user) await api.saveAddress(state.session.user.id, address);
          state.cart = []; persistCart(); closeOverlay();
          navigate('/order-success/' + order.id);
        } catch (err) {
          toast(err.message || 'Could not place order');
        }
      }});
      btn.disabled = false; btn.textContent = 'Continue to Payment';
    } catch (err) {
      toast(err.message || 'Could not place order');
      btn.disabled = false; btn.textContent = 'Continue to Payment';
    }
  });
}

async function renderOrderSuccess(orderId) {
  const order = await api.getOrder(orderId);
  mount(`
  <div class="container confirm-box" style="padding:70px 20px">
    <div class="big-emoji">🎉</div>
    <h2>Your order has been placed! ♡</h2>
    <p>Thank you for shopping small and handmade.</p>
    <div class="order-id-pill">${escapeHtml(orderId)}</div>
    ${order ? `<p>Total: <b>${formatINR(order.total)}</b></p>` : ''}
    <div class="hero-btns" style="justify-content:center;margin-top:20px">
      <a href="#/track-order/${escapeHtml(orderId)}" class="btn btn-primary" data-link>Track This Order</a>
      <a href="#/shop" class="btn btn-outline" data-link>Continue Shopping</a>
    </div>
  </div>`);
}

/* ---------------------------------------------------------- */
/* AUTH MODAL (customer login / signup)                         */
/* ---------------------------------------------------------- */

function openAuthModal(tab = 'login') {
  overlay(`
  <div class="modal-overlay" id="auth-overlay">
    <div class="modal">
      <button class="modal-close" id="auth-close">✕</button>
      <div class="tab-row">
        <button class="tab-btn ${tab === 'login' ? 'active' : ''}" data-tab="login">Login</button>
        <button class="tab-btn ${tab === 'signup' ? 'active' : ''}" data-tab="signup">Create Account</button>
      </div>
      <div id="auth-body"></div>
    </div>
  </div>`);
  renderAuthTab(tab);
  qs('#auth-close').addEventListener('click', closeOverlay);
  qs('#auth-overlay').addEventListener('click', (e) => { if (e.target.id === 'auth-overlay') closeOverlay(); });
  qsa('.tab-btn').forEach((b) => b.addEventListener('click', () => {
    qsa('.tab-btn').forEach((x) => x.classList.remove('active'));
    b.classList.add('active');
    renderAuthTab(b.dataset.tab);
  }));
}

function renderAuthTab(tab) {
  if (tab === 'login') {
    qs('#auth-body').innerHTML = `
    <form id="login-form">
      <div class="field"><label>Email</label><input required type="email" id="li-email"/></div>
      <div class="field"><label>Password</label><input required type="password" id="li-password"/></div>
      <div id="login-error" class="field-error"></div>
      <button class="btn btn-primary btn-block" type="submit">Login</button>
      <button type="button" class="btn btn-ghost btn-block" style="margin-top:10px" id="forgot-pw">Forgot Password</button>
    </form>`;
    qs('#login-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      try {
        const user = await api.login({ email: qs('#li-email').value, password: qs('#li-password').value });
        state.session.user = user; saveSession();
        await refreshWishlist();
        closeOverlay(); toast(`Welcome back, ${user.fullName.split(' ')[0]}!`);
        router();
      } catch (err) { qs('#login-error').textContent = err.message; }
    });
    qs('#forgot-pw').addEventListener('click', () => toast('Password reset link sent if the account exists (demo)'));
  } else {
    qs('#auth-body').innerHTML = `
    <form id="signup-form">
      <div class="field"><label>Full Name</label><input required id="su-name"/></div>
      <div class="field"><label>Email</label><input required type="email" id="su-email"/></div>
      <div class="field"><label>Phone Number</label><input required id="su-phone" type="tel"/></div>
      <div class="field"><label>Password</label><input required type="password" id="su-password" minlength="8"/></div>
      <div class="field"><label>Confirm Password</label><input required type="password" id="su-confirm"/></div>
      <div id="signup-error" class="field-error"></div>
      <button class="btn btn-primary btn-block" type="submit">Create Account</button>
    </form>`;
    qs('#signup-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const pw = qs('#su-password').value, cf = qs('#su-confirm').value;
      if (pw !== cf) { qs('#signup-error').textContent = 'Passwords do not match.'; return; }
      if (pw.length < 8) { qs('#signup-error').textContent = 'Password must be at least 8 characters.'; return; }
      try {
        const user = await api.signup({ fullName: qs('#su-name').value, email: qs('#su-email').value, phone: qs('#su-phone').value, password: pw });
        state.session.user = user; saveSession();
        await refreshWishlist();
        closeOverlay(); toast('Account created ♡ Welcome!');
        router();
      } catch (err) { qs('#signup-error').textContent = err.message; }
    });
  }
}

/* ---------------------------------------------------------- */
/* CART PANEL                                                    */
/* ---------------------------------------------------------- */

async function openCartPanel() {
  const { lines, subtotal, delivery, total } = await cartTotals();
  overlay(`
  <div class="panel-overlay" id="cart-overlay"></div>
  <div class="panel">
    <div class="panel-head"><h3 style="margin:0">Your Cart</h3><button class="modal-close" style="position:static" id="cart-close">✕</button></div>
    <div class="panel-body">
      ${lines.length ? lines.map((l) => `
        <div class="cart-line">
          ${productThumb(l.product, 'thumb-svg')}
          <div class="cart-line-info">
            <div class="cart-line-top"><b>${escapeHtml(l.product.name)}</b><span>${formatINR(l.product.price * l.qty)}</span></div>
            <div class="row-between">
              <div class="qty-control">
                <button data-cart-minus="${l.productId}">–</button><span>${l.qty}</span><button data-cart-plus="${l.productId}">+</button>
              </div>
              <button class="remove-link" data-cart-remove="${l.productId}">Remove</button>
            </div>
          </div>
        </div>`).join('') : `<div class="empty-state"><span class="emoji">🛒</span><p>Your cart is empty.</p></div>`}
    </div>
    ${lines.length ? `
    <div class="panel-foot">
      <div class="row-between"><span>Subtotal</span><span>${formatINR(subtotal)}</span></div>
      <div class="row-between"><span>Delivery</span><span>${delivery === 0 ? 'Free' : formatINR(delivery)}</span></div>
      <div class="total-row"><span>Total</span><span>${formatINR(total)}</span></div>
      <a href="#/checkout" data-link class="btn btn-primary btn-block" id="cart-checkout" style="margin-top:10px">Checkout</a>
    </div>` : ''}
  </div>`);

  qs('#cart-close').addEventListener('click', closeOverlay);
  qs('#cart-overlay').addEventListener('click', closeOverlay);
  qs('#cart-checkout')?.addEventListener('click', closeOverlay);
  qsa('[data-cart-plus]').forEach((b) => b.addEventListener('click', async () => {
    const l = state.cart.find((i) => i.productId === b.dataset.cartPlus);
    const p = await api.getProduct(b.dataset.cartPlus);
    if (l && p && l.qty < p.stock) setCartQty(b.dataset.cartPlus, l.qty + 1);
    else toast('No more stock available');
    openCartPanel();
  }));
  qsa('[data-cart-minus]').forEach((b) => b.addEventListener('click', () => {
    const l = state.cart.find((i) => i.productId === b.dataset.cartMinus);
    if (l) setCartQty(b.dataset.cartMinus, l.qty - 1);
    openCartPanel();
  }));
  qsa('[data-cart-remove]').forEach((b) => b.addEventListener('click', () => { removeFromCart(b.dataset.cartRemove); openCartPanel(); }));
}

/* ---------------------------------------------------------- */
/* WISHLIST PANEL                                                */
/* ---------------------------------------------------------- */

async function openWishlistPanel() {
  if (!isLoggedIn()) {
    overlay(`<div class="panel-overlay" id="wl-overlay"></div><div class="panel"><div class="panel-head"><h3 style="margin:0">Wishlist</h3><button class="modal-close" style="position:static" id="wl-close">✕</button></div><div class="panel-body"><div class="empty-state"><span class="emoji">❤️</span><p>Log in to save and view your favourites.</p><button class="btn btn-primary" id="wl-login">Login / Sign Up</button></div></div></div>`);
    qs('#wl-close').addEventListener('click', closeOverlay);
    qs('#wl-overlay').addEventListener('click', closeOverlay);
    qs('#wl-login').addEventListener('click', () => openAuthModal('login'));
    return;
  }
  const rows = await api.getWishlist(state.session.user.id);
  const products = (await Promise.all(rows.map((r) => api.getProduct(r.productId)))).filter(Boolean);
  overlay(`
  <div class="panel-overlay" id="wl-overlay"></div>
  <div class="panel">
    <div class="panel-head"><h3 style="margin:0">Your Wishlist</h3><button class="modal-close" style="position:static" id="wl-close">✕</button></div>
    <div class="panel-body">
      ${products.length ? products.map((p) => `
        <div class="cart-line">
          ${productThumb(p, 'thumb-svg')}
          <div class="cart-line-info">
            <div class="cart-line-top"><b>${escapeHtml(p.name)}</b><span>${formatINR(p.price)}</span></div>
            <div class="row-between">
              <button class="btn btn-primary btn-sm" data-wl-add="${p.id}">Add to Cart</button>
              <button class="remove-link" data-wl-remove="${p.id}">Remove</button>
            </div>
          </div>
        </div>`).join('') : `<div class="empty-state"><span class="emoji">❤️</span><p>Nothing saved yet.</p></div>`}
    </div>
  </div>`);
  qs('#wl-close').addEventListener('click', closeOverlay);
  qs('#wl-overlay').addEventListener('click', closeOverlay);
  qsa('[data-wl-add]').forEach((b) => b.addEventListener('click', () => { addToCart(b.dataset.wlAdd, 1); }));
  qsa('[data-wl-remove]').forEach((b) => b.addEventListener('click', async () => { await toggleWishlist(b.dataset.wlRemove); openWishlistPanel(); }));
}

/* ---------------------------------------------------------- */
/* ACCOUNT ICON BEHAVIOR                                         */
/* ---------------------------------------------------------- */

function onAccountIconClick() {
  if (isAdmin()) { navigate('/admin/dashboard'); return; }
  if (isLoggedIn()) { navigate('/account'); return; }
  openAuthModal('login');
}

/* ---------------------------------------------------------- */
/* ADMIN LOGIN                                                   */
/* ---------------------------------------------------------- */

function renderAdminLogin() {
  if (isAdmin()) { navigate('/admin/dashboard'); return; }
  mount(`
  <div class="container" style="max-width:420px;padding:70px 20px">
    <div class="form-card">
      <h2 style="text-align:center">Admin Login</h2>
      <p style="text-align:center;color:var(--brown-soft)">Saachi Crochet Corner — Staff Access</p>
      <form id="admin-login-form">
        <div class="field"><label>Admin Email</label><input required type="email" id="al-email"/></div>
        <div class="field"><label>Password</label><input required type="password" id="al-password"/></div>
        <div id="admin-login-error" class="field-error"></div>
        <button class="btn btn-primary btn-block" type="submit">Login</button>
      </form>
      <p class="field-hint" style="text-align:center;margin-top:16px">Customers should use the account icon in the header instead.</p>
    </div>
  </div>`);

  qs('#admin-login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      const admin = await api.adminLogin({ email: qs('#al-email').value, password: qs('#al-password').value });
      state.session.admin = admin; saveSession();
      toast('Welcome back!');
      navigate('/admin/dashboard');
    } catch (err) { qs('#admin-login-error').textContent = err.message; }
  });
}

/* ---------------------------------------------------------- */
/* ADMIN DASHBOARD SHELL                                          */
/* ---------------------------------------------------------- */

const ADMIN_NAV = [
  { key: 'dashboard', label: 'Dashboard', icon: '📊' },
  { key: 'products', label: 'Products', icon: '🧶' },
  { key: 'add-product', label: 'Add Product', icon: '➕' },
  { key: 'orders', label: 'Orders', icon: '📦' },
  { key: 'custom-orders', label: 'Custom Orders', icon: '✨' },
  { key: 'hampers', label: 'Hamper Requests', icon: '🎁' },
  { key: 'reviews', label: 'Reviews', icon: '⭐' },
  { key: 'customers', label: 'Customers', icon: '👥' },
  { key: 'newsletter', label: 'Newsletter', icon: '📧' },
  { key: 'messages', label: 'Messages', icon: '💬' },
  { key: 'payment', label: 'Payment Settings', icon: '💳' },
  { key: 'store', label: 'Store Settings', icon: '🏪' },
  { key: 'password', label: 'Change Password', icon: '🔒' },
];

function renderAdminDashboard() {
  if (!isAdmin()) { navigate('/admin/login'); return; }
  mount(`
  <div class="admin-shell">
    <aside class="admin-sidebar">
      <div class="brand"><span class="brand-text">Saachi Admin<small>CONTROL PANEL</small></span></div>
      <nav class="admin-nav" id="admin-nav">
        ${ADMIN_NAV.map((n) => `<button data-tab="${n.key}" class="${state.adminTab === n.key ? 'active' : ''}">${n.icon} ${n.label}</button>`).join('')}
        <button data-tab="logout">🚪 Logout</button>
      </nav>
    </aside>
    <div class="admin-main">
      <div class="admin-topbar">
        <h2 style="margin:0" id="admin-title">Dashboard</h2>
        <span class="field-hint">${escapeHtml(state.session.admin.email)}</span>
      </div>
      <div id="admin-content"></div>
    </div>
  </div>`);

  qsa('#admin-nav button').forEach((b) => b.addEventListener('click', () => {
    if (b.dataset.tab === 'logout') {
      state.session.admin = null; saveSession(); toast('Logged out'); navigate('/');
      return;
    }
    state.adminTab = b.dataset.tab;
    qsa('#admin-nav button').forEach((x) => x.classList.remove('active'));
    b.classList.add('active');
    loadAdminTab(b.dataset.tab);
  }));

  loadAdminTab(state.adminTab);
}

function loadAdminTab(tab) {
  const titles = Object.fromEntries(ADMIN_NAV.map((n) => [n.key, n.label]));
  qs('#admin-title').textContent = titles[tab] || 'Dashboard';
  const renderers = {
    dashboard: adminRenderOverview, products: adminRenderProducts, 'add-product': () => adminRenderProductForm(null),
    orders: adminRenderOrders, 'custom-orders': adminRenderCustomOrders, hampers: adminRenderHampers,
    reviews: adminRenderReviews, customers: adminRenderCustomers, newsletter: adminRenderNewsletter,
    messages: adminRenderMessages, payment: adminRenderPayment, store: adminRenderStoreSettings, password: adminRenderPassword,
  };
  (renderers[tab] || adminRenderOverview)();
}

function adminContent(html) { qs('#admin-content').innerHTML = html; }

/* ---------- Dashboard overview ---------- */

async function adminRenderOverview() {
  adminContent(`<div class="skeleton" style="height:200px"></div>`);
  const stats = await api.getDashboardStats();
  const orders = (await api.getAllOrders()).slice(0, 5);
  adminContent(`
    <div class="stat-grid">
      <div class="stat-card"><div class="stat-num">${stats.totalProducts}</div><div class="stat-label">TOTAL PRODUCTS</div></div>
      <div class="stat-card"><div class="stat-num">${stats.totalOrders}</div><div class="stat-label">TOTAL ORDERS</div></div>
      <div class="stat-card"><div class="stat-num">${stats.pendingOrders}</div><div class="stat-label">PENDING ORDERS</div></div>
      <div class="stat-card"><div class="stat-num">${stats.completedOrders}</div><div class="stat-label">COMPLETED ORDERS</div></div>
      <div class="stat-card"><div class="stat-num">${stats.totalCustomers}</div><div class="stat-label">TOTAL CUSTOMERS</div></div>
      <div class="stat-card"><div class="stat-num">${formatINR(stats.revenue)}</div><div class="stat-label">REVENUE</div></div>
    </div>
    <div class="admin-card">
      <h3>Recent Orders</h3>
      ${orders.length ? `<table class="data-table"><thead><tr><th>Order ID</th><th>Customer</th><th>Date</th><th>Amount</th><th>Status</th></tr></thead><tbody>
        ${orders.map((o) => `<tr><td>${o.id}</td><td>${escapeHtml(o.customer.name)}</td><td>${formatDate(o.createdAt)}</td><td>${formatINR(o.total)}</td><td><span class="status-pill status-${slugStatus(o.status)}">${o.status}</span></td></tr>`).join('')}
      </tbody></table>` : `<p class="center-note">No orders yet.</p>`}
    </div>`);
}

/* ---------- Products list ---------- */

async function adminRenderProducts() {
  adminContent(`<div class="skeleton" style="height:200px"></div>`);
  const products = await api.getProducts();
  adminContent(`
  <div class="admin-card">
    <table class="data-table">
      <thead><tr><th>Image</th><th>Name</th><th>Category</th><th>Price</th><th>Stock</th><th>Status</th><th>Actions</th></tr></thead>
      <tbody>
        ${products.map((p) => `<tr>
          <td>${productThumbCell(p)}</td>
          <td>${escapeHtml(p.name)}<br/><span class="field-hint">${escapeHtml(p.sku)}</span></td>
          <td>${escapeHtml(p.category)}</td>
          <td>${formatINR(p.price)}</td>
          <td>${p.stock}</td>
          <td>${p.available ? '<span class="status-pill status-Delivered">Active</span>' : '<span class="status-pill status-Cancelled">Hidden</span>'}${p.featured ? ' <span class="status-pill status-Confirmed">Featured</span>' : ''}</td>
          <td class="table-actions">
            <button class="icon-action" data-edit="${p.id}" title="Edit">✏️</button>
            <button class="icon-action danger" data-delete="${p.id}" title="Delete">🗑️</button>
          </td>
        </tr>`).join('')}
      </tbody>
    </table>
    ${products.length === 0 ? '<p class="center-note">No products yet. Add your first one!</p>' : ''}
  </div>`);

  qsa('[data-edit]').forEach((b) => b.addEventListener('click', () => adminRenderProductForm(b.dataset.edit)));
  qsa('[data-delete]').forEach((b) => b.addEventListener('click', async () => {
    if (confirm('Delete this product? This cannot be undone.')) {
      await api.deleteProduct(b.dataset.delete);
      toast('Product deleted');
      adminRenderProducts();
    }
  }));
}

function productThumbCell(p) {
  const img = p.images && p.images[0];
  if (img && img.startsWith('data:')) return `<img class="table-thumb" src="${img}"/>`;
  return `<div class="table-thumb" style="overflow:hidden">${productArt(img)}</div>`;
}

/* ---------- Add / Edit product form ---------- */

let adminProductImages = [];

async function adminRenderProductForm(editId) {
  let p = null;
  if (editId) p = await api.getProduct(editId);
  adminProductImages = p ? [...p.images].filter((i) => i.startsWith('data:')) : [];

  adminContent(`
  <div class="admin-card">
    <h3>${p ? 'Edit Product' : 'Add Product'}</h3>
    <form id="product-form">
      <div class="field-row">
        <div class="field"><label>Product Name *</label><input required id="pf-name" value="${p ? escapeHtml(p.name) : ''}"/></div>
        <div class="field"><label>Category *</label>
          <select required id="pf-category">
            ${['Rakhis', 'Crochet Flowers', 'Hair Accessories', 'Keychains', 'Phone Charms', 'Gift Hampers', 'Custom'].map((c) => `<option ${p && p.category === c ? 'selected' : ''}>${c}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="field-row">
        <div class="field"><label>Price (₹) *</label><input required type="number" min="0" id="pf-price" value="${p ? p.price : ''}"/></div>
        <div class="field"><label>SKU</label><input id="pf-sku" value="${p ? escapeHtml(p.sku) : ''}" placeholder="Auto-generated if blank"/></div>
      </div>
      <div class="field"><label>Description *</label><textarea required id="pf-desc">${p ? escapeHtml(p.description) : ''}</textarea></div>
      <div class="field-row">
        <div class="field"><label>Stock Quantity *</label><input required type="number" min="0" id="pf-stock" value="${p ? p.stock : 10}"/></div>
        <div class="field"><label>Availability</label>
          <select id="pf-available">
            <option value="true" ${!p || p.available ? 'selected' : ''}>Available</option>
            <option value="false" ${p && !p.available ? 'selected' : ''}>Unavailable</option>
          </select>
        </div>
      </div>
      <div class="field-row">
        <div class="field"><label><input type="checkbox" id="pf-featured" ${p && p.featured ? 'checked' : ''}/> Featured Product</label></div>
        <div class="field"><label><input type="checkbox" id="pf-new" ${p && p.newArrival ? 'checked' : ''}/> New Arrival</label></div>
      </div>

      <div class="field">
        <label>Upload Product Images</label>
        <div class="upload-zone" id="upload-zone">
          <p style="margin:0">Drag & drop images here, or click to browse</p>
          <p class="field-hint">Multiple images supported · Max 2MB each · First image is primary</p>
        </div>
        <input type="file" id="pf-images" accept="image/*" multiple style="display:none"/>
        <div class="preview-strip" id="pf-preview"></div>
      </div>

      <button type="submit" class="btn btn-primary btn-block">${p ? 'Save Changes' : 'Add Product'}</button>
      ${p ? `<button type="button" id="pf-cancel" class="btn btn-ghost btn-block" style="margin-top:10px">Cancel</button>` : ''}
    </form>
  </div>`);

  renderImagePreviewStrip();

  const zone = qs('#upload-zone');
  const fileInput = qs('#pf-images');
  zone.addEventListener('click', () => fileInput.click());
  zone.addEventListener('dragover', (e) => { e.preventDefault(); zone.classList.add('drag'); });
  zone.addEventListener('dragleave', () => zone.classList.remove('drag'));
  zone.addEventListener('drop', (e) => { e.preventDefault(); zone.classList.remove('drag'); handleProductFiles(e.dataTransfer.files); });
  fileInput.addEventListener('change', (e) => handleProductFiles(e.target.files));

  qs('#pf-cancel')?.addEventListener('click', () => adminRenderProducts());

  qs('#product-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = {
      name: qs('#pf-name').value, category: qs('#pf-category').value, price: Number(qs('#pf-price').value),
      sku: qs('#pf-sku').value || undefined, description: qs('#pf-desc').value, stock: Number(qs('#pf-stock').value),
      available: qs('#pf-available').value === 'true', featured: qs('#pf-featured').checked, newArrival: qs('#pf-new').checked,
      images: adminProductImages.length ? adminProductImages : ['placeholder'],
    };
    try {
      if (p) { await api.updateProduct(p.id, payload); toast('Product updated ♡'); }
      else { await api.createProduct(payload); toast('Product successfully added!'); }
      adminRenderProducts();
    } catch (err) { toast(err.message || 'Could not save product'); }
  });
}

function handleProductFiles(fileList) {
  const files = Array.from(fileList);
  files.forEach((file) => {
    if (!file.type.startsWith('image/')) { toast(`${file.name} is not an image`); return; }
    if (file.size > 2 * 1024 * 1024) { toast(`${file.name} is over 2MB`); return; }
    const reader = new FileReader();
    reader.onload = () => { adminProductImages.push(reader.result); renderImagePreviewStrip(); };
    reader.readAsDataURL(file);
  });
}

function renderImagePreviewStrip() {
  qs('#pf-preview').innerHTML = adminProductImages.map((img, i) => `
    <div class="preview-thumb ${i === 0 ? 'primary' : ''}"><img src="${img}"/><button type="button" data-remove-img="${i}">✕</button></div>`).join('');
  qsa('[data-remove-img]').forEach((b) => b.addEventListener('click', () => {
    adminProductImages.splice(Number(b.dataset.removeImg), 1);
    renderImagePreviewStrip();
  }));
}

/* ---------- Orders management ---------- */

async function adminRenderOrders() {
  adminContent(`<div class="skeleton" style="height:200px"></div>`);
  const orders = await api.getAllOrders();
  const allStatuses = [...ORDER_STATUSES, 'Cancelled'];
  adminContent(`
  <div class="admin-card">
    <table class="data-table">
      <thead><tr><th>Order ID</th><th>Customer</th><th>Date</th><th>Amount</th><th>Payment</th><th>Status</th><th>ETA</th><th>Actions</th></tr></thead>
      <tbody>
        ${orders.map((o) => `<tr>
          <td>${o.id}</td>
          <td>${escapeHtml(o.customer.name)}<br/><span class="field-hint">${escapeHtml(o.customer.phone)}</span></td>
          <td>${formatDate(o.createdAt)}</td>
          <td>${formatINR(o.total)}</td>
          <td><span class="status-pill status-${slugStatus(o.paymentStatus)}">${o.paymentStatus}</span></td>
          <td>
            <select data-status-for="${o.id}" class="sort-select" style="padding:6px 10px;font-size:0.82rem">
              ${allStatuses.map((s) => `<option ${o.status === s ? 'selected' : ''}>${s}</option>`).join('')}
            </select>
          </td>
          <td><input type="text" data-eta-for="${o.id}" value="${escapeHtml(o.estimatedDelivery || '')}" placeholder="e.g. 5 Oct" style="width:100px;padding:6px;border-radius:8px;border:2px solid var(--line)"/></td>
          <td class="table-actions"><button class="icon-action" data-view-order="${o.id}">👁️</button></td>
        </tr>`).join('')}
      </tbody>
    </table>
    ${orders.length === 0 ? '<p class="center-note">No orders yet.</p>' : ''}
  </div>
  <div id="order-detail"></div>`);

  qsa('[data-status-for]').forEach((sel) => sel.addEventListener('change', async () => {
    await api.updateOrderStatus(sel.dataset.statusFor, sel.value);
    toast('Order status updated');
    adminRenderOrders();
  }));
  qsa('[data-eta-for]').forEach((inp) => inp.addEventListener('change', async () => {
    await api.updateOrderETA(inp.dataset.etaFor, inp.value);
    toast('Estimated delivery updated');
  }));
  qsa('[data-view-order]').forEach((b) => b.addEventListener('click', async () => {
    const order = await api.getOrder(b.dataset.viewOrder);
    qs('#order-detail').innerHTML = `
      <div class="admin-card">
        <h3>Order ${order.id}</h3>
        <p><b>Customer:</b> ${escapeHtml(order.customer.name)} · ${escapeHtml(order.customer.phone)} · ${escapeHtml(order.customer.email)}</p>
        <p><b>Address:</b> ${escapeHtml(order.address.address)}, ${escapeHtml(order.address.city)}, ${escapeHtml(order.address.state)} - ${escapeHtml(order.address.pin)}</p>
        <table class="data-table"><thead><tr><th>Product</th><th>Qty</th><th>Price</th></tr></thead><tbody>
          ${order.items.map((it) => `<tr><td>${escapeHtml(it.name)}</td><td>${it.qty}</td><td>${formatINR(it.price * it.qty)}</td></tr>`).join('')}
        </tbody></table>
        <div class="row-between"><span>Subtotal</span><span>${formatINR(order.subtotal)}</span></div>
        <div class="row-between"><span>Delivery</span><span>${formatINR(order.delivery)}</span></div>
        <div class="total-row"><span>Total</span><span>${formatINR(order.total)}</span></div>
      </div>`;
  }));
}

/* ---------- Custom orders ---------- */

async function adminRenderCustomOrders() {
  adminContent(`<div class="skeleton" style="height:200px"></div>`);
  const list = await api.getCustomOrders();
  adminContent(`
  <div class="admin-card">
    ${list.length ? list.map((c) => `
      <div class="admin-card" style="box-shadow:none;border:1px dashed var(--line)">
        <div class="row-between"><b>${escapeHtml(c.name)}</b><span class="status-pill status-${slugStatus(c.status)}">${c.status}</span></div>
        <p class="field-hint">${escapeHtml(c.email)} · ${escapeHtml(c.phone)} · ${formatDate(c.createdAt)}</p>
        <p><b>Product:</b> ${escapeHtml(c.product)} &nbsp; <b>Colour:</b> ${escapeHtml(c.colour)} &nbsp; <b>Size:</b> ${escapeHtml(c.size || '—')} &nbsp; <b>Qty:</b> ${escapeHtml(String(c.quantity))} &nbsp; <b>Budget:</b> ${c.budget ? formatINR(c.budget) : '—'}</p>
        ${c.description ? `<p>${escapeHtml(c.description)}</p>` : ''}
        ${c.referenceImage ? `<img src="${c.referenceImage}" style="width:120px;border-radius:12px;margin-bottom:10px"/>` : ''}
        <select data-custom-status="${c.id}" class="sort-select">
          ${['New', 'In Progress', 'Completed', 'Cancelled'].map((s) => `<option ${c.status === s ? 'selected' : ''}>${s}</option>`).join('')}
        </select>
      </div>`).join('') : '<p class="center-note">No custom requests yet.</p>'}
  </div>`);

  qsa('[data-custom-status]').forEach((sel) => sel.addEventListener('change', async () => {
    await api.updateCustomOrderStatus(sel.dataset.customStatus, sel.value);
    toast('Status updated');
  }));
}

/* ---------- Hamper requests ---------- */

async function adminRenderHampers() {
  adminContent(`<div class="skeleton" style="height:200px"></div>`);
  const list = await api.getHamperRequests();
  adminContent(`
  <div class="admin-card">
    ${list.length ? list.map((h) => `
      <div class="admin-card" style="box-shadow:none;border:1px dashed var(--line)">
        <div class="row-between"><b>${escapeHtml(h.name)}</b><span class="field-hint">${formatDate(h.createdAt)}</span></div>
        <p class="field-hint">${escapeHtml(h.email)} · ${escapeHtml(h.phone)}</p>
        <p><b>Budget:</b> ${formatINR(h.budget)} &nbsp; <b>Theme:</b> ${escapeHtml(h.theme || '—')} &nbsp; <b>Colours:</b> ${escapeHtml(h.colours || '—')}</p>
        ${h.products ? `<p><b>Requested items:</b> ${escapeHtml(h.products)}</p>` : ''}
        ${h.message ? `<p><b>Card message:</b> "${escapeHtml(h.message)}"</p>` : ''}
      </div>`).join('') : '<p class="center-note">No hamper requests yet.</p>'}
  </div>`);
}

/* ---------- Reviews moderation ---------- */

async function adminRenderReviews() {
  adminContent(`<div class="skeleton" style="height:200px"></div>`);
  const list = await api.getAllReviews();
  adminContent(`
  <div class="admin-card">
    <table class="data-table">
      <thead><tr><th>Name</th><th>Rating</th><th>Review</th><th>Status</th><th>Actions</th></tr></thead>
      <tbody>
        ${list.map((r) => `<tr>
          <td>${escapeHtml(r.name)}</td><td>${'★'.repeat(r.rating)}</td>
          <td style="max-width:280px">${escapeHtml(r.text)}</td>
          <td><span class="status-pill status-${r.approved ? 'Approved' : 'Pending'}">${r.approved ? 'Approved' : 'Pending'}</span></td>
          <td class="table-actions">
            <button class="icon-action" data-approve="${r.id}" title="Approve">✅</button>
            <button class="icon-action danger" data-reject="${r.id}" title="Reject">❌</button>
          </td>
        </tr>`).join('')}
      </tbody>
    </table>
    ${list.length === 0 ? '<p class="center-note">No reviews submitted yet.</p>' : ''}
  </div>`);

  qsa('[data-approve]').forEach((b) => b.addEventListener('click', async () => { await api.setReviewApproval(b.dataset.approve, true); toast('Review approved'); adminRenderReviews(); }));
  qsa('[data-reject]').forEach((b) => b.addEventListener('click', async () => { await api.setReviewApproval(b.dataset.reject, false); toast('Review rejected'); adminRenderReviews(); }));
}

/* ---------- Customers ---------- */

async function adminRenderCustomers() {
  adminContent(`<div class="skeleton" style="height:200px"></div>`);
  const users = readTable(DB_KEYS.USERS, []);
  adminContent(`
  <div class="admin-card">
    <table class="data-table">
      <thead><tr><th>Name</th><th>Email</th><th>Phone</th><th>Joined</th></tr></thead>
      <tbody>${users.map((u) => `<tr><td>${escapeHtml(u.fullName)}</td><td>${escapeHtml(u.email)}</td><td>${escapeHtml(u.phone || '—')}</td><td>${formatDate(u.createdAt)}</td></tr>`).join('')}</tbody>
    </table>
    ${users.length === 0 ? '<p class="center-note">No registered customers yet.</p>' : ''}
  </div>`);
}

/* ---------- Newsletter ---------- */

async function adminRenderNewsletter() {
  const subs = await api.getSubscribers();
  adminContent(`
  <div class="admin-card">
    <p><b>${subs.length}</b> subscriber${subs.length === 1 ? '' : 's'}</p>
    <table class="data-table"><thead><tr><th>Email</th><th>Subscribed</th></tr></thead><tbody>
      ${subs.map((s) => `<tr><td>${escapeHtml(s.email)}</td><td>${formatDate(s.subscribedAt)}</td></tr>`).join('')}
    </tbody></table>
    ${subs.length === 0 ? '<p class="center-note">No subscribers yet.</p>' : ''}
  </div>`);
}

/* ---------- Contact messages ---------- */

async function adminRenderMessages() {
  const msgs = await api.getMessages();
  adminContent(`
  <div class="admin-card">
    ${msgs.length ? msgs.map((m) => `
      <div class="admin-card" style="box-shadow:none;border:1px dashed var(--line)">
        <div class="row-between"><b>${escapeHtml(m.name)}</b><span class="field-hint">${formatDate(m.createdAt)}</span></div>
        <p class="field-hint">${escapeHtml(m.email)} ${m.phone ? '· ' + escapeHtml(m.phone) : ''}</p>
        <p>${escapeHtml(m.message)}</p>
      </div>`).join('') : '<p class="center-note">No messages yet.</p>'}
  </div>`);
}

/* ---------- Payment settings ---------- */

async function adminRenderPayment() {
  const settings = await api.getSettings();
  adminContent(`
  <div class="admin-card" style="max-width:520px">
    <form id="payment-form">
      <div class="field"><label>Google Pay / UPI ID *</label><input required id="pay-upi" value="${escapeHtml(settings.upiId)}"/></div>
      <div class="field"><label>Bank Account Number</label><input id="pay-bank-account" value="${escapeHtml(settings.bankAccountNumber || '')}" inputmode="numeric" autocomplete="off"/></div>
      <div class="field"><label>Payment Instructions</label><textarea id="pay-instructions">${escapeHtml(settings.paymentInstructions)}</textarea></div>
      <div class="field"><label>Razorpay Key ID (optional)</label><input id="pay-razorpay" value="${escapeHtml(settings.razorpayKeyId || '')}" placeholder="rzp_live_..."/></div>
      <div class="field-hint">Razorpay secret keys must live in server-side environment variables, never in this dashboard — this field only stores the public key ID for future integration.</div>
      <button class="btn btn-primary btn-block" style="margin-top:14px" type="submit">Save Payment Settings</button>
    </form>
  </div>`);

  qs('#payment-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    await api.updateSettings({ upiId: qs('#pay-upi').value, bankAccountNumber: qs('#pay-bank-account').value, paymentInstructions: qs('#pay-instructions').value, razorpayKeyId: qs('#pay-razorpay').value });
    toast('Payment settings saved');
  });
}

/* ---------- Store settings ---------- */

async function adminRenderStoreSettings() {
  const settings = await api.getSettings();
  adminContent(`
  <div class="admin-card" style="max-width:520px">
    <form id="store-form">
      <div class="field"><label>Delivery Charge (₹)</label><input type="number" min="0" id="store-delivery" value="${settings.deliveryCharge}"/></div>
      <div class="field"><label>Free Delivery Above (₹)</label><input type="number" min="0" id="store-free-above" value="${settings.freeDeliveryAbove}"/></div>
      <button class="btn btn-primary btn-block" style="margin-top:14px" type="submit">Save Store Settings</button>
    </form>
  </div>`);

  qs('#store-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    await api.updateSettings({ deliveryCharge: Number(qs('#store-delivery').value), freeDeliveryAbove: Number(qs('#store-free-above').value) });
    toast('Store settings saved');
  });
}

/* ---------- Change admin password ---------- */

function adminRenderPassword() {
  adminContent(`
  <div class="admin-card" style="max-width:460px">
    <form id="pw-form">
      <div class="field"><label>Current Password *</label><input required type="password" id="pw-current"/></div>
      <div class="field"><label>New Password *</label><input required type="password" id="pw-new" minlength="8"/></div>
      <div class="field"><label>Confirm New Password *</label><input required type="password" id="pw-confirm"/></div>
      <div id="pw-error" class="field-error"></div>
      <button class="btn btn-primary btn-block" type="submit">Change Password</button>
    </form>
  </div>`);

  qs('#pw-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const n = qs('#pw-new').value, c = qs('#pw-confirm').value;
    if (n !== c) { qs('#pw-error').textContent = 'New passwords do not match.'; return; }
    if (n.length < 8) { qs('#pw-error').textContent = 'Password must be at least 8 characters.'; return; }
    try {
      await api.changeAdminPassword(state.session.admin.id, { currentPassword: qs('#pw-current').value, newPassword: n });
      toast('Password changed successfully');
      e.target.reset();
    } catch (err) { qs('#pw-error').textContent = err.message; }
  });
}

/* ---------------------------------------------------------- */
/* GLOBAL EVENT DELEGATION                                        */
/* ---------------------------------------------------------- */

document.addEventListener('click', (e) => {
  const link = e.target.closest('[data-link]');
  if (link) {
    e.preventDefault();
    const href = link.getAttribute('href');
    if (href && href.startsWith('#')) {
      if (link.hasAttribute('data-drawer')) closeDrawer();
      const oldHash = location.hash || '#/';
      location.hash = href;
      if (oldHash === href) router(); // same route clicked again — hashchange won't fire, so render manually
    }
    return;
  }
  const addBtn = e.target.closest('[data-action="add-cart"]');
  if (addBtn) { addToCart(addBtn.dataset.id, 1); return; }
  const wishBtn = e.target.closest('[data-action="wish"]');
  if (wishBtn) { toggleWishlist(wishBtn.dataset.id); return; }
});

window.addEventListener('hashchange', router);

/* header icon buttons */
qs('#btn-cart').addEventListener('click', openCartPanel);
qs('#btn-wishlist').addEventListener('click', openWishlistPanel);
qs('#btn-account').addEventListener('click', onAccountIconClick);

/* mobile drawer */
function openDrawer() { qs('#drawer-overlay-wrap').classList.remove('hidden'); }
function closeDrawer() { qs('#drawer-overlay-wrap').classList.add('hidden'); }
qs('#btn-hamburger').addEventListener('click', openDrawer);
qs('#drawer-close').addEventListener('click', closeDrawer);
qs('#drawer-overlay').addEventListener('click', closeDrawer);

/* ---------------------------------------------------------- */
/* INIT                                                          */
/* ---------------------------------------------------------- */

async function init() {
  qs('#footer-year').textContent = new Date().getFullYear();
  await initDatabase();
  await refreshWishlist();
  if (!location.hash) location.hash = '#/';
  await router();
}

init();
