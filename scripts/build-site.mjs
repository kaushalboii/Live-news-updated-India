// Assembles the static site in _site/ for GitHub Pages:
//   - inlines live data into index.html (zero latency on first load)
//   - prerenders both major headlines and hyper-local district reports
//   - generates dedicated isolated state pages for all 37 Indian States and UTs (e.g. /tamilnadu, /karnataka, /delhi, etc.)
//   - fills in canonical URLs, JSON-LD dataset schemas, and sitemap.xml
//
// Architected & Developed by Kaushal (@kaushalboii)

import fs from "node:fs/promises";
import path from "node:path";

const repo = process.env.GITHUB_REPOSITORY || "kaushalboii/Live-news-updated-India";
const [owner, name] = repo.split("/");
let SITE_URL = process.env.SITE_URL || (owner ? `https://${owner.toLowerCase()}.github.io/${name}/` : "http://localhost:3000/");
if (!SITE_URL.endsWith("/")) SITE_URL += "/";

const readJSON = async (p, fb) => { try { return JSON.parse(await fs.readFile(p, "utf8")); } catch { return fb; } };
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const inlineJSON = (o) => JSON.stringify(o).replace(/</g, "\\u003c");
const fmtDate = (d) => new Date(d + "T00:00:00Z").toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
const cleanUrl = (u) => {
  if (!u) return "";
  let clean = String(u).trim().replace(/^<!\[CDATA\[([\s\S]*?)\]\]>$/i, "$1").trim();
  return /^https?:\/\//i.test(clean) ? clean : "";
};

const curated = await readJSON("data/curated.json", { events: [] });
const live = await readJSON("data/live.json", { generatedAt: null, clusters: [] });
const states = await readJSON("data/states.json", []);
const now = new Date().toISOString();

const VB0 = { x: -30, y: -90, w: 1060, h: 1284 };
const aspect = VB0.w / VB0.h;

function getStateViewBox(st) {
  if (!st || !st.bbox) return `${VB0.x} ${VB0.y} ${VB0.w} ${VB0.h}`;
  const padFactor = 1.35;
  const targetW = st.bbox.w * padFactor;
  const targetH = st.bbox.h * padFactor;
  let w, h;
  if (targetW / targetH > aspect) {
    w = targetW;
    h = w / aspect;
  } else {
    h = targetH;
    w = h * aspect;
  }
  const cx = st.bbox.x + st.bbox.w / 2;
  const cy = st.bbox.y + st.bbox.h / 2;
  return `${Math.round((cx - w / 2) * 10) / 10} ${Math.round((cy - h / 2) * 10) / 10} ${Math.round(w * 10) / 10} ${Math.round(h * 10) / 10}`;
}

function eventMatchesState(c, st) {
  if (!st) return true;
  const place = (c.place || "").toLowerCase();
  const title = (c.title || "").toLowerCase();
  const sName = st.name.toLowerCase();

  // 1. Direct state name in place (e.g. "Chennai, Tamil Nadu")
  if (place.includes(sName)) return true;

  // 2. City / District keyword in place (e.g. "Chennai", "Coimbatore", "Thoothukudi")
  for (const kw of (st.keywords || [])) {
    if (kw.length >= 3 && place.includes(kw)) return true;
  }

  // 3. Geocoordinates inside state bounds
  if (Number.isFinite(c.lat) && Number.isFinite(c.lng) && st.bounds) {
    const b = st.bounds;
    if (c.lat >= b.latMin && c.lat <= b.latMax && c.lng >= b.lngMin && c.lng <= b.lngMax) {
      const hasOtherStateInPlace = states.some(os => os.name !== st.name && place.includes(os.name.toLowerCase()));
      if (!hasOtherStateInPlace) return true;
    }
  }

  // 4. Mention of state in title, but ONLY if place does not explicitly name another state
  const hasOtherStateInPlace = states.some(os => os.name !== st.name && place.includes(os.name.toLowerCase()));
  if (!hasOtherStateInPlace && (title.includes(sName) || (st.slug === "tamilnadu" && (title.includes("tamil nadu") || title.includes("tamilnadu"))))) {
    return true;
  }

  return false;
}

