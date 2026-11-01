// Pulls live news and events located in India from the GDELT 2.0 Event Database
// (updated every 15 minutes) and writes them to data/live.json.
//
// Ingests events whose action happened in India (FIPS country code "IN") and
// that GDELT geocoded to at least state/city level (geoType >= 2),
// categorizes them, extracts readable headlines from news URLs,
// and clusters them by day and location.
//
// Outputs:
//   .cache/gdelt-state.json  full working state (bookmark + clusters with URL slugs)
//   data/live.json           the public slim file the site loads

import fs from "node:fs/promises";
import { inflateRawSync } from "node:zlib";

const WINDOW_DAYS = Number(process.env.WINDOW_DAYS || 7);
const BACKFILL_HOURS = Number(process.env.BACKFILL_HOURS || 48); // 48h covers substantial live news
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

// Priority category classification rules based on URL slugs and text tokens
const CATEGORY_RULES = [
  ["breaking", [
    "breaking", "blast", "explosion", "crash", "stampede", "tragedy", "fatal", "massive-fire",
    "emergency", "terror-attack", "casualty", "casualties"
  ]],
  ["protest", [
    "protest", "protests", "protesters", "protestors", "strike", "dharna", "rally", "march",
    "kisan", "farmers", "bandh", "blockade", "gherao", "agitation", "boycott", "slogan",
    "chakka-jam", "hunger-strike", "demonstration", "sit-in", "demonstrators", "hartal"
  ]],
  ["climate", [
    "aqi", "pollution", "smog", "monsoon", "flood", "floods", "cyclone", "heatwave", "weather",
    "imd", "rain", "rainstorm", "water-crisis", "drought", "toxic-air", "air-quality",
    "wildfire", "landslide", "earthquake", "environment"
  ]],
  ["infrastructure", [
    "railway", "railways", "train", "expressway", "highway", "metro", "airport", "flight",
    "aviation", "vande-bharat", "bridge", "flyover", "bullet-train", "power-grid", "port",
    "tunnel", "corridor"
  ]],
  ["economy", [
    "economy", "rbi", "sensex", "nifty", "market", "markets", "inflation", "gdp", "rupee",
    "bank", "banks", "banking", "tax", "gst", "capex", "startup", "investment", "shares",
    "stock", "trade", "budget", "export", "import", "industry", "revenue", "fiscal"
  ]],
  ["security", [
    "police", "army", "crpf", "cbi", "ed", "nia", "arrest", "arrested", "detained", "encounter",
    "border", "terror", "smuggling", "seizure", "custody", "fir", "security", "crime",
    "investigation", "busted", "raid", "raids", "accused", "contraband"
  ]],
  ["politics", [
    "election", "elections", "bjp", "congress", "aap", "modi", "parliament", "assembly",
    "minister", "governor", "mla", "mp", "court", "supreme-court", "high-court", "judge",
    "bench", "bail", "verdict", "cabinet", "policy", "poll", "polls", "bypoll", "cm"
  ]],
  ["education", [
    "exam", "exams", "neet", "jee", "upsc", "paper-leak", "university", "college", "school",
    "students", "isro", "space", "hospital", "health", "doctor", "doctors", "medical", "vaccine",
    "ai", "science"
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
  return out.reverse(); // oldest first
}

function tokens(url) {
  try {
    const u = new URL(url);
    return decodeURIComponent(u.pathname + " " + u.search).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  } catch { return ""; }
}

// Classify event category using text tokens and CAMEO codes
function classifyEvent(slugs, rootCode, baseCode) {
  const fullText = " " + slugs.join(" ") + " ";
  for (const [cat, words] of CATEGORY_RULES) {
    for (const w of words) {
      if (fullText.includes(" " + w + " ") || fullText.includes("-" + w + "-")) {
        return cat;
      }
    }
  }

  // Fallback to CAMEO Root Code
  const root = String(rootCode || "");
  if (root === "14") return "protest";
  if (["15", "18", "19", "20"].includes(root)) return "security";
  if (["09", "17"].includes(root)) return "security";
  if (["06", "07"].includes(root)) return "economy";
  if (["01", "02", "03", "04", "05", "10", "11", "12", "13"].includes(root)) return "politics";

  return "general";
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
      if (s.length > 5) {
        titleSlug = s;
        break;
      }
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
  } catch {
    return "";
  }
}

function pickTitle(urls, defaultTitle = "") {
  for (const u of urls) {
    const t = titleFromUrl(u);
    if (t && t.length > 10) return t;
  }
  return defaultTitle;
}

function hostOf(url) {
  try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return ""; }
}

function cleanPlace(raw) {
  if (!raw) return "India";
  return raw
    .replace(/, India$/, "")
    .replace(/, Republic of India$/, "")
    .trim();
}

function addRow(clusters, c, cutoffDate) {
  if (c[COL.geoCountry] !== "IN") return;
  const geoType = Number(c[COL.geoType]);
  if (geoType < 2) return; // ignore country centroid only
  const lat = Number(c[COL.lat]), lng = Number(c[COL.lng]);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
  // Bounding box filter for India geographic coordinates
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
      key,
      date,
      lat,
      lng,
      geoType,
      place: cleanPlace(c[COL.geoName]),
      articles: 0,
      codes: {},
      urls: [],
      domains: [],
      slugs: [],
      firstSeen: c[COL.dateAdded],
      lastSeen: c[COL.dateAdded],
    };
    clusters.set(key, cl);
  }

  // prefer the most precise location seen for this cluster
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

// GDELT zips hold a single CSV. Read it via the central directory.
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
        failed = true;
        break;
      }
      for (const line of r.value.split("\n")) {
        if (line) addRow(clusters, line.split("\t"), cutoff);
      }
      lastOk = batch[j];
      processed++;
    }
    if (failed) break;
  }

  const all = [...clusters.values()]
    .sort((a, b) => b.date.localeCompare(a.date) || b.articles - a.articles)
    .slice(0, 4000);

  await fs.mkdir(".cache", { recursive: true });
  await fs.writeFile(STATE, JSON.stringify({ lastStamp: lastOk, clusters: all }));

  // Slim public file: only what the page renders
  const pub = all.map((cl) => {
    const cat = classifyEvent(cl.slugs, cl.rootCode, Object.keys(cl.codes)[0]);
    const placeHead = cl.place.split(",")[0];
    const defaultTitle = `${cat.charAt(0).toUpperCase() + cat.slice(1)} report in ${placeHead}`;
    const title = pickTitle(cl.urls, defaultTitle);

    return {
      id: cl.id,
      date: cl.date,
      lat: +cl.lat.toFixed(4),
      lng: +cl.lng.toFixed(4),
      geoType: cl.geoType,
      place: cl.place,
      articles: cl.articles,
      outlets: cl.domains.length,
      category: cat,
      title,
      urls: cl.urls.slice(0, 5),
      domains: cl.domains.slice(0, 10),
      lastSeen: cl.lastSeen,
    };
  });

  await fs.mkdir("data", { recursive: true });
  await fs.writeFile(LIVE, JSON.stringify({
    generatedAt: new Date().toISOString(),
    lastGdeltFile: lastOk,
    source: "GDELT 2.0 Global News Event Database",
    windowDays: WINDOW_DAYS,
    clusters: pub,
  }, null, 2));

  console.log(`Processed ${processed} file(s); ${pub.length} news clusters in the last ${WINDOW_DAYS} days`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
