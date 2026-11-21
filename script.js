let products = [];

const productGrid = document.querySelector("#product-grid");
const emptyState = document.querySelector("#empty-state");
const cartDrawer = document.querySelector("#cart-drawer");
const drawerBackdrop = document.querySelector("#drawer-backdrop");
const cartItems = document.querySelector("#cart-items");
const cartEmpty = document.querySelector("#cart-empty");
const drawerFooter = document.querySelector("#drawer-footer");
const cartCount = document.querySelector("#cart-count");
const themeToggle = document.querySelector("#theme-toggle");
const currency = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
let activeCategory = "All";
let searchTerm = "";
let favorites = new Set();
let cart = loadCart();
let toastTimer;

function getPrivateSessionId() {
  const key = "studio-morrow-session";
  try {
    let sessionId = localStorage.getItem(key);
    if (!sessionId) {
      sessionId = `viewer-${crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36)}`;
      localStorage.setItem(key, sessionId);
    }
    return sessionId;
  } catch {
    return `viewer-${Date.now().toString(36)}`;
  }
}

function getDemoPayload() {
  const entries = Object.entries(cart).map(([id, quantity]) => {
    const product = products.find((item) => item.id === id);
    return { id, name: product.name, quantity, unitPrice: product.price, lineTotal: product.price * quantity };
  });
  const total = entries.reduce((sum, item) => sum + item.lineTotal, 0);
  return {
    sessionId: getPrivateSessionId(),
    theme: document.documentElement.dataset.theme || "day",
    items: entries,
    subtotal: total,
    createdAt: new Date().toISOString()
  };
}

function applyTheme(theme) {
  const isNight = theme === "night";
  document.documentElement.dataset.theme = isNight ? "night" : "day";
  themeToggle.setAttribute("aria-checked", String(isNight));
  themeToggle.title = isNight ? "Switch to day mode" : "Switch to night mode";
  document.querySelector('meta[name="theme-color"]').content = isNight ? "#171b20" : "#f6f5f0";
}

try {
  applyTheme(localStorage.getItem("studio-morrow-theme") === "night" ? "night" : "day");
} catch {
  applyTheme("day");
}

themeToggle.addEventListener("click", () => {
  const theme = document.documentElement.dataset.theme === "night" ? "day" : "night";
  applyTheme(theme);
  try {
    localStorage.setItem("studio-morrow-theme", theme);
  } catch {
    // The selected theme still applies until the page closes.
  }
});

function loadCart() {
  try {
    const saved = JSON.parse(localStorage.getItem("studio-morrow-cart") || "{}");
    return Object.fromEntries(Object.entries(saved).filter(([, quantity]) => Number.isInteger(quantity) && quantity > 0));
  } catch {
    return {};
  }
}

function saveCart() {
  localStorage.setItem("studio-morrow-cart", JSON.stringify(cart));
}

function renderProducts() {
  const sortBy = document.querySelector("#sort-select").value;
  let visibleProducts = products.filter((product) => {
    const matchesCategory = activeCategory === "All" || product.category === activeCategory;
    const matchesSearch = `${product.name} ${product.category} ${product.detail}`.toLowerCase().includes(searchTerm);
    return matchesCategory && matchesSearch;
  });
  if (sortBy === "price-low") visibleProducts = [...visibleProducts].sort((a, b) => a.price - b.price);
  if (sortBy === "price-high") visibleProducts = [...visibleProducts].sort((a, b) => b.price - a.price);

  productGrid.innerHTML = visibleProducts.map((product, index) => `
    <article class="product-card" style="animation-delay:${index * 55}ms">
      <div class="product-image-wrap">
        <img class="product-image" src="${product.image}" alt="${product.name}" loading="lazy" />
        <span class="product-label">${product.label}</span>
        <button class="favorite-button${favorites.has(product.id) ? " is-favorite" : ""}" data-favorite="${product.id}" type="button" aria-label="${favorites.has(product.id) ? "Remove" : "Add"} ${product.name} ${favorites.has(product.id) ? "from" : "to"} favorites" aria-pressed="${favorites.has(product.id)}">${favorites.has(product.id) ? "♥" : "♡"}</button>
      </div>
      <div class="product-info">
        <div><h3 class="product-name">${product.name}</h3><p class="product-detail">${product.detail}</p></div>
        <p class="product-price">${currency.format(product.price)}</p>
        <button class="add-button" data-add="${product.id}" type="button">Add to demo bag <span aria-hidden="true">+</span></button>
      </div>
    </article>`).join("");
  emptyState.hidden = visibleProducts.length > 0;
}

function renderCart() {
  const entries = Object.entries(cart);
  const itemCount = entries.reduce((sum, [, quantity]) => sum + quantity, 0);
  const subtotal = entries.reduce((sum, [id, quantity]) => sum + products.find((product) => product.id === id).price * quantity, 0);
  cartCount.textContent = itemCount;
  document.querySelector("#drawer-item-count").textContent = `(${itemCount})`;
  document.querySelector("#cart-subtotal").textContent = currency.format(subtotal);
  cartEmpty.hidden = itemCount > 0;
  drawerFooter.hidden = itemCount === 0;
  cartItems.innerHTML = entries.map(([id, quantity]) => {
    const product = products.find((item) => item.id === id);
    return `<article class="cart-item">
      <img src="${product.image}" alt="" />
      <div><h3>${product.name}</h3><p>${product.detail}</p><div class="quantity-control" aria-label="Quantity for ${product.name}"><button type="button" data-quantity="${id}" data-change="-1" aria-label="Decrease quantity">−</button><span>${quantity}</span><button type="button" data-quantity="${id}" data-change="1" aria-label="Increase quantity">+</button></div></div>
      <span class="cart-item-price">${currency.format(product.price * quantity)}</span>
      <button class="remove-item" type="button" data-remove="${id}">Remove</button>
    </article>`;
  }).join("");
}

