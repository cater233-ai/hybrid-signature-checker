/**
 * server.mjs - serve the checker page and proxy chain reads.
 *
 *   node web/server.mjs          (PORT env var, default 8080)
 *
 * Browsers cannot call the testnet REST endpoint directly (it sends no
 * CORS headers), so - as the official templates do - the page reads chain
 * data through a same-origin /lcd proxy. Node's standard library only:
 * no dependencies, and the proxy is read-only GET forwarding.
 */
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";

const REST = "https://api-testnet.qore.host";
const page = await readFile(new URL("./index.html", import.meta.url), "utf8");

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", "http://localhost");

  if (url.pathname === "/") {
    res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    res.end(page);
    return;
  }

  if (url.pathname.startsWith("/lcd/") && req.method === "GET") {
    try {
      const upstream = await fetch(REST + url.pathname.slice(4) + url.search);
      const body = await upstream.text();
      res.writeHead(upstream.status, { "content-type": upstream.headers.get("content-type") ?? "application/json" });
      res.end(body);
    } catch {
      res.writeHead(502, { "content-type": "text/plain" });
      res.end("chain endpoint unreachable");
    }
    return;
  }

  res.writeHead(404, { "content-type": "text/plain" });
  res.end("not found");
});

const port = Number(process.env.PORT ?? 8080);
server.listen(port, () => {
  console.log(`Hybrid Signature Checker at http://localhost:${port}`);
});