const allClean = live.clusters.filter((c) => c.title && !/^cbmi/i.test(c.title));

function formatCluster(c) {
  let sources = [];
  if (Array.isArray(c.sources) && c.sources.length) {
    sources = c.sources.filter(s => s && s.u && cleanUrl(s.u)).map(s => {
      let name = s.n || "News Source";
      const u = cleanUrl(s.u);
      const isYtUrl = u.includes("youtube.com") || u.includes("youtu.be");
      const isSocUrl = u.includes("twitter.com") || u.includes("x.com");
      if (isYtUrl && !name.toLowerCase().includes("youtube")) name += " (YouTube)";
      else if (isSocUrl && !name.toLowerCase().includes("x") && !name.toLowerCase().includes("twitter")) name += " (X)";
      return { n: name, u, isYt: isYtUrl, isSoc: isSocUrl };
    });
  } else {
    const urls = (c.urls || []).map(cleanUrl).filter(Boolean);
    sources = urls.map((u, i) => {
      let name = (c.publishers && c.publishers[i]) || "News Source";
      try {
        const host = new URL(u).hostname.replace(/^www\./, "");
        if (host && !host.includes("google.com")) name = host.split(".")[0];
      } catch {}
      const isYtUrl = u.includes("youtube.com") || u.includes("youtu.be");
      const isSocUrl = u.includes("twitter.com") || u.includes("x.com");
      if (isYtUrl && !name.toLowerCase().includes("youtube")) name += " (YouTube)";
      else if (isSocUrl && !name.toLowerCase().includes("x") && !name.toLowerCase().includes("twitter")) name += " (X)";
      return { n: name, u, isYt: isYtUrl, isSoc: isSocUrl };
    });
  }

  const nOut = sources.length || c.outlets || 1;
  const pubList = sources.map(s => s.n);

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

  let pubHost = "Regional wire";
  try {
    const rawU = c.sources?.[0]?.u || c.urls?.[0];
    const u = cleanUrl(rawU);
    if (u) pubHost = new URL(u).hostname.replace(/^www\./, "");
  } catch {}
  const pub = pubList[0] || pubHost;

  const isTamilSource = (c.place || "").includes("Tamil Nadu") ||
    (c.publishers || []).some((p) => /dinamalar|dinamani|thanthi|tamil|polimer|puthiya|vikatan|sun news/i.test(p)) ||
    (c.domains || []).some((d) => /dinamalar|dinamani|thanthi|tamil|polimer|puthiya|vikatan|sun news/i.test(d));

  let title = c.title || "";
  if (/^cbmi/i.test(title) || (!title.includes(" ") && title.length > 25)) title = "";
  if (/[\u0B80-\u0BFF]/.test(title) && !isTamilSource) title = "";
  if (!title) {
    title = `Live news update in ${(c.place || "India").split(",")[0]}`;
  }

  return {
    id: c.id,
    title,
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
}

function renderListHTML(items) {
  if (!items || !items.length) {
    return `<div class="empty">No live reports recorded in this view yet.</div>`;
  }
  return items.map((e) => `<article class="item" data-id="${esc(e.id)}"><span class="bar"></span><span><h2 class="h">${esc(e.title)}</h2>`
    + `<span class="meta">${esc(e.place)} · <time datetime="${e.date}">${fmtDate(e.date)}</time>${e.tag ? `<span class="tag ${e.tagClass}">${esc(e.tag)}</span>` : ""}</span>`
    + (e.summary ? `<span class="detail" style="display:block"><p>${esc(e.summary)}</p><p class="src">Source${e.sources.length > 1 ? "s" : ""}: ${e.sources.map((s) => `<a href="${esc(s.u)}" target="_blank" rel="noopener nofollow" class="source-link">${esc(s.n)} ↗</a>`).join(", ")}</p>${e.sources[0]?.u ? `<p class="open-story"><a href="${esc(e.sources[0].u)}" target="_blank" rel="noopener nofollow" class="open-story-btn">Read full story on ${esc(e.sources[0].n)} ↗</a></p>` : ""}</span>` : "")
    + `</span></article>`).join("");
}

const latestDate = live.clusters.reduce((max, c) => (c.date > max ? c.date : max), "");
const todayItems = allClean.filter((c) => c.date >= latestDate);
const otherItems = allClean.filter((c) => c.date < latestDate);
const nationalClusters = (todayItems.length > 0 ? todayItems.concat(otherItems) : otherItems).slice(0, 150);
const nationalItems = nationalClusters.map(formatCluster);
const nationalListHTML = renderListHTML(nationalItems);

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

let template = await fs.readFile("index.html", "utf8");
const replaceToken = (str, token, value) => {
  if (!str.includes(token)) throw new Error(`index.html is missing ${token}`);
  return str.split(token).join(value);
};

let baseHtml = template;
baseHtml = replaceToken(baseHtml, "__SITE_URL__", SITE_URL);
baseHtml = replaceToken(baseHtml, "__JSONLD__", inlineJSON(jsonld));
baseHtml = replaceToken(baseHtml, "__BOOT__", inlineJSON({ curated: { updated: "2026-11-01", events: [] }, live, states }));

// Prepare output directory
await fs.rm("_site", { recursive: true, force: true });
await fs.mkdir("_site/data", { recursive: true });

// 1. Build Root Page (All India)
const rootHtml = baseHtml.replace("<!--LIST-->", nationalListHTML);
await fs.writeFile("_site/index.html", rootHtml);

// 2. Build Dedicated Pages for all 37 States & Union Territories
const sitemapUrls = [
  `<url><loc>${SITE_URL}</loc><lastmod>${(live.generatedAt || now).slice(0, 10)}</lastmod><changefreq>hourly</changefreq><priority>1.0</priority></url>`
];

let statePagesCount = 0;
for (const s of states) {
  const stateClusters = allClean.filter(c => eventMatchesState(c, s));
  const stateItems = stateClusters.slice(0, 150).map(formatCluster);
  const stateListHTML = renderListHTML(stateItems);
  const placesCount = new Set(stateClusters.map(c => (c.place || "").split(",")[0].trim())).size;

  let stateHtml = baseHtml;
  // Inject initial state configuration
  stateHtml = stateHtml.replace("</head>", `  <script>window.__INITIAL_STATE__ = "${s.slug}";</script>\n</head>`);
  
  // Set title & meta
  stateHtml = stateHtml.replace(
    "<title>Where India is in the news: live news tracker across India</title>",
    `<title>Where ${s.name} is in the news: live events & updates across ${s.name}</title>`
  );
  stateHtml = stateHtml.replace(
    `<meta property="og:title" content="Where India is in the news">`,
    `<meta property="og:title" content="Where ${s.name} is in the news">`
  );
  stateHtml = stateHtml.replace(
    `<meta name="twitter:title" content="Where India is in the news">`,
    `<meta name="twitter:title" content="Where ${s.name} is in the news">`
  );
  stateHtml = stateHtml.replace(
    `<link rel="canonical" href="${SITE_URL}">`,
    `<link rel="canonical" href="${SITE_URL}${s.slug}">`
  );
  stateHtml = stateHtml.replace(
    `<meta property="og:url" content="${SITE_URL}">`,
    `<meta property="og:url" content="${SITE_URL}${s.slug}">`
  );

  // Set initial map SVG viewbox & isolated state classes
  const stateVB = getStateViewBox(s);
  stateHtml = stateHtml.replace(
    `viewBox="-30 -90 1060 1284"`,
    `viewBox="${stateVB}"`
  );
  stateHtml = stateHtml.replace(
    `<g id="states">`,
    `<g id="states" class="isolated">`
  );
  // Add active class to state path
  stateHtml = stateHtml.replace(
    `data-name="${s.name}"`,
    `data-name="${s.name}" class="state active"`
  );

  // Configure State Banner and Selector in HTML
  stateHtml = stateHtml.replace(
    `id="stateBanner" class="state-banner" style="display:none"`,
    `id="stateBanner" class="state-banner" style="display:flex"`
  );
  stateHtml = stateHtml.replace(
    `<h2 class="state-banner-title" id="stateBannerName">Tamil Nadu</h2>`,
    `<h2 class="state-banner-title" id="stateBannerName">${esc(s.name)}</h2>`
  );
  stateHtml = stateHtml.replace(
    `<div class="state-banner-stats" id="stateBannerStats">0 live updates</div>`,
    `<div class="state-banner-stats" id="stateBannerStats">${stateItems.length} live update${stateItems.length === 1 ? '' : 's'} across ${placesCount} place${placesCount === 1 ? '' : 's'}</div>`
  );
  stateHtml = stateHtml.replace(
    `<span id="stateNavLabel" class="state-nav-label">All India</span>`,
    `<span id="stateNavLabel" class="state-nav-label">${esc(s.name)}</span>`
  );
  stateHtml = stateHtml.replace(
    `id="stateNavBtn" class="state-nav-btn"`,
    `id="stateNavBtn" class="state-nav-btn active-state"`
  );

  // Replace prerendered list
  stateHtml = stateHtml.replace("<!--LIST-->", stateListHTML);

  // Generate primary slug files
  const slugDir = path.join("_site", s.slug);
  await fs.mkdir(slugDir, { recursive: true });
  await fs.writeFile(path.join(slugDir, "index.html"), stateHtml);
  await fs.writeFile(path.join("_site", `${s.slug}.html`), stateHtml);
  statePagesCount++;

  sitemapUrls.push(
    `<url><loc>${SITE_URL}${s.slug}</loc><lastmod>${(live.generatedAt || now).slice(0, 10)}</lastmod><changefreq>hourly</changefreq><priority>0.8</priority></url>`
  );

  // Generate alias files (e.g. tamil-nadu, tn, karnataka, etc.)
  for (const alias of (s.aliases || [])) {
    if (/^[a-z0-9-]+$/i.test(alias) && alias.toLowerCase() !== s.slug) {
      const aliasSlug = alias.toLowerCase();
      const aliasDir = path.join("_site", aliasSlug);
      await fs.mkdir(aliasDir, { recursive: true });
      await fs.writeFile(path.join(aliasDir, "index.html"), stateHtml);
      await fs.writeFile(path.join("_site", `${aliasSlug}.html`), stateHtml);
      statePagesCount++;
    }
  }
}

// 3. Generate SPA Fallback Router 404.html
const spa404Html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Redirecting to India News Radar…</title>
  <script>
    (function() {
      var repo = "Live-news-updated-India";
      var p = window.location.pathname;
      var s = window.location.search;
      var h = window.location.hash;
      var clean = p.replace(new RegExp("^/?" + repo + "/?", "i"), "/").replace(/^\\//, "").replace(/\\/$/, "");
      var target = "/" + repo + "/";
      if (clean) {
        target += "?state=" + encodeURIComponent(clean) + (s ? "&" + s.slice(1) : "") + h;
      } else {
        target += s + h;
      }
      window.location.replace(target);
    })();
  </script>
</head>
<body style="background:#0b0f17;color:#f8fafc;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;">
  <p>Connecting to India News Radar…</p>
</body>
</html>`;
await fs.writeFile("_site/404.html", spa404Html);

// 4. Copy static assets and data files
for (const f of ["data/curated.json", "data/live.json", "data/states.json", "favicon.svg", "og.png", "apple-touch-icon.png"]) {
  await fs.copyFile(f, `_site/${f}`).catch(() => {});
}

// 5. Generate sitemap.xml
await fs.writeFile(
  "_site/sitemap.xml",
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`
  + sitemapUrls.map(u => `  ${u}`).join("\n")
  + `\n</urlset>\n`
);

await fs.writeFile("_site/.nojekyll", "");

const { buildCommand, installCommand, outputDirectory, framework, ...vercel } = await readJSON("vercel.json", {});
await fs.writeFile("_site/vercel.json", JSON.stringify(vercel, null, 2));

const kb = (await fs.stat("_site/index.html")).size / 1024;
console.log(`Built _site for ${SITE_URL}`);
console.log(` - Root: index.html (${kb.toFixed(0)} KB, ${nationalItems.length} national news entries)`);
console.log(` - Generated ${statePagesCount} state & alias pages across 37 states & UTs`);
console.log(` - 404 SPA router + data/states.json + sitemap.xml generated`);