function showToast(message) {
  const toast = document.querySelector("#toast");
  toast.textContent = message;
  toast.classList.add("is-visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("is-visible"), 2200);
}

function openCart() {
  drawerBackdrop.hidden = false;
  requestAnimationFrame(() => {
    drawerBackdrop.classList.add("is-visible");
    cartDrawer.classList.add("is-open");
    cartDrawer.setAttribute("aria-hidden", "false");
    document.querySelector("#close-drawer").focus();
  });
  document.body.style.overflow = "hidden";
}

function closeCart() {
  drawerBackdrop.classList.remove("is-visible");
  cartDrawer.classList.remove("is-open");
  cartDrawer.setAttribute("aria-hidden", "true");
  document.body.style.overflow = "";
  setTimeout(() => { if (!cartDrawer.classList.contains("is-open")) drawerBackdrop.hidden = true; }, 280);
  document.querySelector("#cart-trigger").focus();
}

document.querySelector(".filters").addEventListener("click", (event) => {
  const button = event.target.closest("[data-category]");
  if (!button) return;
  activeCategory = button.dataset.category;
  document.querySelectorAll(".filter-button").forEach((filter) => filter.classList.toggle("is-active", filter === button));
  renderProducts();
});

document.querySelector("#search-input").addEventListener("input", (event) => {
  searchTerm = event.target.value.trim().toLowerCase();
  renderProducts();
});
document.querySelector("#sort-select").addEventListener("change", renderProducts);

productGrid.addEventListener("click", (event) => {
  const addButton = event.target.closest("[data-add]");
  const favoriteButton = event.target.closest("[data-favorite]");
  if (addButton) {
    const product = products.find((item) => item.id === addButton.dataset.add);
    cart[product.id] = (cart[product.id] || 0) + 1;
    saveCart();
    renderCart();
    showToast(`${product.name} added to the demo bag`);
  }
  if (favoriteButton) {
    const id = favoriteButton.dataset.favorite;
    favorites.has(id) ? favorites.delete(id) : favorites.add(id);
    renderProducts();
  }
});

cartItems.addEventListener("click", (event) => {
  const quantityButton = event.target.closest("[data-quantity]");
  const removeButton = event.target.closest("[data-remove]");
  if (quantityButton) {
    const id = quantityButton.dataset.quantity;
    cart[id] += Number(quantityButton.dataset.change);
    if (cart[id] <= 0) delete cart[id];
  }
  if (removeButton) delete cart[removeButton.dataset.remove];
  saveCart();
  renderCart();
});

document.querySelector("#cart-trigger").addEventListener("click", openCart);
document.querySelector("#close-drawer").addEventListener("click", closeCart);
drawerBackdrop.addEventListener("click", closeCart);
document.querySelector(".continue-shopping").addEventListener("click", () => { closeCart(); document.querySelector("#shop").scrollIntoView({ behavior: "smooth" }); });
document.addEventListener("keydown", (event) => { if (event.key === "Escape" && cartDrawer.classList.contains("is-open")) closeCart(); });
document.querySelector("#save-local-button").addEventListener("click", () => {
  saveCart();
  localStorage.setItem("studio-morrow-private-data", JSON.stringify(getDemoPayload()));
  const message = document.querySelector("#checkout-message");
  message.textContent = `Saved privately as ${getPrivateSessionId()}.`;
  showToast("Private demo data saved locally");
});

document.querySelector("#checkout-button").addEventListener("click", async () => {
  const message = document.querySelector("#checkout-message");
  message.textContent = "Processing demo locally…";

  if (location.protocol === "file:") {
    const reference = `SIM-${Date.now().toString(36).toUpperCase()}`;
    localStorage.setItem("studio-morrow-last-reference", reference);
    message.textContent = `Demo processed. Reference ${reference}. Run the local server to send this to a server file.`;
    showToast("Demo processing complete");
    return;
  }

  try {
    const response = await fetch("/api/demo/process", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(getDemoPayload())
    });
    if (!response.ok) throw new Error("Server response was not successful");
    const result = await response.json();
    localStorage.setItem("studio-morrow-last-reference", result.reference);
    message.textContent = `Processed by demo server. Reference ${result.reference}.`;
    showToast("Demo sent and processed");
  } catch (error) {
    message.textContent = "The demo server is unavailable. Your data remains saved locally.";
  }
});
document.querySelector("#newsletter-form").addEventListener("submit", (event) => {
  event.preventDefault();
  document.querySelector("#newsletter-message").textContent = "Demo submitted — this form does not collect data.";
  event.currentTarget.reset();
});

async function loadProducts() {
  try {
    const response = await fetch("/api/products", { cache: "no-store" });
    if (!response.ok) throw new Error("Could not load products");
    const data = await response.json();
    products = Array.isArray(data.products) ? data.products : [];
  } catch {
    products = [];
  }
  renderProducts();
  renderCart();
}

loadProducts();