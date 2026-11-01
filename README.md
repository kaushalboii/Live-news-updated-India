# 🛰️ Bharat News Pulse

> **A Real-Time Multi-Platform Geotagged News Intelligence Network across India**  
> Architected & Developed by **Kaushal** ([@kaushalboii](https://github.com/kaushalboii))

[![Live Site](https://img.shields.io/badge/Live_Map-GitHub_Pages-2ea44f?style=for-the-badge&logo=github)](https://kaushalboii.github.io/Live-news-updated-India/)
[![Auto Pipeline](https://img.shields.io/badge/Pipeline-15_Min_Stream-blue?style=for-the-badge&logo=githubactions)](https://github.com/kaushalboii/Live-news-updated-India/actions)
[![Data Integrity](https://img.shields.io/badge/Data-100%25_Live_Zero_Mock-orange?style=for-the-badge)](#-100-live-data-architecture)

---

## 🌐 Live Production URL
👉 **[https://kaushalboii.github.io/Live-news-updated-India/](https://kaushalboii.github.io/Live-news-updated-India/)**

---

## 🌟 What is Bharat News Pulse?

**Bharat News Pulse** is an interactive, real-time geotagged news intelligence map and tracker covering every state and union territory across India. It aggregates, geocodes, and pins developing stories from multi-platform streams — from national breaking headlines to YouTube video broadcasts, X (Twitter) alerts, and hyper-local district reports from small regional outlets.

Every pin on the map links directly to its original journalistic source. **Zero hardcoded or mock data.**

---

## ✨ Key Capabilities

- **🗺️ Zero-Dependency Web Mercator Vector Map**:
  - Ultra-lightweight pre-projected SVG vector map covering all **37 States and Union Territories** of India.
  - Smooth pan, zoom, pinch-to-zoom on touchscreens, and interactive state hover highlights.
  - No external map tiles, Mapbox API keys, or heavy mapping SDK dependencies required.

- **📡 Multi-Platform Live News Ingestion**:
  - 🌐 **Web & National Press**: GDELT 2.0 15-minute global event stream filtered to India, plus Google News breaking national feeds (*The Hindu*, *Times of India*, *Indian Express*, *NDTV*, *Hindustan Times*, *Business Standard*, *Livemint*, *Amar Ujala*, *Dainik Bhaskar*).
  - 📺 **YouTube Video Broadcasts**: Live broadcasts and video news clips from major Indian channels (DD News, India Today, Republic Bharat, Aaj Tak, regional TV channels).
  - 𝕏 **X (Twitter) Dispatches**: Breaking dispatches and verified agency alerts.
  - 📸 **Social Media Wire**: Trending stories verified across social networks.
  - 📍 **Hyper-Local Regional Press**: Regional language wires (Hindi, Tamil, Telugu, Bengali, Marathi, English) capturing town- and district-level stories from small local outlets.

- **🔍 Smart Filtering & Instant Search**:
  - **Instant Search**: Type any town, city, topic, politician, or outlet to filter news cards and map pins in real time.
  - **37 States & UTs Selector**: Jump directly to any state or union territory.
  - **Source Platform Filter Pills**: Instantly toggle between `All Sources`, `📺 YouTube`, `𝕏 Social`, `🌐 Web Press`, and `📍 Hyper-Local`.
  - **Category Filter**: Toggle Politics, Civic Agitations, Economy & Markets, Climate & AQI, and Security.

- **⚡ Client-Side Real-Time Refresh & Audio Chime**:
  - Automatically fetches updated live news clusters every 3 minutes.
  - Optional Web Audio API chime chimes softly when new breaking news arrives.

- **🔗 Deep Linking & Instant Permalinks**:
  - Every event cluster features a unique hash ID.
  - One-click copy story link or share directly to WhatsApp.

---

## 🏗️ Architecture & Data Pipeline

```
  ┌─────────────────────────────────────────────────────────────┐
  │                 Live Multi-Source Feeds                     │
  │   - GDELT 2.0 Global Event Stream (15-min machine read)     │
  │   - YouTube Video Broadcasts & News Clips                   │
  │   - X (Twitter) Breaking Dispatches & Alerts                │
  │   - Regional Language Wires (Hindi, Tamil, Telugu, etc.)    │
  └──────────────────────────────┬──────────────────────────────┘
                                 │
                                 ▼
                     scripts/fetch-gdelt.mjs
        - Filter Indian geographic coordinates & events
        - Multi-platform categorization & publisher tagging
        - Geocodes to 150+ Indian cities and districts
        - Writes 100% genuine live clusters to data/live.json
                                 │
                                 ▼
                     scripts/build-site.mjs
        - Assembles zero-latency static site in _site/
        - Inlines pre-rendered live news items
        - Generates sitemap.xml & Schema.org JSON-LD dataset
                                 │
                                 ▼
                     GitHub Actions CI/CD
        - Runs automatically every 30 minutes on cron
        - Deploys directly to GitHub Pages & gh-pages
```

---

## 💻 Local Setup & Development

### Prerequisites
- Node.js >= 20

### 1. Clone & Install
```bash
git clone https://github.com/kaushalboii/Live-news-updated-India.git
cd Live-news-updated-India
```

### 2. Ingest Latest Live Multi-Source Data
```bash
npm run update
```

### 3. Build Production Static Site
```bash
npm run build
```

### 4. Start Local Preview Server
```bash
npm run dev
# Live preview will start at http://localhost:3000
```

---

## ⚙️ Automated GitHub Actions CI/CD

The workflow `.github/workflows/update.yml` runs automatically every 30 minutes (`12,42 * * * *`):
1. Checks out the repository.
2. Ingests the latest GDELT 2.0 stream and multi-platform news feeds into `data/live.json`.
3. Compiles the static site into `_site/`.
4. Deploys directly to **GitHub Pages**.

---

## 📜 License & Credits

- Architected & Developed by **Kaushal** ([@kaushalboii](https://github.com/kaushalboii)).
- Data sources: [GDELT Project](https://www.gdeltproject.org/), YouTube Video News, X Alerts, and Indian regional press wires.
- Licensed under the [MIT License](LICENSE).
