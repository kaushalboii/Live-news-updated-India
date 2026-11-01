// Comprehensive live news pipeline for India:
// 1. Ingests GDELT 2.0 15-minute global event stream filtered for India (geoType >= 2)
// 2. Ingests real-time Indian national and regional news feeds
// 3. Captures both major stories and hyper-local district/town reports from small outlets
// 4. Writes enriched clusters to data/live.json

import fs from "node:fs/promises";
import { inflateRawSync } from "node:zlib";

const WINDOW_DAYS = Number(process.env.WINDOW_DAYS || 7);
const BACKFILL_HOURS = Number(process.env.BACKFILL_HOURS || 48);
const MAX_FILES = Number(process.env.MAX_FILES || BACKFILL_HOURS * 4);
const CONCURRENCY = Number(process.env.CONCURRENCY || 8);
const BASE = process.env.GDELT_BASE || "http://data.gdeltproject.org/gdeltv2/";
const STATE = ".cache/gdelt-state.json";
const LIVE = "data/live.json";

// GDELT 2.0 export columns (tab-separated, 61 columns)
const COL = {
  id: 0, sqlDate: 1, eventCode: 26, baseCode: 27, rootCode: 28,
  numSources: 32, numArticles: 33,
  geoType: 51, geoName: 52, geoCountry: 53, geoAdm1: 54, lat: 56, lng: 57,
  dateAdded: 59, url: 60,
};

const KNOWN_PUBLISHERS = {
  "thehindu.com": "The Hindu",
  "timesofindia.indiatimes.com": "Times of India",
  "indianexpress.com": "Indian Express",
  "hindustantimes.com": "Hindustan Times",
  "ndtv.com": "NDTV",
  "business-standard.com": "Business Standard",
  "livemint.com": "Livemint",
  "deccanherald.com": "Deccan Herald",
  "tribuneindia.com": "The Tribune",
  "economictimes.indiatimes.com": "Economic Times",
  "freepressjournal.in": "Free Press Journal",
  "aninews.in": "ANI News",
  "moneycontrol.com": "Moneycontrol",
  "amarujala.com": "Amar Ujala",
  "telegraphindia.com": "The Telegraph",
  "greaterkashmir.com": "Greater Kashmir",
  "dailyexcelsior.com": "Daily Excelsior",
  "telanganatoday.com": "Telangana Today",
  "ianslive.in": "IANS Live",
  "thewire.in": "The Wire",
  "scroll.in": "Scroll.in",
  "prokerala.com": "Prokerala",
  "dtnext.in": "DT Next",
  "millenniumpost.in": "Millennium Post"
};

const MOVEMENT_RULES = [
  ["protest", [
    "protest", "protests", "protesters", "protestors", "strike", "dharna", "rally", "march",
    "kisan", "farmers", "bandh", "blockade", "gherao", "agitation", "boycott", "slogan",
    "chakka", "jam", "hunger", "demonstration", "sit-in", "demonstrators", "hartal", "ladakh", "sir"
  ]],
  ["climate", [
    "aqi", "pollution", "smog", "monsoon", "flood", "floods", "cyclone", "heatwave", "weather",
    "imd", "rain", "rainstorm", "water", "drought", "toxic", "air", "landslide", "earthquake", "murasu"
  ]],
  ["economy", [
    "economy", "rbi", "sensex", "nifty", "market", "markets", "inflation", "gdp", "rupee",
    "bank", "banks", "banking", "tax", "gst", "capex", "startup", "investment", "shares",
    "stock", "trade", "budget", "export", "import", "industry", "revenue"
  ]],
  ["security", [
    "police", "army", "crpf", "cbi", "ed", "nia", "arrest", "arrested", "detained", "encounter",
    "border", "terror", "smuggling", "seizure", "custody", "fir", "security", "crime", "investigation", "sdrf"
  ]],
  ["politics", [
    "election", "elections", "bjp", "congress", "aap", "modi", "parliament", "assembly",
    "minister", "governor", "mla", "mp", "court", "supreme", "judge", "bench", "bail", "verdict",
    "cabinet", "policy", "poll", "polls", "bypoll", "cm", "rahul", "kharge", "nadda"
  ]]
];

const pad = (n) => String(n).padStart(2, "0");
const toStamp = (d) =>
  `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}00`;
const fromStamp = (s) =>
  new Date(Date.UTC(+s.slice(0, 4), +s.slice(4, 6) - 1, +s.slice(6, 8), +s.slice(8, 10), +s.slice(10, 12)));
const isoDate = (yyyymmdd) => `${yyyymmdd.slice(0, 4)}-${yyyymmdd.slice(4, 6)}-${yyyymmdd.slice(6, 8)}`;

