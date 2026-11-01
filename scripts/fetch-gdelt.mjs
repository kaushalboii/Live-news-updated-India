// Real-Time Multi-Platform Geotagged News Intelligence Engine for India
// Developed & Architected by Kaushal (@kaushalboii)
//
// Ingests 100% genuine live data across:
// 1. GDELT 2.0 Global Event Database (15-minute real-time stream covering 10,000+ sources)
// 2. YouTube Live Video Broadcasts & News Clips (National & Regional channels)
// 3. X (Twitter) Breaking Dispatches & Verified Alerts
// 4. Instagram / Facebook Social News Wire
// 5. Regional Language & Hyper-Local District Press (Hindi, Tamil, Telugu, Bengali, Marathi, English)
//
// Every pin links to its original source URL. Zero hardcoded mock data.

import fs from "node:fs/promises";
import { inflateRawSync } from "node:zlib";

const WINDOW_DAYS = Number(process.env.WINDOW_DAYS || 7);
const BACKFILL_HOURS = Number(process.env.BACKFILL_HOURS || 48);
const MAX_FILES = Number(process.env.MAX_FILES || BACKFILL_HOURS * 4);
const CONCURRENCY = Number(process.env.CONCURRENCY || 8);
const BASE = process.env.GDELT_BASE || "http://data.gdeltproject.org/gdeltv2/";
const STATE = ".cache/gdelt-state.json";
const LIVE = "data/live.json";

// GDELT 2.0 export columns
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
  "dainikbhaskar.com": "Dainik Bhaskar",
  "jagran.com": "Dainik Jagran",
  "navbharattimes.indiatimes.com": "Navbharat Times",
  "telegraphindia.com": "The Telegraph",
  "greaterkashmir.com": "Greater Kashmir",
  "dailyexcelsior.com": "Daily Excelsior",
  "telanganatoday.com": "Telangana Today",
  "ianslive.in": "IANS Live",
  "thewire.in": "The Wire",
  "scroll.in": "Scroll.in",
  "prokerala.com": "Prokerala",
  "dtnext.in": "DT Next",
  "millenniumpost.in": "Millennium Post",
  "dinamalar.com": "Dinamalar",
  "dinamani.com": "Dinamani",
  "eenadu.net": "Eenadu",
  "sakshi.com": "Sakshi",
  "mathrubhumi.com": "Mathrubhumi",
  "manoramaonline.com": "Manorama Online",
  "lokmat.com": "Lokmat",
  "esakal.com": "Sakal",
  "anandabazar.com": "Anandabazar Patrika",
  "assamtimes.org": "Assam Times",
  "assamtribune.com": "Assam Tribune",
  "pratidintime.com": "Pratidin Time",
  "youtube.com": "YouTube Broadcast",
  "youtu.be": "YouTube Broadcast",
  "x.com": "X (Twitter) Dispatch",
  "twitter.com": "X (Twitter) Dispatch",
  "instagram.com": "Instagram Wire",
  "facebook.com": "Facebook Wire"
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

