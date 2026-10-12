# Bahanaga Paddy Rice Mapping (Kharif 2025)

Reproducible Google Earth Engine pipeline for mapping paddy rice in Bahanaga, Odisha using a simplified FARM-style approach (Sentinel-1 + Sentinel-2 + Random Forest).

## What this produces

- 10 m binary rice map (raster GeoTIFF)
- Optional vector (Shapefile) of rice polygons
- Intermediate Sentinel-1 feature stack

## Requirements

- Google Earth Engine account with access to:
  - `COPERNICUS/S1_GRD`
  - `COPERNICUS/S2_SR_HARMONIZED`
  - `COPERNICUS/S2_CLOUD_PROBABILITY`
- Ability to create assets under your own GEE project (or use the provided project if shared)
- Google Drive (for exports)

## Repository layout

```
bahanaga-rice-mapping/
├── README.md                 ← this file
├── gee/
│   ├── 01_generate_s1_features.js
│   ├── 02_classify_rice.js
│   └── config.js             ← edit AOI, year, thresholds here
├── docs/
│   └── METHOD.md             ← short method description
└── presentation/
    └── 15min_outline.md      ← 15-minute talk structure
```

## Quick start (another engineer)

### 1. Clone / copy this folder

### 2. Edit configuration

Open `gee/config.js` and set:

- Your AOI asset (Image or FeatureCollection)
- Year
- Output asset / Drive folder names
- Thresholds (defaults are tuned for Bahanaga 2025)

### 3. Run Step 1 – Generate S1 features

1. Open `gee/01_generate_s1_features.js` in the [Earth Engine Code Editor](https://code.earthengine.google.com/)
2. Paste / load the script
3. Click **Run**
4. Go to **Tasks** → run the export
5. Wait until the asset `s1features_...` is created

### 4. Run Step 2 – Classify rice

1. Open `gee/02_classify_rice.js`
2. Confirm the S1 feature asset path matches what Step 1 created
3. Click **Run**
4. Inspect the `final_rice` layer
5. Run the export tasks (GeoTIFF and/or Shapefile)

### 5. Download outputs

- Google Drive → folder specified in config (default: `GEE_exports`)
- Open GeoTIFF / Shapefile in QGIS for visual check

## Accuracy note

**No independent accuracy assessment was performed in the original run.**

- Training samples were generated automatically from Sentinel-1 rules.
- There was no held-out ground-truth set.
- Reported numbers (if any) from a train/test split of automatic samples are optimistic and should not be treated as map accuracy.

To compute proper accuracy you need independent validation points (field points or carefully digitized points). See `docs/METHOD.md` and the presentation outline for recommended next steps.

## Limitations (short)

- Relies on a clear temporary flooding signal (typical of transplanted rice).
- Thresholds were tuned for Bahanaga; other regions need re-tuning.
- Optical periods can be cloudy; radar helps but does not fully replace optical refinement.
- Simplified pipeline (no SNIC object-based step) for memory stability on larger AOIs.

## Citation / method basis

Inspired by the FARM (Fully Automated Rice Mapping) framework using Sentinel-1 phenology + Sentinel-2 multi-temporal classification.

## Contact / ownership

Original analysis performed for Bahanaga, Odisha (Kharif 2025).  
Adapt `config.js` and asset paths for new areas.
