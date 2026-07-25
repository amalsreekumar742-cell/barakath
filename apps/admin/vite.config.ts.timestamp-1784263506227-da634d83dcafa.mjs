// vite.config.ts
import { defineConfig } from "file:///D:/Totalx/Barakath/node_modules/.pnpm/vitest@2.1.9_@types+node@22.20.1_jsdom@25.0.1_lightningcss@1.32.0/node_modules/vitest/dist/config.js";
import react from "file:///D:/Totalx/Barakath/node_modules/.pnpm/@vitejs+plugin-react@4.7.0_vite@5.4.21_@types+node@22.20.1_lightningcss@1.32.0_/node_modules/@vitejs/plugin-react/dist/index.js";
import tailwindcss from "file:///D:/Totalx/Barakath/node_modules/.pnpm/@tailwindcss+vite@4.3.3_vite@5.4.21_@types+node@22.20.1_lightningcss@1.32.0_/node_modules/@tailwindcss/vite/dist/index.mjs";
import path from "node:path";
var __vite_injected_original_dirname = "D:\\Totalx\\Barakath\\apps\\admin";
var vite_config_default = defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__vite_injected_original_dirname, "./src")
    }
  },
  server: {
    port: 5173
  },
  build: {
    outDir: "dist"
  },
  // Vitest config (per the skill's per-feature test rule): jsdom for component/slice tests, globals
  // so describe/it/expect need no import, and a setup file that wires jest-dom matchers.
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./src/testing/setup.ts"],
    css: false
  }
});
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCJEOlxcXFxUb3RhbHhcXFxcQmFyYWthdGhcXFxcYXBwc1xcXFxhZG1pblwiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9maWxlbmFtZSA9IFwiRDpcXFxcVG90YWx4XFxcXEJhcmFrYXRoXFxcXGFwcHNcXFxcYWRtaW5cXFxcdml0ZS5jb25maWcudHNcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfaW1wb3J0X21ldGFfdXJsID0gXCJmaWxlOi8vL0Q6L1RvdGFseC9CYXJha2F0aC9hcHBzL2FkbWluL3ZpdGUuY29uZmlnLnRzXCI7aW1wb3J0IHsgZGVmaW5lQ29uZmlnIH0gZnJvbSAndml0ZXN0L2NvbmZpZyc7XG5pbXBvcnQgcmVhY3QgZnJvbSAnQHZpdGVqcy9wbHVnaW4tcmVhY3QnO1xuaW1wb3J0IHRhaWx3aW5kY3NzIGZyb20gJ0B0YWlsd2luZGNzcy92aXRlJztcbmltcG9ydCBwYXRoIGZyb20gJ25vZGU6cGF0aCc7XG5cbi8vIFZpdGUgY29uZmlnIGZvciB0aGUgQmFyYWthdGggYWRtaW4gU1BBLlxuLy8gV0hZIEB0YWlsd2luZGNzcy92aXRlOiBUYWlsd2luZCB2NCBpcyBDU1MtZmlyc3QgKG5vIHRhaWx3aW5kLmNvbmZpZy5qcykgXHUyMDE0IHRoZSBWaXRlIHBsdWdpbiBpcyB0aGVcbi8vICAgc3VwcG9ydGVkIHdheSB0byB3aXJlIFRhaWx3aW5kIGludG8gYSBWaXRlIGJ1aWxkLCByZXBsYWNpbmcgdGhlIG9sZCBQb3N0Q1NTIHNldHVwLlxuZXhwb3J0IGRlZmF1bHQgZGVmaW5lQ29uZmlnKHtcbiAgcGx1Z2luczogW3JlYWN0KCksIHRhaWx3aW5kY3NzKCldLFxuICByZXNvbHZlOiB7XG4gICAgYWxpYXM6IHtcbiAgICAgICdAJzogcGF0aC5yZXNvbHZlKF9fZGlybmFtZSwgJy4vc3JjJyksXG4gICAgfSxcbiAgfSxcbiAgc2VydmVyOiB7XG4gICAgcG9ydDogNTE3MyxcbiAgfSxcbiAgYnVpbGQ6IHtcbiAgICBvdXREaXI6ICdkaXN0JyxcbiAgfSxcbiAgLy8gVml0ZXN0IGNvbmZpZyAocGVyIHRoZSBza2lsbCdzIHBlci1mZWF0dXJlIHRlc3QgcnVsZSk6IGpzZG9tIGZvciBjb21wb25lbnQvc2xpY2UgdGVzdHMsIGdsb2JhbHNcbiAgLy8gc28gZGVzY3JpYmUvaXQvZXhwZWN0IG5lZWQgbm8gaW1wb3J0LCBhbmQgYSBzZXR1cCBmaWxlIHRoYXQgd2lyZXMgamVzdC1kb20gbWF0Y2hlcnMuXG4gIHRlc3Q6IHtcbiAgICBnbG9iYWxzOiB0cnVlLFxuICAgIGVudmlyb25tZW50OiAnanNkb20nLFxuICAgIHNldHVwRmlsZXM6IFsnLi9zcmMvdGVzdGluZy9zZXR1cC50cyddLFxuICAgIGNzczogZmFsc2UsXG4gIH0sXG59KTtcbiJdLAogICJtYXBwaW5ncyI6ICI7QUFBbVIsU0FBUyxvQkFBb0I7QUFDaFQsT0FBTyxXQUFXO0FBQ2xCLE9BQU8saUJBQWlCO0FBQ3hCLE9BQU8sVUFBVTtBQUhqQixJQUFNLG1DQUFtQztBQVF6QyxJQUFPLHNCQUFRLGFBQWE7QUFBQSxFQUMxQixTQUFTLENBQUMsTUFBTSxHQUFHLFlBQVksQ0FBQztBQUFBLEVBQ2hDLFNBQVM7QUFBQSxJQUNQLE9BQU87QUFBQSxNQUNMLEtBQUssS0FBSyxRQUFRLGtDQUFXLE9BQU87QUFBQSxJQUN0QztBQUFBLEVBQ0Y7QUFBQSxFQUNBLFFBQVE7QUFBQSxJQUNOLE1BQU07QUFBQSxFQUNSO0FBQUEsRUFDQSxPQUFPO0FBQUEsSUFDTCxRQUFRO0FBQUEsRUFDVjtBQUFBO0FBQUE7QUFBQSxFQUdBLE1BQU07QUFBQSxJQUNKLFNBQVM7QUFBQSxJQUNULGFBQWE7QUFBQSxJQUNiLFlBQVksQ0FBQyx3QkFBd0I7QUFBQSxJQUNyQyxLQUFLO0FBQUEsRUFDUDtBQUNGLENBQUM7IiwKICAibmFtZXMiOiBbXQp9Cg==