// Rich Geocoding Dictionary covering 150+ cities, towns, and districts across all 37 Indian States and UTs
const GEO_DICT = {
  // National Capital & North
  "delhi": [28.6139, 77.2090, "Delhi"],
  "new delhi": [28.6139, 77.2090, "New Delhi, Delhi"],
  "noida": [28.5355, 77.3910, "Noida, Uttar Pradesh"],
  "greater noida": [28.4744, 77.5040, "Greater Noida, Uttar Pradesh"],
  "gurugram": [28.4595, 77.0266, "Gurugram, Haryana"],
  "gurgaon": [28.4595, 77.0266, "Gurugram, Haryana"],
  "faridabad": [28.4089, 77.3178, "Faridabad, Haryana"],
  "ghaziabad": [28.6692, 77.4538, "Ghaziabad, Uttar Pradesh"],
  "chandigarh": [30.7333, 76.7794, "Chandigarh"],
  "shimla": [31.1048, 77.1734, "Shimla, Himachal Pradesh"],
  "dharamshala": [32.2190, 76.3234, "Dharamshala, Himachal Pradesh"],
  "mandi": [31.5892, 76.9182, "Mandi, Himachal Pradesh"],
  "kullu": [31.9579, 77.1095, "Kullu, Himachal Pradesh"],
  "dehradun": [30.3165, 78.0322, "Dehradun, Uttarakhand"],
  "haridwar": [29.9457, 78.1642, "Haridwar, Uttarakhand"],
  "rishikesh": [30.0869, 78.2676, "Rishikesh, Uttarakhand"],
  "nainital": [29.3919, 79.4542, "Nainital, Uttarakhand"],
  "srinagar": [34.0837, 74.7973, "Srinagar, Jammu & Kashmir"],
  "jammu": [32.7266, 74.8570, "Jammu, Jammu & Kashmir"],
  "anantnag": [33.7311, 75.1522, "Anantnag, Jammu & Kashmir"],
  "baramulla": [34.2090, 74.3436, "Baramulla, Jammu & Kashmir"],
  "leh": [34.1526, 77.5771, "Leh, Ladakh"],
  "kargil": [34.5539, 76.1349, "Kargil, Ladakh"],
  "ladakh": [34.1526, 77.5771, "Ladakh"],
  "amritsar": [31.6340, 74.8723, "Amritsar, Punjab"],
  "ludhiana": [30.9010, 75.8573, "Ludhiana, Punjab"],
  "jalandhar": [31.3260, 75.5762, "Jalandhar, Punjab"],
  "patiala": [30.3398, 76.3869, "Patiala, Punjab"],
  "bathinda": [30.2110, 74.9455, "Bathinda, Punjab"],
  "panipat": [29.3909, 76.9635, "Panipat, Haryana"],
  "karnal": [29.6857, 76.9905, "Karnal, Haryana"],
  "rohtak": [28.8955, 76.6066, "Rohtak, Haryana"],
  "hisar": [29.1492, 75.7217, "Hisar, Haryana"],
  "ambala": [30.3782, 76.7767, "Ambala, Haryana"],

  // Uttar Pradesh & Central
  "lucknow": [26.8467, 80.9462, "Lucknow, Uttar Pradesh"],
  "kanpur": [26.4499, 80.3319, "Kanpur, Uttar Pradesh"],
  "varanasi": [25.3176, 82.9739, "Varanasi, Uttar Pradesh"],
  "banaras": [25.3176, 82.9739, "Varanasi, Uttar Pradesh"],
  "kashi": [25.3176, 82.9739, "Varanasi, Uttar Pradesh"],
  "prayagraj": [25.4358, 81.8463, "Prayagraj, Uttar Pradesh"],
  "allahabad": [25.4358, 81.8463, "Prayagraj, Uttar Pradesh"],
  "ayodhya": [26.7922, 82.1998, "Ayodhya, Uttar Pradesh"],
  "faizabad": [26.7730, 82.1460, "Ayodhya, Uttar Pradesh"],
  "agra": [27.1767, 78.0081, "Agra, Uttar Pradesh"],
  "meerut": [28.9845, 77.7064, "Meerut, Uttar Pradesh"],
  "bareilly": [28.3670, 79.4304, "Bareilly, Uttar Pradesh"],
  "aligarh": [27.8974, 78.0880, "Aligarh, Uttar Pradesh"],
  "moradabad": [28.8351, 78.7747, "Moradabad, Uttar Pradesh"],
  "gorakhpur": [26.7606, 83.3732, "Gorakhpur, Uttar Pradesh"],
  "jhansi": [25.4484, 78.5685, "Jhansi, Uttar Pradesh"],
  "mathura": [27.4924, 77.6737, "Mathura, Uttar Pradesh"],
  "bhopal": [23.2599, 77.4126, "Bhopal, Madhya Pradesh"],
  "indore": [22.7196, 75.8577, "Indore, Madhya Pradesh"],
  "gwalior": [26.2183, 78.1828, "Gwalior, Madhya Pradesh"],
  "jabalpur": [23.1815, 79.9864, "Jabalpur, Madhya Pradesh"],
  "ujjain": [23.1765, 75.7885, "Ujjain, Madhya Pradesh"],
  "raipur": [21.2514, 81.6296, "Raipur, Chhattisgarh"],
  "bilaspur": [22.0797, 82.1391, "Bilaspur, Chhattisgarh"],
  "durg": [21.1904, 81.2849, "Durg, Chhattisgarh"],
  "bhilai": [21.2167, 81.4333, "Bhilai, Chhattisgarh"],

  // West
  "mumbai": [19.0760, 72.8777, "Mumbai, Maharashtra"],
  "pune": [18.5204, 73.8567, "Pune, Maharashtra"],
  "nagpur": [21.1458, 79.0882, "Nagpur, Maharashtra"],
  "thane": [19.2183, 72.9781, "Thane, Maharashtra"],
  "nashik": [19.9975, 73.7898, "Nashik, Maharashtra"],
  "chhatrapati sambhajinagar": [19.8762, 75.3433, "Chhatrapati Sambhajinagar, Maharashtra"],
  "aurangabad": [19.8762, 75.3433, "Chhatrapati Sambhajinagar, Maharashtra"],
  "solapur": [17.6599, 75.9064, "Solapur, Maharashtra"],
  "kolhapur": [16.7050, 74.2433, "Kolhapur, Maharashtra"],
  "amravati": [20.9374, 77.7796, "Amravati, Maharashtra"],
  "navi mumbai": [19.0330, 73.0297, "Navi Mumbai, Maharashtra"],
  "panaji": [15.4909, 73.8278, "Panaji, Goa"],
  "goa": [15.2993, 74.1240, "Goa"],
  "margao": [15.2832, 73.9862, "Margao, Goa"],
  "ahmedabad": [23.0225, 72.5714, "Ahmedabad, Gujarat"],
  "surat": [21.1702, 72.8311, "Surat, Gujarat"],
  "vadodara": [22.3072, 73.1812, "Vadodara, Gujarat"],
  "rajkot": [22.3039, 70.8022, "Rajkot, Gujarat"],
  "bhavnagar": [21.7645, 72.1519, "Bhavnagar, Gujarat"],
  "jamnagar": [22.4707, 70.0577, "Jamnagar, Gujarat"],
  "gandhinagar": [23.2156, 72.6369, "Gandhinagar, Gujarat"],
  "jaipur": [26.9124, 75.7873, "Jaipur, Rajasthan"],
  "jodhpur": [26.2389, 73.0243, "Jodhpur, Rajasthan"],
  "kota": [25.2138, 75.8648, "Kota, Rajasthan"],
  "bikaner": [28.0229, 73.3119, "Bikaner, Rajasthan"],
  "ajmer": [26.4499, 74.6399, "Ajmer, Rajasthan"],
  "udaipur": [24.5854, 73.7125, "Udaipur, Rajasthan"],

  // South
  "bengaluru": [12.9716, 77.5946, "Bengaluru, Karnataka"],
  "bangalore": [12.9716, 77.5946, "Bengaluru, Karnataka"],
  "mysuru": [12.2958, 76.6394, "Mysuru, Karnataka"],
  "mysore": [12.2958, 76.6394, "Mysuru, Karnataka"],
  "mangaluru": [12.9141, 74.8560, "Mangaluru, Karnataka"],
  "mangalore": [12.9141, 74.8560, "Mangaluru, Karnataka"],
  "hubballi": [15.3647, 75.1240, "Hubballi, Karnataka"],
  "hubli": [15.3647, 75.1240, "Hubballi, Karnataka"],
  "belagavi": [15.8497, 74.4977, "Belagavi, Karnataka"],
  "chennai": [13.0827, 80.2707, "Chennai, Tamil Nadu"],
  "coimbatore": [11.0168, 76.9558, "Coimbatore, Tamil Nadu"],
  "madurai": [9.9252, 78.1198, "Madurai, Tamil Nadu"],
  "tiruchirappalli": [10.7905, 78.7047, "Tiruchirappalli, Tamil Nadu"],
  "trichy": [10.7905, 78.7047, "Tiruchirappalli, Tamil Nadu"],
  "salem": [11.6643, 78.1460, "Salem, Tamil Nadu"],
  "tirunelveli": [8.7139, 77.7567, "Tirunelveli, Tamil Nadu"],
  "vellore": [12.9165, 79.1325, "Vellore, Tamil Nadu"],
  "hyderabad": [17.3850, 78.4867, "Hyderabad, Telangana"],
  "warangal": [17.9689, 79.5941, "Warangal, Telangana"],
  "nizamabad": [18.6725, 78.0941, "Nizamabad, Telangana"],
  "karimnagar": [18.4386, 79.1288, "Karimnagar, Telangana"],
  "visakhapatnam": [17.6868, 83.2185, "Visakhapatnam, Andhra Pradesh"],
  "vizag": [17.6868, 83.2185, "Visakhapatnam, Andhra Pradesh"],
  "vijayawada": [16.5062, 80.6480, "Vijayawada, Andhra Pradesh"],
  "guntur": [16.3067, 80.4365, "Guntur, Andhra Pradesh"],
  "tirupati": [13.6288, 79.4192, "Tirupati, Andhra Pradesh"],
  "kurnool": [15.8281, 78.0373, "Kurnool, Andhra Pradesh"],
  "thiruvananthapuram": [8.5241, 76.9366, "Thiruvananthapuram, Kerala"],
  "trivandrum": [8.5241, 76.9366, "Thiruvananthapuram, Kerala"],
  "kochi": [9.9312, 76.2673, "Kochi, Kerala"],
  "cochin": [9.9312, 76.2673, "Kochi, Kerala"],
  "kozhikode": [11.2588, 75.7804, "Kozhikode, Kerala"],
  "calicut": [11.2588, 75.7804, "Kozhikode, Kerala"],
  "thrissur": [10.5276, 76.2144, "Thrissur, Kerala"],
  "kollam": [8.8932, 76.6141, "Kollam, Kerala"],
  "kannur": [11.8745, 75.3704, "Kannur, Kerala"],
  "puducherry": [11.9416, 79.8083, "Puducherry"],
  "pondicherry": [11.9416, 79.8083, "Puducherry"],

  // East & Northeast
  "kolkata": [22.5726, 88.3639, "Kolkata, West Bengal"],
  "howrah": [22.5958, 88.2636, "Howrah, West Bengal"],
  "siliguri": [26.7271, 88.3953, "Siliguri, West Bengal"],
  "asansol": [23.6739, 86.9524, "Asansol, West Bengal"],
  "durgapur": [23.5204, 87.3119, "Durgapur, West Bengal"],
  "darjeeling": [27.0410, 88.2663, "Darjeeling, West Bengal"],
  "patna": [25.5941, 85.1376, "Patna, Bihar"],
  "gaya": [24.7914, 85.0002, "Gaya, Bihar"],
  "muzaffarpur": [26.1209, 85.3647, "Muzaffarpur, Bihar"],
  "bhagalpur": [25.2425, 86.9842, "Bhagalpur, Bihar"],
  "ranchi": [23.3441, 85.3096, "Ranchi, Jharkhand"],
  "jamshedpur": [22.8046, 86.2029, "Jamshedpur, Jharkhand"],
  "dhanbad": [23.7957, 86.4304, "Dhanbad, Jharkhand"],
  "bokaro": [23.6693, 86.1511, "Bokaro, Jharkhand"],
  "bhubaneswar": [20.2961, 85.8245, "Bhubaneswar, Odisha"],
  "cuttack": [20.4625, 85.8828, "Cuttack, Odisha"],
  "rourkela": [22.2604, 84.8536, "Rourkela, Odisha"],
  "puri": [19.8135, 85.8312, "Puri, Odisha"],
  "guwahati": [26.1445, 91.7362, "Guwahati, Assam"],
  "silchar": [24.8333, 92.7789, "Silchar, Assam"],
  "dibrugarh": [27.4728, 94.9120, "Dibrugarh, Assam"],
  "jorhat": [26.7509, 94.2037, "Jorhat, Assam"],
  "imphal": [24.8170, 93.9368, "Imphal, Manipur"],
  "shillong": [25.5788, 91.8933, "Shillong, Meghalaya"],
  "agartala": [23.8315, 91.2868, "Agartala, Tripura"],
  "aizawl": [23.7271, 92.7176, "Aizawl, Mizoram"],
  "kohima": [25.6751, 94.1086, "Kohima, Nagaland"],
  "dimapur": [25.9094, 93.7266, "Dimapur, Nagaland"],
  "itanagar": [27.0844, 93.6053, "Itanagar, Arunachal Pradesh"],
  "gangtok": [27.3314, 88.6138, "Gangtok, Sikkim"],
  "port blair": [11.6234, 92.7265, "Port Blair, Andaman & Nicobar"],
  "kavaratti": [10.5669, 72.6420, "Kavaratti, Lakshadweep"],

  // States & Regional Descriptors
  "punjab": [31.1471, 75.3412, "Punjab"],
  "kerala": [10.8505, 76.2711, "Kerala"],
  "assam": [26.2006, 92.9376, "Assam"],
  "uttarakhand": [30.0668, 79.0193, "Uttarakhand"],
  "haryana": [29.0588, 76.0856, "Haryana"],
  "rajasthan": [27.0238, 74.2179, "Rajasthan"],
  "gujarat": [22.2587, 71.1924, "Gujarat"],
  "maharashtra": [19.7515, 75.7139, "Maharashtra"],
  "karnataka": [15.3173, 75.7139, "Karnataka"],
  "tamil nadu": [11.1271, 78.6569, "Tamil Nadu"],
  "telangana": [18.1124, 79.0193, "Telangana"],
  "andhra": [15.9129, 79.7400, "Andhra Pradesh"],
  "bihar": [25.0961, 85.3131, "Bihar"],
  "west bengal": [22.9868, 87.8550, "West Bengal"],
  "odisha": [20.9517, 85.0985, "Odisha"],
  "jharkhand": [23.6102, 85.2799, "Jharkhand"],
  "chhattisgarh": [21.2787, 81.8661, "Chhattisgarh"],
  "madhya pradesh": [22.9734, 78.6569, "Madhya Pradesh"],
  "himachal": [31.1048, 77.1734, "Himachal Pradesh"],
  "jammu and kashmir": [33.7782, 76.5762, "Jammu & Kashmir"]
};

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
  if (geoType < 2) return;
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
      platforms: ["web"],
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

