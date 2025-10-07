# Enabling COOP/COEP for WebAssembly Threads

ONNX Runtime Web's threaded WebAssembly backend requires cross‑origin isolation so that `SharedArrayBuffer` is available. Without it, the browser aborts the module (commonly observed as `Aborted()` during session creation) and CPU inference fails while WebGPU may still work.

## Required response headers

Set these headers on all responses:

```
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: require-corp
Cross-Origin-Resource-Policy: same-origin
X-Content-Type-Options: nosniff
```

## Local dev / preview

`vite.config.ts` already applies the above headers in both `server.headers` and `preview.headers`. Ensure you access the app via HTTPS (the project uses `@vitejs/plugin-basic-ssl`).

## Production

- Netlify / Cloudflare Pages: a `public/_headers` file is included and will be copied to the publish directory to apply the headers for all routes.
- Vercel: if you ever move to Vercel again, add a root-level `vercel.json` with equivalent header rules.
- Other hosts (Nginx/Apache/CDN): configure the same headers globally (or at least for HTML/JS/WASM files).

If you cannot set these headers (e.g., GitHub Pages), the WASM backend may abort. As a workaround, either use the WebGPU backend or configure ONNX Runtime Web to run single‑threaded (reduced performance).

