// Assembles the static site in _site/ for GitHub Pages:
//   - inlines live data into index.html (zero latency on first load)
//   - prerenders both major headlines and hyper-local district reports
//   - fills in canonical URLs, JSON-LD dataset schemas, and sitemap.xml
//
// Architected & Developed by Kaushal (@kaushalboii)

import fs from "node:fs/promises";

const repo = process.env.GITHUB_REPOSITORY || "kaushalboii/Live-news-updated-India";
const [owner, name] = repo.split("/");
let SITE_URL = process.env.SITE_URL || (owner ? `https://${owner.toLowerCase()}.github.io/${name}/` : "http://localhost:3000/");
if (!SITE_URL.endsWith("/")) SITE_URL += "/";

const readJSON = async (p, fb) => { try { return JSON.parse(await fs.readFile(p, "utf8")); } catch { return fb; } };
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const inlineJSON = (o) => JSON.stringify(o).replace(/</g, "\\u003c");
const fmtDate = (d) => new Date(d + "T00:00:00Z").toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

const curated = await readJSON("data/curated.json", { events: [] });
const live = await readJSON("data/live.json", { generatedAt: null, clusters: [] });
const now = new Date().toISOString();

const allClean = live.clusters.filter((c) => c.title && !/^cbmi/i.test(c.title));
const latestDate = live.clusters.reduce((max, c) => (c.date > max ? c.date : max), "");
const todayItems = allClean.filter((c) => c.date >= latestDate);
const otherItems = allClean.filter((c) => c.date < latestDate);
const items = (todayItems.length > 0 ? todayItems.concat(otherItems) : otherItems).slice(0, 150).map((c) => {
  const nOut = c.outlets || (c.domains || []).length || 1;
  const pubList = (c.publishers || []).length ? c.publishers : (c.domains || []).map((d) => d);
  const urls = (c.urls || []).filter((u) => /^https?:/.test(u));
  const sources = urls.map((u, i) => {
    let name = pubList[i];
    try { if (!name) name = new URL(u).hostname.replace(/^www\./, ""); } catch { name = "Source"; }
    const isYtUrl = u.includes("youtube.com") || u.includes("youtu.be");
    const isSocUrl = u.includes("twitter.com") || u.includes("x.com");
    if (isYtUrl && !name.toLowerCase().includes("youtube")) name += " (YouTube)";
    else if (isSocUrl && !name.toLowerCase().includes("x") && !name.toLowerCase().includes("twitter")) name += " (X)";
    return { n: name, u, isYt: isYtUrl, isSoc: isSocUrl };
  });

  const hasYtUrl = sources.some((s) => s.isYt);
  const hasSocUrl = sources.some((s) => s.isSoc);
  const hasYtPub = pubList.some((p) => p && /youtube/i.test(p));
  const hasSocPub = pubList.some((p) => p && /(twitter|\bx\b|social wire)/i.test(p));

  let tag;
  let tagClass = "";
  if (nOut >= 3) {
    tag = `🌐 ${nOut} News Outlets`;
    tagClass = "multi";
  } else if (c.platform === "youtube" || hasYtUrl || (nOut <= 2 && hasYtPub)) {
    tag = "📺 YouTube";
    tagClass = "yt";
  } else if (c.platform === "social" || hasSocUrl || (nOut <= 2 && hasSocPub)) {
    tag = "𝕏 Social";
    tagClass = "soc";
  } else if (nOut === 2) {
    tag = "🌐 2 News Sources";
    tagClass = "multi";
  } else if (c.isLocal || nOut === 1) {
    tag = "📍 Local District";
    tagClass = "local";
  } else {
    tag = "⚡ Wire Report";
    tagClass = "wire";
  }

  const pub = pubList[0] || (urls[0] ? new URL(urls[0]).hostname.replace(/^www\./, "") : "Regional wire");

  return {
    id: c.id,
    title: c.title,
    place: c.place,
    date: c.date,
    summary: nOut === 1
      ? `Reported via ${pub} (${c.articles} report${c.articles === 1 ? '' : 's'}).`
      : `Covered across ${c.articles} report${c.articles === 1 ? '' : 's'} from ${nOut} news outlets including ${pubList.slice(0, 3).join(', ')}.`,
    sources,
    tag,
    tagClass,
    movement: c.movement || "other"
  };
});