async function readJSON(path, fallback) {
  try { return JSON.parse(await fs.readFile(path, "utf8")); } catch { return fallback; }
}

async function get(url) {
  const res = await fetch(url, { signal: AbortSignal.timeout(60_000) });
  if (!res.ok) { const e = new Error(`${res.status} ${url}`); e.status = res.status; throw e; }
  return res;
}

async function latestStamp() {
  const text = await (await get(BASE + "lastupdate.txt")).text();
  const m = text.match(/(\d{14})\.export\.CSV\.zip/);
  if (!m) throw new Error("Could not read GDELT lastupdate.txt");
  return m[1];
}

function stampsToProcess(latest, lastDone) {
  const out = [];
  const stop = lastDone ? fromStamp(lastDone).getTime() : fromStamp(latest).getTime() - BACKFILL_HOURS * 3600e3;
  for (let t = fromStamp(latest).getTime(); t > stop && out.length < MAX_FILES; t -= 15 * 60e3) {
    out.push(toStamp(new Date(t)));
  }
  return out.reverse();
}

function tokens(url) {
  try {
    const u = new URL(url);
    return decodeURIComponent(u.pathname + " " + u.search).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  } catch { return ""; }
}

function classify(slugs, rootCode) {
  const full = " " + slugs.join(" ") + " ";
  for (const [mov, words] of MOVEMENT_RULES) {
    for (const w of words) {
      if (full.includes(" " + w + " ") || full.includes("-" + w + "-")) return mov;
    }
  }
  const root = String(rootCode || "");
  if (root === "14") return "protest";
  if (["15", "18", "19", "20", "09", "17"].includes(root)) return "security";
  if (["06", "07"].includes(root)) return "economy";
  if (["01", "02", "03", "04", "05", "10", "11", "12", "13"].includes(root)) return "politics";
  return "other";
}

function formatPublisher(host) {
  if (!host) return "News Source";
  const h = host.toLowerCase().replace(/^www\./, "");
  if (KNOWN_PUBLISHERS[h]) return KNOWN_PUBLISHERS[h];
  for (const [k, v] of Object.entries(KNOWN_PUBLISHERS)) {
    if (h.includes(k) || k.includes(h)) return v;
  }
  const base = h.split(".")[0];
  return base.charAt(0).toUpperCase() + base.slice(1);
}

function titleFromUrl(url) {
  try {
    const u = new URL(url);
    const segs = u.pathname.split("/").filter(Boolean);
    let titleSlug = "";
    for (let i = segs.length - 1; i >= 0; i--) {
      let s = segs[i].replace(/\.[a-z0-9]+$/i, "");
      if (/^(articleshow|article\d*|news|story|storyid|\d+)$/i.test(s)) continue;
      s = s.replace(/[-_]\d+([-_]\d+)*$/i, "");
      if (s.length > 5) { titleSlug = s; break; }
    }
    if (!titleSlug && segs.length > 0) {
      titleSlug = segs[segs.length - 1].replace(/\.[a-z0-9]+$/i, "");
    }
    const clean = titleSlug
      .replace(/[-_]+/g, " ")
      .split(" ")
      .filter((w) => w.length > 0 && !/^\d{5,}$/.test(w))
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(" ");

    return clean.length >= 8 ? clean : "";
  } catch { return ""; }
}

function pickTitle(urls, fallback = "") {
  for (const u of urls) {
    const t = titleFromUrl(u);
    if (t && t.length > 10) return t;
  }
  return fallback;
}

function hostOf(url) {
  try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return ""; }
}

function cleanPlace(raw) {
  if (!raw) return "India";
  return raw.replace(/, India$/, "").replace(/, Republic of India$/, "").trim();
}

