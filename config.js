/**
 * Configuration for Bahanaga Paddy Rice Mapping
 * ------------------------------------------------
 * Edit this file before running the scripts.
 * Keep asset paths and year consistent between Step 1 and Step 2.
 */

var CONFIG = {

  // --- Study area ---
  // Can be an Image or FeatureCollection asset
  aoiAsset: 'projects/bloomiq-507413/assets/Bahanaga_OCT_2025',
  aoiIsImage: true,   // true if asset is ee.Image, false if FeatureCollection

  // --- Time ---
  year: 2025,

  // Odisha Kharif phenology (medium-duration varieties)
  growStart: [6, 20],   // day of transplanting / flooding window start
  growTrans: [8, 15],   // transition
  growEnd:   [11, 15],  // harvest window end

  // --- S1 feature thresholds (tuned for Bahanaga) ---
  T1: -18.5,   // VHyear_median >= T1
  T2: -20.5,   // VHgrow_min   <= T2

  // --- Classification ---
  probabilityThreshold: 45,   // final rice if avg probability >= this
  rfTrees: 60,
  samplePixels: 250,
  scale: 10,

  // --- Output naming ---
  s1FeatureAssetId: 'projects/bloomiq-507413/assets/s1features_Bahanaga_2025',
  exportFolder: 'GEE_exports',
  rasterDescription: 'Bahanaga_Paddy_Rice_2025_Raster',
  vectorDescription: 'Bahanaga_Paddy_Rice_2025_Shapefile'
};

// Make available in other scripts (Code Editor: paste config first, or combine)
if (typeof exports !== 'undefined') {
  exports.CONFIG = CONFIG;
}
