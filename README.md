# 🔴 Live News Updated India

A high-performance, real-time geotagged news tracker and interactive map covering breaking stories, governance, economy, climate, civic agitations, security, and infrastructure across all 28 states and 8 union territories of India.

Every pin is mapped to its reported geographic location, classified by domain, and linked directly to original journalistic sources.

---

## 🌟 Key Features

- **🗺️ Zero-Dependency Vector Map**: Ultra-crisp, pre-projected Web Mercator SVG vector map of India with smooth pan, zoom, pinch-to-zoom, and state hover highlights. No heavy mapping SDKs or external tile dependencies needed.
- **⚡ Automated Real-Time News Pipeline**: Continuously ingests 15-minute event updates from the GDELT 2.0 Global Event Database (`geoCountry === "IN"`), geocoded to Indian cities and districts.
- **🏷️ Multi-Domain News Classification**:
  - 🔴 **Breaking News**: High-impact developing stories, emergencies & alerts
  - 🟠 **Politics & Governance**: Elections, Parliament, Supreme Court & policy
  - 🟣 **Protests & Civic Action**: Farmer rallies, union strikes, demonstrations & civic petitions
  - 🟢 **Economy & Markets**: RBI updates, stock markets, capex, startups & industry
  - 🔵 **Security & Law**: Defense, police actions, investigations & border security
  - 🌱 **Climate & AQI**: Air pollution alerts, monsoon weather, environmental updates & floods
  - 🎓 **Education & Tech**: ISRO space missions, universities, healthcare & technology
  - 🚆 **Infrastructure**: Railways, Vande Bharat, expressways, metros & airports
- **🔍 Instant Live Search**: Filter news and map pins in real time by keywords, city, state, or news publication.
- **📍 State Filter**: Quick dropdown to jump directly to any Indian state or union territory.
- **🕒 Dynamic Time Horizon**: Toggle between **24 Hours**, **3 Days**, **7 Days**, or **All (30 Days)**.
- **🖥️ Responsive View Switcher**: One-click toggle between **Split View (Map + Feed)**, **Map Only**, and **Feed Only** on both desktop and mobile.
- **🔄 Live Auto-Refresh**: Background polling every 3 minutes with audio notification chime (optional) and live ticker banner.
- **🔗 Direct Sourcing & Share**: Direct deep links to publisher articles (The Hindu, Indian Express, Times of India, NDTV, Livemint, Business Standard, etc.) and one-click shareable URLs.
- **🌓 Dark & Light Modes**: System-adaptive high-contrast UI designed for 24/7 newsrooms and mobile users alike.

---

## 🏗️ Architecture & Pipeline

```text
  ┌─────────────────────────────────────────────────────────────┐
  │                 GDELT 2.0 Event Database                    │
  │     (Global news stream published every 15 minutes)         │
  └──────────────────────────────┬──────────────────────────────┘
                                 │
                                 ▼
                     scripts/fetch-gdelt.mjs
       - Filter India-located events (FIPS 'IN', geoType >= 2)
       - Extract clean headlines from article URL slugs
       - Classify into categories & cluster by geo-coordinates
                                 │
                                 ▼
                          data/live.json
                                 │
                                 ▼
                     scripts/build-site.mjs
       - Inlines data & pre-renders SEO list into _site/
       - Generates sitemaps, JSON-LD dataset schema & headers
                                 │
                ┌────────────────┴────────────────┐
                ▼                                 ▼
          GitHub Pages                          Vercel
```

---

## 🚀 Quick Start (Local Development)

### Prerequisites
- Node.js >= 20

### 1. Clone & Install
```bash
git clone https://github.com/kaushalboii/Live-news-updated-India.git
cd Live-news-updated-India
```

### 2. Fetch Latest Live News
```bash
# Ingests recent India news from GDELT into data/live.json
npm run update
```

### 3. Build Static Site
```bash
# Inlines data and generates the production _site/ folder
npm run build
```

### 4. Run Development Server
```bash
npm run dev
# Opens local preview at http://localhost:3000
```

---

## ⚙️ Automated Deployment & CI/CD

### 1. GitHub Pages (Automated via GitHub Actions)
The repository includes `.github/workflows/update.yml` which:
- Runs automatically every 30 minutes on a cron schedule (`12,42 * * * *`).
- Ingests new 15-minute GDELT data.
- Builds and deploys directly to **GitHub Pages**.
- To enable:
  1. Go to repository **Settings > Pages**.
  2. Under **Build and deployment > Source**, select **GitHub Actions**.

### 2. Vercel (Optional)
To deploy automatically to Vercel:
1. Link your repo in the Vercel dashboard.
2. In GitHub repository secrets, add:
   - `VERCEL_TOKEN`: Your Vercel API token.
   - `VERCEL_ORG_ID`: Your Vercel organization ID (repo variable).
   - `VERCEL_PROJECT_ID`: Your Vercel project ID (repo variable).

---

## 📂 Project Structure

```text
Live-news-updated-India/
├── .github/
│   └── workflows/
│       └── update.yml          # 30-min automated news ingestion & deploy workflow
├── data/
│   ├── curated.json            # Verified high-impact stories across Indian cities
│   ├── india-states.geojson    # Simplified geographic boundaries of Indian states
│   └── live.json               # Ingested real-time news clusters from GDELT
├── scripts/
│   ├── build-map.mjs           # Projects geojson to Web Mercator SVG paths
│   ├── build-site.mjs          # Static site builder & prerenderer
│   └── fetch-gdelt.mjs         # GDELT 2.0 news pipeline & classification engine
├── favicon.svg                 # Live radar beacon SVG icon
├── index.html                  # Core interactive web app (Map + Feed + Controls)
├── package.json                # Project scripts and configurations
├── vercel.json                 # Caching and header configurations
└── README.md                   # Documentation
```

---

## 📄 License & Attribution

- Live news event detections are sourced from the [GDELT Project](https://www.gdeltproject.org/) (GDELT 2.0 Global Knowledge Graph & Event Database).
- Code is released under the [MIT License](LICENSE).