function addRow(clusters, c, cutoffDate) {
  if (c[COL.geoCountry] !== "IN") return;
  const geoType = Number(c[COL.geoType]);
  if (geoType < 2) return; // Keep all cities, towns, districts, states
  const lat = Number(c[COL.lat]), lng = Number(c[COL.lng]);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
  if (lat < 6.0 || lat > 38.0 || lng < 68.0 || lng > 98.0) return;

  const date = isoDate(c[COL.sqlDate]);
  if (date < cutoffDate) return;

  const key = `${date}|${lat.toFixed(1)}|${lng.toFixed(1)}`;
  const url = c[COL.url];
  const host = hostOf(url);
  const rootCode = c[COL.rootCode];
  const baseCode = c[COL.baseCode];

  let cl = clusters.get(key);
  if (!cl) {
    cl = {
      id: key.replace(/[^0-9a-z]+/gi, "_"),
      key, date, lat, lng, geoType,
      place: cleanPlace(c[COL.geoName]),
      articles: 0, codes: {}, urls: [], domains: [], slugs: [],
      firstSeen: c[COL.dateAdded], lastSeen: c[COL.dateAdded],
    };
    clusters.set(key, cl);
  }

  if (geoType > cl.geoType && geoType !== 5) {
    Object.assign(cl, { lat, lng, geoType, place: cleanPlace(c[COL.geoName]) });
  }

  cl.articles += Number(c[COL.numArticles]) || 1;
  const base = (baseCode || "").slice(0, 3) || "010";
  cl.codes[base] = (cl.codes[base] || 0) + 1;
  cl.rootCode = rootCode;

  if (url && !cl.urls.includes(url) && cl.urls.length < 8) cl.urls.push(url);
  if (host && !cl.domains.includes(host) && cl.domains.length < 40) cl.domains.push(host);
  const tk = tokens(url);
  if (tk && cl.slugs.length < 20 && !cl.slugs.includes(tk)) cl.slugs.push(tk);
  if (c[COL.dateAdded] > cl.lastSeen) cl.lastSeen = c[COL.dateAdded];
}

function unzipSingle(buf) {
  let eocd = buf.length - 22;
  while (eocd >= 0 && buf.readUInt32LE(eocd) !== 0x06054b50) eocd--;
  if (eocd < 0) throw new Error("not a zip file");
  const cd = buf.readUInt32LE(eocd + 16);
  const method = buf.readUInt16LE(cd + 10), size = buf.readUInt32LE(cd + 20), local = buf.readUInt32LE(cd + 42);
  const start = local + 30 + buf.readUInt16LE(local + 26) + buf.readUInt16LE(local + 28);
  const data = buf.subarray(start, start + size);
  return (method === 8 ? inflateRawSync(data) : data).toString("utf8");
}

async function download(stamp) {
  try {
    return unzipSingle(Buffer.from(await (await get(`${BASE}${stamp}.export.CSV.zip`)).arrayBuffer()));
  } catch (e) {
    if (e.status === 404) return "";
    throw e;
  }
}

// Ingest live RSS news to catch breaking developments
const RSS_GEO_MAP = {
  "delhi": [28.6139, 77.2090, "Delhi"],
  "new delhi": [28.6139, 77.2090, "New Delhi, Delhi"],
  "mumbai": [19.0760, 72.8777, "Mumbai, Maharashtra"],
  "bengaluru": [12.9716, 77.5946, "Bengaluru, Karnataka"],
  "bangalore": [12.9716, 77.5946, "Bengaluru, Karnataka"],
  "kolkata": [22.5726, 88.3639, "Kolkata, West Bengal"],
  "chennai": [13.0827, 80.2707, "Chennai, Tamil Nadu"],
  "hyderabad": [17.3850, 78.4867, "Hyderabad, Telangana"],
  "pune": [18.5204, 73.8567, "Pune, Maharashtra"],
  "ahmedabad": [23.0225, 72.5714, "Ahmedabad, Gujarat"],
  "lucknow": [26.8467, 80.9462, "Lucknow, Uttar Pradesh"],
  "jaipur": [26.9124, 75.7873, "Jaipur, Rajasthan"],
  "chandigarh": [30.7333, 76.7794, "Chandigarh"],
  "bhopal": [23.2599, 77.4126, "Bhopal, Madhya Pradesh"],
  "patna": [25.5941, 85.1376, "Patna, Bihar"],
  "guwahati": [26.1445, 91.7362, "Guwahati, Assam"],
  "srinagar": [34.0837, 74.7973, "Srinagar, Jammu & Kashmir"],
  "jammu": [32.7266, 74.8570, "Jammu, Jammu & Kashmir"],
  "kochi": [9.9312, 76.2673, "Kochi, Kerala"],
  "indore": [22.7196, 75.8577, "Indore, Madhya Pradesh"],
  "odisha": [20.9517, 85.0985, "Odisha"],
  "kerala": [10.8505, 76.2711, "Kerala"],
  "punjab": [31.1471, 75.3412, "Punjab"]
};

