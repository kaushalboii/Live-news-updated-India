# 🔴 India News Radar · Live News Updated India

> **A Real-Time Geospatial Intelligence Radar & Multi-Platform News Tracker Across India**  
> Architected, Designed & Engineered from Scratch by **Kaushal** ([@kaushalboii](https://github.com/kaushalboii))

[![Live Site](https://img.shields.io/badge/Live_Production-GitHub_Pages-2ea44f?style=for-the-badge&logo=github)](https://kaushalboii.github.io/Live-news-updated-India/)
[![Auto Pipeline](https://img.shields.io/badge/Pipeline-30_Min_Automated_Cron-blue?style=for-the-badge&logo=githubactions)](https://github.com/kaushalboii/Live-news-updated-India/actions)
[![Data Integrity](https://img.shields.io/badge/Data-100%25_Live_Zero_Mock-orange?style=for-the-badge)](#-100-live-data-architecture)
[![Tech Stack](https://img.shields.io/badge/Tech-Vanilla_JS_•_SVG_•_Node.js-informational?style=for-the-badge)](#-tech-stack--zero-dependency-philosophy)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow?style=for-the-badge)](LICENSE)

---

## 🌐 Live Production Application
👉 **Experience the live radar:** **[https://kaushalboii.github.io/Live-news-updated-India/](https://kaushalboii.github.io/Live-news-updated-India/)**

---

## 👨‍💻 About the Developer & Creation Story

**India News Radar** was conceptualized, architected, and built completely from scratch by **Kaushal** ([@kaushalboii](https://github.com/kaushalboii)).

### The Vision
In an era of fragmented media, sensationalized algorithmic timelines, and opaque recommendation systems, understanding *where* events are physically happening across India has never been more vital. Traditional news aggregators present endless text lists stripped of geographic context, while commercial mapping platforms rely on bloated third-party SDKs, tracking cookies, and heavy tile servers.

Kaushal set out to build an independent, open, and transparent geospatial news system from first principles:
- **Zero Heavy Mapping SDKs**: No Mapbox, Google Maps, or Leaflet dependencies. Built with a custom, ultra-fast pre-projected Web Mercator vector SVG engine covering all 37 Indian States and Union Territories.
- **Multi-Platform Ground Truth**: Real-time aggregation spanning national broadsheets, 24/7 YouTube news broadcasts, breaking X (Twitter) alerts, and hyper-local vernacular press wires.
- **100% Authentic Live Data**: Strictly zero hardcoded mock events. Every marker represents an actual news report that occurred, pinned directly to its verified geographic location and hyperlinked to original news publishers.
- **Engineered for Everyone**: Fast, lightweight, fully accessible, and responsive across every device—from 4K desktop command centers down to mobile handsets on cellular connections.

---

## 🌟 What is India News Radar?

**India News Radar** is a real-time, interactive geospatial intelligence dashboard that maps breaking news events across India as they happen. It ingests thousands of reports, clusters related coverage across multiple outlets, geolocates stories to over 150 Indian cities and districts, and visualizes them on an interactive map refreshed automatically every 30 minutes.

Whether tracking meteorological alerts from the IMD, civic movements, economic milestones, political developments, or defense alerts, India News Radar gives journalists, researchers, and citizens an instant bird's-eye view of India's news landscape.

---

## ✨ Core Engineering Features Built from Scratch

### 1. 🗺️ Zero-Dependency Web Mercator Vector Map
- **Custom-Engineered SVG Vector Map**: Pre-projected mathematical coordinates (`k: 1957.49`, `x0: 1.1889`, `y0: -0.6975`) mapping latitude/longitude directly to an SVG viewport (`-30 -90 1060 1284`).
- **All 37 States & UTs of India**: Accurate administrative boundaries with smooth hover inspection, vector borders, and non-scaling strokes.
- **Intuitive Navigation**:
  - Desktop: Mousewheel zoom centered on cursor, click-and-drag panning.
  - Mobile: Native touch gestures including one-finger drag panning, two-finger pinch-to-zoom, and instant tap-to-inspect.
  - Zoom Controls: On-screen `[ + ]`, `[ − ]`, and `[ ⟲ Reset ]` quick actions.

### 2. 📡 Multi-Platform Live News Ingestion Engine
- **GDELT 2.0 Event Stream**: Automated 15-minute global stream ingestion filtered strictly to Indian geographic coordinates and events.
- **National & Regional Digital Press**: Ingests coverage from *The Hindu*, *Times of India*, *Indian Express*, *NDTV*, *Hindustan Times*, *Business Standard*, *Livemint*, *Amar Ujala*, *Dainik Bhaskar*, *Dinamani*, *Daily Thanthi*, and local press.
- **📺 YouTube Broadcasts**: Real-time detection and verification of video news broadcasts from prominent Indian newsrooms.
- **𝕏 Social Dispatches**: Pinned breaking alerts from verified sources and news wires.
- **Multi-Outlet Corroboration**: Clusters multi-source stories together (`🌐 39 News Outlets`), surfacing how widely a story is being reported.

### 3. 🎨 High-Precision Design System & Themes
- **Luxury Soft Graphite Theme**: Default dark mode engineered with eye-friendly slate/graphite tones (`#0b0f17`, `#111722`) and high-contrast typography.
- **Editorial Light Mode**: One-click theme toggle providing crisp newspaper contrast (`#edf2f7`, `#ffffff`).
- **Gem-Tone Topic Hierarchy**:
  - 🟡 **Politics & Governance** (`#f59e0b`)
  - 🟣 **Protests & Civic Action** (`#a78bfa`)
  - 🟢 **Economy & Markets** (`#34d399`)
  - 🔵 **Climate & AQI** (`#38bdf8`)
  - 🔴 **Security & Defense** (`#fb7185`)
  - ⚪ **Other News** (`#94a3b8`)
- **Live Dispatch Ticker & Real-Time IST Clock**: Integrated header ticker cycling through top national dispatches with a live synchronized Indian Standard Time clock (`02:30 IST`).

### 4. 📱 100% Responsive Dual-Engine Layout
- **Desktop (Widescreen)**: Two-column layout with the map taking the primary workspace and an auto-scrolling dispatch list in the right 420px panel.
- **Mobile (Smartphones & Tablets)**: Single-column flex layout with the interactive map framed at the top, sticky horizontal category filters with smooth momentum swiping, and single-row time segment buttons (`Today | 7 days | 30 days | 2026`) that fit 100% of the screen width with zero horizontal clipping.

### 5. 🌐 Strict Linguistic Integrity
- **Native Language Accuracy**: Tamil news stories preserve their original Tamil script from regional publications (e.g., *Dinamani*, *Daily Thanthi*, *Polimer News*).
- **Zero Script Leak**: Strict verification ensures non-Tamil stories are cleanly transcribed in exact English without accidental transliteration glitches.

---

## 🏗️ Architecture & Pipeline Flow

```
                     ┌──────────────────────────────────────────┐
                     │          Global Live Ingestion           │
                     │  • GDELT 2.0 15-Minute Global Stream     │
                     │  • YouTube Video News Broadcasts         │
                     │  • X (Twitter) Breaking Dispatches       │
                     │  • Indian National & Regional Press      │
                     └────────────────────┬─────────────────────┘
                                          │
                                          ▼
                             scripts/fetch-gdelt.mjs
               ┌──────────────────────────────────────────────────────┐
               │ - Filters geographic bounds of India (8°N-37°N)      │
               │ - Geocodes to 150+ Indian cities and districts       │
               │ - Cross-matches multi-outlet publisher clusters      │
               │ - Enforces language authenticity (Tamil / English)   │
               │ - Outputs clean structured data to data/live.json    │
               └──────────────────────────┬───────────────────────────┘
                                          │
                                          ▼
                             scripts/build-site.mjs
               ┌──────────────────────────────────────────────────────┐
               │ - Inlines live payload directly into index.html      │
               │ - Pre-renders top 150 news dispatches (0ms latency)  │
               │ - Builds Schema.org Dataset & WebSite JSON-LD        │
               │ - Emits static distribution to _site/                │
               └──────────────────────────┬───────────────────────────┘
                                          │
                                          ▼
                             GitHub Actions Automation
               ┌──────────────────────────────────────────────────────┐
               │ - Runs on cron schedule every 30 minutes             │
               │ - Commits fresh live data [skip ci]                  │
               │ - Deploys static bundle to gh-pages branch           │
               └──────────────────────────────────────────────────────┘
```

---

## 🛠️ Tech Stack & Zero-Dependency Philosophy

| Layer | Technologies Used | Philosophy |
| :--- | :--- | :--- |
| **Frontend Map** | Native SVG, Web Mercator Math, CSS3 | **0 KB** map library size. No Mapbox/Google API keys. |
| **Frontend UI** | Vanilla JavaScript (ES2022), CSS Custom Properties | Pure standard web platform. Instant load times. |
| **Data Ingestion** | Node.js 20+, Native `fetch()`, Regular Expressions | High-performance streaming without heavy ORMs. |
| **Automation** | GitHub Actions (`cron: "*/30 * * * *"`) | 100% autonomous, 24/7 hands-free operations. |
| **Hosting** | GitHub Pages (`gh-pages`), Vercel ready | Globally distributed, edge-cached static distribution. |

---

## 💻 Local Setup & Development

### Prerequisites
- [Node.js](https://nodejs.org/) `>= 20.0.0`
- `npm` `>= 10.0.0`

### 1. Clone the Repository
```bash
git clone https://github.com/kaushalboii/Live-news-updated-India.git
cd Live-news-updated-India
```

### 2. Fetch Latest Live Data
Ingest the latest real-time GDELT news events, YouTube broadcasts, and district reports:
```bash
npm run update
```

### 3. Build Static Production Bundle
Compile the pre-rendered application into `_site/`:
```bash
npm run build
```

### 4. Run Local Preview Server
Launch local server with live reloading:
```bash
npm run dev
# Server will start at http://localhost:3000
```

---

## 📁 Directory Structure

```
Live-news-updated-India/
├── .github/
│   ├── ISSUE_TEMPLATE/
│   │   └── suggest-news.yml      # GitHub Issue template for community news tips
│   └── workflows/
│       └── update.yml            # 30-minute automated ingestion & deployment workflow
├── .cache/                       # Ingestion cache preventing duplicate event fetching
├── data/
│   ├── curated.json              # Verified hand-curated milestone events
│   └── live.json                 # 100% live ingested news clusters & coordinates
├── scripts/
│   ├── build-map.mjs             # SVG administrative geometry optimization tool
│   ├── build-site.mjs            # Production static site assembler & schema builder
│   └── fetch-gdelt.mjs           # Multi-platform GDELT & regional news ingestion engine
├── _site/                        # Production output deployed to GitHub Pages
├── apple-touch-icon.png          # iOS home screen touch icon
├── favicon.svg                   # Vector SVG favicon with live radar pulse
├── index.html                    # Single-page application source (UI & Map engine)
├── og.png                        # Open Graph social preview banner (1200x630)
├── package.json                  # Project manifest and npm automation scripts
├── vercel.json                   # Edge routing & security header rules
└── README.md                     # Project documentation & creator story
```

---

## 🤝 Community Suggestions & Issue Reporting

Have you spotted a major breaking news story or local district report that should be pinned?
- You can suggest a story directly through the in-app link or by [opening a GitHub Issue](https://github.com/kaushalboii/Live-news-updated-India/issues/new?template=suggest-news.yml).
- Please provide a direct URL to the reporting news organization for verification.

---

## 📜 Author & License

- **Architect & Lead Developer:** **Kaushal** ([@kaushalboii](https://github.com/kaushalboii))
- **Data Attribution:**
  - [The GDELT Project](https://www.gdeltproject.org/) (Global Database of Events, Language, and Tone)
  - Multi-platform public news broadcasters and Indian wire services
- **License:** Distributed under the [MIT License](LICENSE).
