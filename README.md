# Paddy Rice Mapping Pipeline

Google Earth Engine pipeline to map paddy rice using Sentinel-1 and Sentinel-2.

## What you get

- 10 m binary rice map (GeoTIFF)
- Optional shapefile of rice polygons
- Sentinel-1 feature stack (intermediate asset)

## Requirements

- Google Earth Engine account
- Access to Sentinel-1 and Sentinel-2 collections
- Permission to create assets in your GEE project
- Google Drive (for exports)

## Folder structure

```
├── README.md
└── gee/
    ├── config.js
    ├── 01_generate_s1_features.js
    └── 02_classify_rice.js
```

## How to run

### 1. Edit config

Open `gee/config.js` and set:

- AOI asset path
- Year
- Output asset path and Drive folder
- Thresholds (if needed)

### 2. Generate Sentinel-1 features

1. Open `gee/01_generate_s1_features.js` in the Earth Engine Code Editor
2. Run the script
3. Go to **Tasks** → start the export
4. Wait until the feature asset is created

### 3. Classify rice

1. Open `gee/02_classify_rice.js`
2. Check that the S1 feature asset path matches Step 2
3. Run the script
4. Check the `final_rice` layer on the map
5. Start the export tasks (raster and/or shapefile)

### 4. Download results

From Google Drive (folder set in config), download the GeoTIFF and/or Shapefile and open in QGIS.

## Notes

- Training samples are created automatically from Sentinel-1 rules. There is no independent accuracy assessment in this pipeline.
- Thresholds may need adjustment for a new area.
- For a new region, update the AOI, year, and phenology dates in `config.js`.