async function fetchLiveRSS(clusters) {
  try {
    const res = await fetch("https://news.google.com/rss?hl=en-IN&gl=IN&ceid=IN:en", {
      signal: AbortSignal.timeout(10000)
    });
    if (!res.ok) return;
    const xml = await res.text();
    const items = xml.match(/<item>[\s\S]*?<\/item>/g) || [];
    const today = new Date().toISOString().slice(0, 10);

    for (const item of items) {
      let title = item.match(/<title>([\s\S]*?)<\/title>/)?.[1] || "";
      const link = item.match(/<link>([\s\S]*?)<\/link>/)?.[1] || "";
      const source = item.match(/<source[^>]*>([\s\S]*?)<\/source>/)?.[1] || "News Wire";
      // Strip trailing source from Google News title
      title = title.replace(/\s*-\s*[^-]+$/, "").trim();
      if (!title || title.length < 15) continue;

      const lower = title.toLowerCase();
      let matchedGeo = null;
      for (const [kw, geo] of Object.entries(RSS_GEO_MAP)) {
        if (lower.includes(kw)) { matchedGeo = geo; break; }
      }
      if (!matchedGeo) continue;

      const [lat, lng, place] = matchedGeo;
      const key = `${today}|${lat.toFixed(1)}|${lng.toFixed(1)}`;
      let cl = clusters.get(key);
      if (!cl) {
        cl = {
          id: "rss_" + key.replace(/[^0-9a-z]+/gi, "_"),
          key, date: today, lat, lng, geoType: 4, place,
          articles: 1, codes: { "010": 1 }, urls: link ? [link] : [],
          domains: [source], slugs: [title.toLowerCase()],
          firstSeen: new Date().toISOString(), lastSeen: new Date().toISOString()
        };
        clusters.set(key, cl);
      } else {
        if (title.length > (cl.title || "").length) cl.title = title;
        if (link && !cl.urls.includes(link)) cl.urls.unshift(link);
        if (source && !cl.domains.includes(source)) cl.domains.push(source);
        cl.articles += 1;
      }
    }
  } catch(e) {
    console.warn("Note: RSS feed ingest skipped:", e.message);
  }
}

async function main() {
  const state = await readJSON(STATE, { lastStamp: null, clusters: [] });

  const cutoff = new Date(Date.now() - WINDOW_DAYS * 864e5).toISOString().slice(0, 10);
  const clusters = new Map();
  for (const cl of state.clusters || []) {
    if (cl.date >= cutoff && cl.key) clusters.set(cl.key, cl);
  }

  const latest = await latestStamp();
  const todo = stampsToProcess(latest, state.lastStamp);
  console.log(`Latest GDELT file ${latest}; ${todo.length} new file(s) since ${state.lastStamp || "fresh start"}`);

  let processed = 0, lastOk = state.lastStamp;
  for (let i = 0; i < todo.length; i += CONCURRENCY) {
    const batch = todo.slice(i, i + CONCURRENCY);
    const results = await Promise.allSettled(batch.map(download));
    let failed = false;
    for (let j = 0; j < batch.length; j++) {
      const r = results[j];
      if (r.status === "rejected") {
        console.warn(`Stopping at ${batch[j]}: ${r.reason.message}. Will retry next run.`);
        failed = true; break;
      }
      for (const line of r.value.split("\n")) if (line) addRow(clusters, line.split("\t"), cutoff);
      lastOk = batch[j]; processed++;
    }
    if (failed) break;
  }

  // Also fetch live RSS headlines to augment breaking news
  await fetchLiveRSS(clusters);

  const all = [...clusters.values()]
    .sort((a, b) => b.date.localeCompare(a.date) || b.articles - a.articles)
    .slice(0, 4000);

  await fs.mkdir(".cache", { recursive: true });
  await fs.writeFile(STATE, JSON.stringify({ lastStamp: lastOk, clusters: all }));

  const pub = all.map((cl) => {
    const mov = classify(cl.slugs, cl.rootCode);
    const fallbackTitle = `Regional news reported in ${cl.place.split(",")[0]}`;
    const title = cl.title || pickTitle(cl.urls, fallbackTitle);
    const type = Object.entries(cl.codes).sort((a, b) => b[1] - a[1])[0]?.[0] || "010";

    const formattedSources = cl.domains.map(formatPublisher);

    return {
      id: cl.id,
      date: cl.date,
      lat: +cl.lat.toFixed(4),
      lng: +cl.lng.toFixed(4),
      geoType: cl.geoType,
      place: cl.place,
      articles: cl.articles,
      outlets: cl.domains.length,
      type,
      movement: mov,
      category: mov,
      title,
      urls: cl.urls.slice(0, 5),
      domains: cl.domains.slice(0, 10),
      publishers: formattedSources.slice(0, 5),
      lastSeen: cl.lastSeen,
      isLocal: cl.domains.length === 1
    };
  });

  await fs.mkdir("data", { recursive: true });
  await fs.writeFile(LIVE, JSON.stringify({
    generatedAt: new Date().toISOString(),
    lastGdeltFile: lastOk,
    source: "GDELT 2.0 Global News Event Database + Regional Live Wires",
    windowDays: WINDOW_DAYS,
    clusters: pub,
  }, null, 2));

  console.log(`Processed ${processed} file(s); ${pub.length} news clusters across India (including hyper-local reports)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
