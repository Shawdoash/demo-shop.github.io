const http = require("http");
const fs = require("fs");
const path = require("path");

const root = __dirname;
const dataDirectory = path.join(root, "server-data");
const submissionsFile = path.join(dataDirectory, "submissions.jsonl");
const productsFile = path.join(dataDirectory, "products.json");
const adminPage = path.join(root, "admin.html");
const port = Number(process.env.PORT) || 43127;

const adminUsername = process.env.ADMIN_USERNAME;
const adminPassword = process.env.ADMIN_PASSWORD;
const secureCookies = process.env.NODE_ENV === "production";
const adminSessions = new Map();
let adminFailedAttempts = 0;
let adminLockedUntil = 0;

fs.mkdirSync(dataDirectory, { recursive: true });

const defaultProducts = [
  { id: "item-001", name: "Item 001", category: "Form", detail: "Object study · Series A", price: 42, label: "001", image: "https://images.unsplash.com/photo-1452860606245-08befc0ff44b?auto=format&fit=crop&w=900&q=82" },
  { id: "item-002", name: "Item 002", category: "Paper", detail: "Object study · Series A", price: 26, label: "002", image: "https://images.unsplash.com/photo-1455390582262-044cdead277a?auto=format&fit=crop&w=900&q=82" },
  { id: "item-003", name: "Item 003", category: "Form", detail: "Object study · Series B", price: 34, label: "003", image: "https://images.unsplash.com/photo-1513364776144-60967b0f800f?auto=format&fit=crop&w=900&q=82" },
  { id: "item-004", name: "Item 004", category: "Studio", detail: "Object study · Series B", price: 38, label: "004", image: "https://images.unsplash.com/photo-1513475382585-d06e58bcb0e0?auto=format&fit=crop&w=900&q=82" },
  { id: "item-005", name: "Item 005", category: "Form", detail: "Object study · Series C", price: 30, label: "005", image: "https://images.unsplash.com/photo-1460661419201-fd4cecdf8a8b?auto=format&fit=crop&w=900&q=82" },
  { id: "item-006", name: "Item 006", category: "Paper", detail: "Object study · Series C", price: 24, label: "006", image: "https://images.unsplash.com/photo-1523726491678-bf852e717f6a?auto=format&fit=crop&w=900&q=82" }
];

if (!fs.existsSync(productsFile)) {
  fs.writeFileSync(productsFile, JSON.stringify(defaultProducts, null, 2), "utf8");
}

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml"
};

function sendJson(response, statusCode, payload, headers = {}) {
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    ...headers
  });
  response.end(JSON.stringify(payload));
}

function getCookies(request) {
  return Object.fromEntries((request.headers.cookie || "")
    .split(";")
    .map((part) => part.trim().split("="))
    .filter(([key, value]) => key && value)
    .map(([key, value]) => [key, decodeURIComponent(value)]));
}

function isAdminSession(request) {
  const token = getCookies(request)["studio_admin"];
  return Boolean(token && adminSessions.has(token));
}

