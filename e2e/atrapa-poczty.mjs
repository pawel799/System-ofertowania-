// Atrapa serwera poczty do testów E2E: przyjmuje maile jak mail-relay (POST /emails) i oddaje je testom
// (GET /maile – lista, DELETE /maile – czyszczenie). Uruchamiana przez playwright.config.ts.
import http from "node:http";

const maile = [];
http
  .createServer((req, res) => {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      res.setHeader("content-type", "application/json");
      if (req.method === "POST" && req.url === "/emails") {
        try {
          maile.push({ ...JSON.parse(body), at: Date.now() });
        } catch {
          res.statusCode = 400;
          return res.end('{"error":"json"}');
        }
        return res.end('{"id":"atrapa"}');
      }
      if (req.url === "/maile" && req.method === "GET") return res.end(JSON.stringify(maile));
      if (req.url === "/maile" && req.method === "DELETE") {
        maile.length = 0;
        return res.end("{}");
      }
      res.statusCode = req.url === "/" ? 200 : 404;
      res.end("{}");
    });
  })
  .listen(Number(process.env.PORT_POCZTY ?? 8799));
