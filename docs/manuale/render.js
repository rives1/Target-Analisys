const { chromium } = require("playwright");
const path = require("path");
const { pathToFileURL } = require("url");
const fs = require("fs");
const D = __dirname, pages = process.argv[2] ? JSON.parse(fs.readFileSync(process.argv[2], "utf8")) : {};
(async () => {
  const b = await chromium.launch(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {});
  const p = await b.newPage();
  await p.goto(pathToFileURL(path.join(D, "manuale.html")).href, { waitUntil: "load" });
  await p.evaluate(pages => {
    const toc = document.getElementById("toc");
    document.querySelectorAll("h1.chap, h1.chap ~ h2").forEach((h, i) => {
      if (!h.id) h.id = "h" + i;
      const sub = h.tagName === "H2", text = sub ? h.textContent : h.textContent.replace(/^\d+/, m => m + ". ");
      const li = document.createElement("li"); if (sub) li.className = "sub";
      li.innerHTML = `<a href="#${h.id}">${text}</a><span class="dots"></span><span class="pg">${pages[h.id] || ""}</span>`;
      toc.appendChild(li);
    });
  }, pages);
  const heads = await p.evaluate(() => [...document.querySelectorAll("h1.chap, h1.chap ~ h2")].map(h => ({ id: h.id, text: h.textContent.replace(/^\d+/, "").trim(), chap: h.tagName === "H1" })));
  fs.writeFileSync(path.join(D, "heads.json"), JSON.stringify(heads));
  await p.pdf({ path: path.join(D, "manuale.pdf"), format: "A4", printBackground: true, displayHeaderFooter: true, preferCSSPageSize: true,
    headerTemplate: "<span></span>",
    footerTemplate: '<div style="width:100%;font-size:8px;color:#7b8794;font-family:Arial;padding:0 17mm;display:flex;justify-content:space-between"><span>Shoot Analyzer · Manuale d\'uso v1.20</span><span class="pageNumber"></span></div>' });
  await b.close();
})();