const server = http.createServer((request, response) => {
  const url = request.url.split("?")[0];

  if (url === "/admin" || url === "/admin/" || url === "/admin.html") {
    fs.readFile(adminPage, (error, data) => {
      if (error) {
        response.writeHead(404).end("Not found");
        return;
      }
      response.writeHead(200, {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
        "Referrer-Policy": "no-referrer"
      });
      response.end(data);
    });
    return;
  }

  if (request.method === "POST" && url === "/api/admin/login") {
    let body = "";
    request.setEncoding("utf8");
    request.on("data", (chunk) => { body += chunk; });
    request.on("end", () => {
      if (!adminUsername || !adminPassword) {
        sendJson(response, 503, { status: "unconfigured" });
        return;
      }

      if (Date.now() < adminLockedUntil) {
        sendJson(response, 423, { status: "locked", remainingAttempts: 0 });
        return;
      }

      let payload = {};
      try { payload = JSON.parse(body || "{}"); } catch {}

      if (payload.username === adminUsername && payload.password === adminPassword) {
        adminFailedAttempts = 0;
        const token = `admin-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
        adminSessions.set(token, Date.now());
        sendJson(response, 200, { status: "authorized" }, {
          "Set-Cookie": `studio_admin=${encodeURIComponent(token)}; HttpOnly; SameSite=Strict; Path=/; Max-Age=28800${secureCookies ? "; Secure" : ""}`
        });
        return;
      }

      adminFailedAttempts += 1;
      if (adminFailedAttempts >= 4) {
        adminLockedUntil = Date.now() + 15 * 60 * 1000;
        sendJson(response, 423, { status: "locked", remainingAttempts: 0 });
      } else {
        sendJson(response, 401, { status: "invalid", remainingAttempts: 4 - adminFailedAttempts });
      }
    });
    return;
  }

  if (url.startsWith("/api/admin/")) {
    if (!isAdminSession(request)) {
      sendJson(response, 403, { status: "forbidden" });
      return;
    }

    if (request.method === "POST" && url === "/api/admin/logout") {
      const token = getCookies(request)["studio_admin"];
      adminSessions.delete(token);
      sendJson(response, 200, { status: "logged-out" }, {
        "Set-Cookie": `studio_admin=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0${secureCookies ? "; Secure" : ""}`
      });
      return;
    }

    if (request.method === "GET" && url === "/api/admin/status") {
      sendJson(response, 200, { status: "authorized" });
      return;
    }

    if (request.method === "GET" && url === "/api/admin/submissions") {
      fs.readFile(submissionsFile, "utf8", (error, data) => {
        if (error && error.code !== "ENOENT") {
          sendJson(response, 500, { status: "error" });
          return;
        }
        const submissions = (data || "")
          .split("\n")
          .filter(Boolean)
          .map((line) => { try { return JSON.parse(line); } catch { return null; } })
          .filter(Boolean)
          .reverse();
        sendJson(response, 200, { status: "ok", submissions });
      });
      return;
    }

    if (request.method === "GET" && url === "/api/admin/products") {
      fs.readFile(productsFile, "utf8", (error, data) => {
        if (error) {
          sendJson(response, 500, { status: "error" });
          return;
        }
        try {
          sendJson(response, 200, { status: "ok", products: JSON.parse(data) });
        } catch {
          sendJson(response, 500, { status: "error" });
        }
      });
      return;
    }

    if (request.method === "POST" && url === "/api/admin/products") {
      let body = "";
      request.setEncoding("utf8");
      request.on("data", (chunk) => {
        body += chunk;
        if (body.length > 5000000) request.destroy();
      });
      request.on("end", () => {
        try {
          const payload = JSON.parse(body || "{}");
          const name = String(payload.name || "").trim();
          const category = String(payload.category || "").trim();
          const detail = String(payload.detail || "").trim();
          const price = Number(payload.price);
          const image = String(payload.image || "").trim();
          if (!name || !category || !detail || !Number.isFinite(price) || price < 0 || !image) {
            sendJson(response, 400, { status: "invalid", message: "Complete all fields and add an image." });
            return;
          }

          const products = JSON.parse(fs.readFileSync(productsFile, "utf8"));
          const number = products.length + 1;
          const product = {
            id: `item-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
            name,
            category,
            detail,
            price,
            label: String(number).padStart(3, "0"),
            image
          };
          products.push(product);
          fs.writeFileSync(productsFile, JSON.stringify(products, null, 2), "utf8");
          sendJson(response, 200, { status: "ok", product });
        } catch {
          sendJson(response, 400, { status: "invalid" });
        }
      });
      return;
    }

    if (request.method === "DELETE" && url.startsWith("/api/admin/products/")) {
      const productId = decodeURIComponent(url.slice("/api/admin/products/".length));
      try {
        const products = JSON.parse(fs.readFileSync(productsFile, "utf8"));
        const remaining = products.filter((product) => product.id !== productId);
        if (remaining.length === products.length) {
          sendJson(response, 404, { status: "not-found" });
          return;
        }
        fs.writeFileSync(productsFile, JSON.stringify(remaining, null, 2), "utf8");
        sendJson(response, 200, { status: "ok" });
      } catch {
        sendJson(response, 500, { status: "error" });
      }
      return;
    }
  }

  if (request.method === "GET" && url === "/api/products") {
    fs.readFile(productsFile, "utf8", (error, data) => {
      if (error) {
        sendJson(response, 500, { status: "error" });
        return;
      }
      try {
        sendJson(response, 200, { status: "ok", products: JSON.parse(data) });
      } catch {
        sendJson(response, 500, { status: "error" });
      }
    });
    return;
  }

  if (request.method === "POST" && request.url === "/api/demo/process") {
    let body = "";
    request.setEncoding("utf8");
    request.on("data", (chunk) => {
      body += chunk;
      if (body.length > 100000) request.destroy();
    });
    request.on("end", () => {
      try {
        const payload = JSON.parse(body || "{}");
        const reference = `LOCAL-${Date.now().toString(36).toUpperCase()}`;
        const record = {
          reference,
          receivedAt: new Date().toISOString(),
          sessionId: payload.sessionId || "unknown-viewer",
          theme: payload.theme || "day",
          items: Array.isArray(payload.items) ? payload.items : [],
          subtotal: Number(payload.subtotal) || 0
        };
        fs.appendFileSync(submissionsFile, `${JSON.stringify(record)}\n`, "utf8");
        sendJson(response, 200, { reference, status: "processed", received: record.items.length });
      } catch {
        sendJson(response, 400, { status: "invalid", message: "Could not process demo payload." });
      }
    });
    return;
  }

  if (request.method === "GET" && request.url === "/api/demo/status") {
    sendJson(response, 200, { status: "ready", storage: "server-data/submissions.jsonl" });
    return;
  }

  const requestedPath = request.url === "/" ? "/index.html" : request.url.split("?")[0];
  const filePath = path.resolve(root, `.${requestedPath}`);
  if (!filePath.startsWith(root)) {
    response.writeHead(403).end("Forbidden");
    return;
  }

  fs.readFile(filePath, (error, data) => {
    if (error) {
      response.writeHead(error.code === "ENOENT" ? 404 : 500).end(error.code === "ENOENT" ? "Not found" : "Server error");
      return;
    }
    const extension = path.extname(filePath).toLowerCase();
    response.writeHead(200, { "Content-Type": mimeTypes[extension] || "application/octet-stream" });
    response.end(data);
  });
});

server.listen(port, "0.0.0.0", () => {
  console.log(`Demo Shop listening on port ${port}`);
  if (!adminUsername || !adminPassword) {
    console.warn("Admin login is disabled: set ADMIN_USERNAME and ADMIN_PASSWORD to enable it.");
  }
});