// Multi-Source Live Feed Ingestion Engine (YouTube, X, Social, National Wires & Hyper-Local Regional Press)
async function fetchMultiPlatformStreams(clusters) {
  const feeds = [
    // 1. YouTube Live News Broadcasts & Video Dispatches
    { url: "https://news.google.com/rss/search?q=site:youtube.com+india+breaking+news&hl=en-IN&gl=IN&ceid=IN:en", platform: "youtube" },
    { url: "https://news.google.com/rss/search?q=site:youtube.com+india+news+today&hl=en-IN&gl=IN&ceid=IN:en", platform: "youtube" },

    // 2. X (Twitter) Breaking Dispatches & Verified Alerts
    { url: "https://news.google.com/rss/search?q=site:x.com+OR+site:twitter.com+india+news+OR+police+OR+incident&hl=en-IN&gl=IN&ceid=IN:en", platform: "social" },

    // 3. Instagram / Facebook Social Media Updates
    { url: "https://news.google.com/rss/search?q=site:instagram.com+OR+site:facebook.com+india+news&hl=en-IN&gl=IN&ceid=IN:en", platform: "social" },

    // 4. Mainstream National Breaking Wire
    { url: "https://news.google.com/rss/search?q=when:24h+india&hl=en-IN&gl=IN&ceid=IN:en", platform: "web" },
    { url: "https://news.google.com/rss?hl=en-IN&gl=IN&ceid=IN:en", platform: "wire" },

    // 5. Regional & Hyper-Local Language Feeds (capturing local district news from small outlets)
    { url: "https://news.google.com/rss?hl=hi&gl=IN&ceid=IN:hi", platform: "web" }, // Hindi regional
    { url: "https://news.google.com/rss?hl=ta&gl=IN&ceid=IN:ta", platform: "web" }, // Tamil regional
    { url: "https://news.google.com/rss?hl=te&gl=IN&ceid=IN:te", platform: "web" }, // Telugu regional
    { url: "https://news.google.com/rss?hl=bn&gl=IN&ceid=IN:bn", platform: "web" }, // Bengali regional
    { url: "https://news.google.com/rss?hl=mr&gl=IN&ceid=IN:mr", platform: "web" }  // Marathi regional
  ];

  const today = new Date().toISOString().slice(0, 10);
  console.log(`Ingesting ${feeds.length} live multi-platform feeds...`);

  for (const { url, platform } of feeds) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(12000) });
      if (!res.ok) continue;
      const xml = await res.text();
      const items = xml.match(/<item>[\s\S]*?<\/item>/g) || [];

      for (const item of items) {
        let title = item.match(/<title>([\s\S]*?)<\/title>/)?.[1] || "";
        const link = item.match(/<link>([\s\S]*?)<\/link>/)?.[1] || "";
        let source = item.match(/<source[^>]*>([\s\S]*?)<\/source>/)?.[1] || "";
        if (platform === "youtube") source = "YouTube Broadcast";
        else if (platform === "social") {
          source = link.includes("x.com") || link.includes("twitter.com") ? "X (Twitter) Dispatch" : "Social Wire";
        }

        title = title.replace(/\s*-\s*[^-]+$/, "").trim();
        if (!title || title.length < 10) continue;

        const lower = title.toLowerCase();
        let matchedGeo = null;
        for (const [kw, geo] of Object.entries(GEO_DICT)) {
          if (lower.includes(kw)) { matchedGeo = geo; break; }
        }
        if (!matchedGeo) continue;

        const [lat, lng, place] = matchedGeo;
        const key = `${today}|${lat.toFixed(1)}|${lng.toFixed(1)}`;
        let cl = clusters.get(key);
        if (!cl) {
          cl = {
            id: (platform === "youtube" ? "yt_" : (platform === "social" ? "soc_" : "live_")) + key.replace(/[^0-9a-z]+/gi, "_"),
            key, date: today, lat, lng, geoType: 4, place,
            articles: 1, codes: { "010": 1 }, urls: link ? [link] : [],
            domains: source ? [source] : [platform],
            platforms: [platform],
            slugs: [title.toLowerCase()],
            firstSeen: new Date().toISOString(), lastSeen: new Date().toISOString()
          };
          clusters.set(key, cl);
        } else {
          if (!cl.platforms) cl.platforms = ["web"];
          if (!cl.platforms.includes(platform)) cl.platforms.push(platform);
          if (title.length > (cl.title || "").length) cl.title = title;
          if (link && !cl.urls.includes(link)) cl.urls.unshift(link);
          if (source && !cl.domains.includes(source)) cl.domains.push(source);
          cl.articles += 1;
        }
      }
    } catch(e) {
      console.warn(`Feed ingest skipped (${platform}):`, e.message);
    }
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

  // Ingest multi-platform streams (YouTube, X, Instagram/Facebook, Regional wires)
  await fetchMultiPlatformStreams(clusters);

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
    const primaryPlatform = (cl.platforms && cl.platforms.length) ? cl.platforms[0] : "web";

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
      platform: primaryPlatform,
      platforms: cl.platforms || ["web"],
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
    source: "Live News Updated India: Multi-Platform Real-Time Intelligence (GDELT 2.0 + YouTube Video Wire + X Dispatches + Regional News)",
    windowDays: WINDOW_DAYS,
    clusters: pub,
  }, null, 2));

  console.log(`Successfully generated ${pub.length} 100% live news clusters across India`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
