// client/js/api.js
// Global API base resolver + fetch patcher

const API_BASE =
  window.location.hostname === "localhost" ||
  window.location.hostname === "127.0.0.1"
    ? "http://localhost:5000"
    : "https://uni-e7l7.onrender.com";

// Make it available globally
window.API_BASE = API_BASE;

// Patch fetch so any relative /api/... call goes to the API host
const originalFetch = window.fetch.bind(window);

window.fetch = function (input, init) {
  // Handle string URLs only — that's all this project uses.
  if (typeof input === "string") {
    try {
      const parsed = new URL(input, window.location.origin);
      if (
        parsed.pathname.startsWith("/api/") &&
        !parsed.href.startsWith(API_BASE)
      ) {
        input = API_BASE + parsed.pathname + parsed.search;
      }
    } catch {
      // Not a parseable URL — pass through untouched
    }
  }

  return originalFetch(input, init);
};

console.log("🌐 API base set to:", API_BASE);