const listHTML = items.map((e) => `<article class="item" data-id="${esc(e.id)}"><span class="bar"></span><span><h2 class="h">${esc(e.title)}</h2>`
  + `<span class="meta">${esc(e.place)} · <time datetime="${e.date}">${fmtDate(e.date)}</time>${e.tag ? `<span class="tag ${e.tagClass}">${esc(e.tag)}</span>` : ""}</span>`
  + (e.summary ? `<span class="detail" style="display:block"><p>${esc(e.summary)}</p><p class="src">Source${e.sources.length > 1 ? "s" : ""}: ${e.sources.map((s) => `<a href="${esc(s.u)}" target="_blank" rel="noopener nofollow">${esc(s.n)}</a>`).join(", ")}</p></span>` : "")
  + `</span></article>`).join("");

const jsonld = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebSite", "@id": SITE_URL + "#site", url: SITE_URL, name: "Where India is in the news", inLanguage: "en-IN",
      description: "Real-time interactive geotagged news tracker across India — YouTube video broadcasts, X dispatches, and local district news.",
      author: { "@type": "Person", name: "Kaushal", url: "https://github.com/kaushalboii" }
    },
    {
      "@type": "Dataset", "@id": SITE_URL + "#data", name: "India Live News Detections Dataset",
      description: "Real-time news events located across India, ingested from GDELT 2.0 Global Event Stream, YouTube video broadcasts, X breaking feeds, and regional press.",
      url: SITE_URL, isAccessibleForFree: true, dateModified: live.generatedAt || now,
      spatialCoverage: { "@type": "Place", name: "India" },
      license: "https://creativecommons.org/licenses/by/4.0/",
      creator: { "@type": "Person", name: "Kaushal (@kaushalboii)", url: "https://github.com/kaushalboii" },
      distribution: [
        { "@type": "DataDownload", encodingFormat: "application/json", contentUrl: SITE_URL + "data/live.json" },
      ],
    },
  ],
};

let html = await fs.readFile("index.html", "utf8");
const replaceOnce = (token, value) => {
  if (!html.includes(token)) throw new Error(`index.html is missing ${token}`);
  html = html.split(token).join(value);
};
replaceOnce("__SITE_URL__", SITE_URL);
replaceOnce("__JSONLD__", inlineJSON(jsonld));
replaceOnce("__BOOT__", inlineJSON({ curated: { updated: "2026-11-01", events: [] }, live }));
replaceOnce("<!--LIST-->", listHTML);

await fs.rm("_site", { recursive: true, force: true });
await fs.mkdir("_site/data", { recursive: true });
await fs.writeFile("_site/index.html", html);
for (const f of ["data/curated.json", "data/live.json", "favicon.svg", "og.png", "apple-touch-icon.png"]) {
  await fs.copyFile(f, `_site/${f}`).catch(() => {});
}
await fs.writeFile("_site/sitemap.xml",
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`
  + `  <url><loc>${SITE_URL}</loc><lastmod>${(live.generatedAt || now).slice(0, 10)}</lastmod><changefreq>hourly</changefreq></url>\n</urlset>\n`);
await fs.writeFile("_site/.nojekyll", "");

const { buildCommand, installCommand, outputDirectory, framework, ...vercel } = await readJSON("vercel.json", {});
await fs.writeFile("_site/vercel.json", JSON.stringify(vercel, null, 2));

const kb = (await fs.stat("_site/index.html")).size / 1024;
console.log(`Built _site for ${SITE_URL} (index.html ${kb.toFixed(0)} KB, ${items.length} 100% live prerendered news entries)`);
