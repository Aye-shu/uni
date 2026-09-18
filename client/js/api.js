// client/js/api.js
// Global API base resolver + fetch patcher

const API_BASE =
  window.location.hostname === "localhost" ||
  window.location.hostname === "127.0.0.1"
    ? "http://localhost:5000"
    : "https://uni-e7l7.onrender.com";

// Make it available globally
window.API_BASE = API_BASE;

// Patch fetch so any relative /api/... call goes to Render
const originalFetch = window.fetch.bind(window);
window.fetch = function (input, init) {
  if (typeof input === "string" && input.startsWith("/api/")) {
    input = API_BASE + input;
  } else if (input instanceof Request && input.url.startsWith("/api/")) {
    input = new Request(API_BASE + new URL(input.url, window.location.origin).pathname + new URL(input.url, window.location.origin).search, input);
  }
  return originalFetch(input, init);
};

console.log("🌐 API base set to:", API_BASE);