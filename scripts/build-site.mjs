// Assembles the static site in _site/ for GitHub Pages & Vercel:
//   - inlines curated + live news data into index.html
//   - prerenders the latest news into the list for SEO and crawlers
//   - sets up canonical URLs, structured JSON-LD and sitemap.xml

import fs from "node:fs/promises";

const repo = process.env.GITHUB_REPOSITORY || "kaushalboii/Live-news-updated-India";
const [owner, name] = repo.split("/");
let SITE_URL = process.env.SITE_URL || (owner ? `https://${owner.toLowerCase()}.github.io/${name}/` : "http://localhost:3000/");
if (!SITE_URL.endsWith("/")) SITE_URL += "/";

const readJSON = async (p, fb) => {
  try { return JSON.parse(await fs.readFile(p, "utf8")); } catch { return fb; }
};
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
}[c]));
const inlineJSON = (o) => JSON.stringify(o).replace(/</g, "\\u003c");
const fmtDate = (d) => new Date(d + "T00:00:00Z").toLocaleDateString("en-IN", {
  day: "numeric", month: "short", year: "numeric", timeZone: "UTC"
});

const curated = await readJSON("data/curated.json", { events: [] });
const live = await readJSON("data/live.json", { generatedAt: null, clusters: [] });
const now = new Date().toISOString();

// Prerender recent curated events and top live clusters
const cutoff = new Date(Date.now() - 7 * 864e5).toISOString().slice(0, 10);
const items = [
  ...curated.events.filter((e) => e.date >= cutoff || e.ongoing).map((e) => ({
    title: e.title,
    place: [e.city, e.venue].filter(Boolean).join(", "),
    date: e.date,
    category: e.category || "general",
    summary: e.summary,
    sources: e.sources || [],
    tag: "Curated",
  })),
  ...live.clusters.filter((c) => c.title && c.articles >= 2).slice(0, 45).map((c) => ({
    title: c.title,
    place: c.place,
    date: c.date,
    category: c.category || "general",
    summary: `${c.articles} news articles reported across ${c.outlets} outlets.`,
    sources: (c.urls || []).map((u) => {
      try { return { n: new URL(u).hostname.replace(/^www\./, ""), u }; }
      catch { return { n: "Source", u }; }
    }),
    tag: "Live Detection",
  })),
];

const listHTML = items.map((e) => `
<article class="item" data-cat="${esc(e.category)}">
  <span class="bar cat-${esc(e.category)}"></span>
  <div class="content">
    <div class="meta-top">
      <span class="badge cat-${esc(e.category)}">${esc(e.category.toUpperCase())}</span>
      <span class="loc">${esc(e.place)}</span>
      <time datetime="${e.date}">${fmtDate(e.date)}</time>
      ${e.tag ? `<span class="tag-pill">${esc(e.tag)}</span>` : ""}
    </div>
    <h2 class="h">${esc(e.title)}</h2>
    ${e.summary ? `<p class="desc">${esc(e.summary)}</p>` : ""}
    <div class="sources">
      ${e.sources.filter((s) => /^https?:/.test(s.u)).map((s) => `<a href="${esc(s.u)}" target="_blank" rel="noopener nofollow">${esc(s.n)}</a>`).join(" · ")}
    </div>
  </div>
</article>`).join("\n");

const jsonld = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebSite",
      "@id": SITE_URL + "#site",
      "url": SITE_URL,
      "name": "Live News Updated India",
      "inLanguage": "en-IN",
      "description": "A live interactive geotagged map and real-time news tracker across India, updated every 15 minutes."
    },
    {
      "@type": "Dataset",
      "@id": SITE_URL + "#data",
      "name": "India Live News & Geotagged Events",
      "description": "Geocoded news reports, breaking events and civic developments across India from GDELT 2.0 and verified Indian news outlets.",
      "url": SITE_URL,
      "isAccessibleForFree": true,
      "dateModified": live.generatedAt || now,
      "spatialCoverage": { "@type": "Place", "name": "India" },
      "temporalCoverage": `${cutoff}/..`,
      "license": "https://creativecommons.org/licenses/by/4.0/",
      "creator": { "@type": "Organization", "name": "Live News Updated India Contributors" },
      "distribution": [
        { "@type": "DataDownload", "encodingFormat": "application/json", "contentUrl": SITE_URL + "data/live.json" },
        { "@type": "DataDownload", "encodingFormat": "application/json", "contentUrl": SITE_URL + "data/curated.json" }
      ]
    }
  ]
};

let html = await fs.readFile("index.html", "utf8");
const replaceOnce = (token, value) => {
  if (!html.includes(token)) throw new Error(`index.html is missing placeholder: ${token}`);
  html = html.split(token).join(value);
};

replaceOnce("__SITE_URL__", SITE_URL);
replaceOnce("__JSONLD__", inlineJSON(jsonld));
replaceOnce("__BOOT__", inlineJSON({ curated, live }));
replaceOnce("<!--LIST-->", listHTML);

await fs.rm("_site", { recursive: true, force: true });
await fs.mkdir("_site/data", { recursive: true });
await fs.writeFile("_site/index.html", html);

for (const f of ["data/curated.json", "data/live.json", "favicon.svg", "og.png", "apple-touch-icon.png"]) {
  await fs.copyFile(f, `_site/${f}`).catch(() => console.warn(`Note: Optional asset ${f} skipped`));
}

await fs.writeFile("_site/sitemap.xml",
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`
  + `  <url><loc>${SITE_URL}</loc><lastmod>${(live.generatedAt || now).slice(0, 10)}</lastmod><changefreq>hourly</changefreq></url>\n</urlset>\n`);

await fs.writeFile("_site/.nojekyll", "");

const { buildCommand, installCommand, outputDirectory, framework, ...vercel } = await readJSON("vercel.json", {});
await fs.writeFile("_site/vercel.json", JSON.stringify(vercel, null, 2));

const kb = (await fs.stat("_site/index.html")).size / 1024;
console.log(`Successfully built _site for ${SITE_URL} (index.html ${kb.toFixed(0)} KB, ${items.length} prerendered news items)`);
