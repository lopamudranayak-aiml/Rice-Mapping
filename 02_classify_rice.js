/**
 * Step 2 – Classify rice using S1 features + Sentinel-2 + Random Forest
 * Bahanaga Paddy Rice Mapping
 *
 * Prerequisites:
 *   - Step 1 finished and s1features asset exists
 *   - CONFIG paths match Step 1
 */

// ========== CONFIG ==========
var CONFIG = {
  aoiAsset: 'projects/bloomiq-507413/assets/Bahanaga_OCT_2025',
  aoiIsImage: true,
  year: 2025,
  T1: -18.5,
  T2: -20.5,
  probabilityThreshold: 45,
  rfTrees: 60,
  samplePixels: 250,
  scale: 10,
  s1FeatureAssetId: 'projects/bloomiq-507413/assets/s1features_Bahanaga_2025',
  exportFolder: 'GEE_exports',
  rasterDescription: 'Bahanaga_Paddy_Rice_2025_Raster',
  vectorDescription: 'Bahanaga_Paddy_Rice_2025_Shapefile'
};

// ========== Helpers ==========
function maskEdges(s2) {
  return s2.updateMask(s2.select('B8A').mask().updateMask(s2.select('B9').mask()));
}

function maskClouds(img) {
  var clouds = ee.Image(img.get('cloud_mask')).select('probability');
  return img.updateMask(clouds.lt(65));
}

function Sentinel_2_collection(start, end, roi) {
  var s2Sr = ee.ImageCollection('COPERNICUS/S2_SR_HARMONIZED')
    .filterBounds(roi).filterDate(start, end).map(maskEdges);
  var s2Clouds = ee.ImageCollection('COPERNICUS/S2_CLOUD_PROBABILITY')
    .filterBounds(roi).filterDate(start, end);

  var joined = ee.Join.saveFirst('cloud_mask').apply({
    primary: s2Sr,
    secondary: s2Clouds,
    condition: ee.Filter.equals({leftField: 'system:index', rightField: 'system:index'})
  });

  var bands = ['B1','B2','B3','B4','B5','B6','B7','B8','B8A','B9','B11','B12'];
  var names = ['Aerosols','B','G','R','RE1','RE2','RE3','NIR','RE4','Water Vapor','SWIR1','SWIR2'];
  return ee.ImageCollection(joined).map(maskClouds).select(bands, names);
}

function addVIs(image) {
  var ndvi = image.normalizedDifference(['NIR', 'R']).rename('NDVI');
  var evi = image.expression(
    '2.5 * (NIR - Red) / (NIR + 6 * Red - 7.5 * Blue + 1)', {
      NIR: image.select('NIR'), Red: image.select('R'), Blue: image.select('B')
    }).rename('EVI');
  var lswi = image.normalizedDifference(['NIR', 'SWIR1']).rename('LSWI');
  return image.addBands([ndvi, evi, lswi]);
}

// ========== Main ==========
var aoi = CONFIG.aoiIsImage
  ? ee.Image(CONFIG.aoiAsset)
  : ee.FeatureCollection(CONFIG.aoiAsset);
var roi = aoi.geometry();
Map.centerObject(roi, 12);
Map.addLayer(ee.FeatureCollection([ee.Feature(roi)]), {color: 'red'}, 'AOI');

var s1 = ee.Image(CONFIG.s1FeatureAssetId);

// Potential rice from S1 rules
var rice_s1 = s1.select('VHyear_median').gte(CONFIG.T1)
  .and(s1.select('VHgrow_min').lte(CONFIG.T2))
  .and(s1.select('slope').eq(1));

var rice_s1_clean = rice_s1
  .focal_mode(2, 'circle', 'pixels')
  .focal_max(1).focal_min(1)
  .selfMask();

Map.addLayer(rice_s1_clean, {palette: ['yellow']}, 'S1 potential rice');

// Auto samples
var rice_samples = rice_s1_clean.sample({
  region: roi, scale: 20, numPixels: CONFIG.samplePixels, seed: 42, geometries: true
}).map(function(f) { return f.set('code', 1); });

var non_rice = s1.select('VHyear_median').lt(-22)
  .or(s1.select('VHgrow_min').gt(-18)).selfMask();

var nonRice_samples = non_rice.sample({
  region: roi, scale: 20, numPixels: CONFIG.samplePixels, seed: 43, geometries: true
}).map(function(f) { return f.set('code', 0); });

var trainSamples = rice_samples.merge(nonRice_samples);
print('Training samples:', trainSamples.size());

// Multi-date RF
var periods = [
  ['2025-07-20', '2025-08-20'],
  ['2025-08-21', '2025-09-20'],
  ['2025-09-21', '2025-10-20'],
  ['2025-10-21', '2025-11-15']
];

var final_result = ee.Image(0);
var image_count  = ee.Image(0);

for (var i = 0; i < periods.length; i++) {
  var start = ee.Date(periods[i][0]);
  var end   = ee.Date(periods[i][1]);
  var img = Sentinel_2_collection(start, end, roi).map(addVIs).median();
  var mask = img.select('R').mask();
  var one  = ee.Image(1).updateMask(mask).unmask(0);
  var features = img.select(['R', 'NIR', 'NDVI', 'EVI', 'LSWI']);

  var training = features.sampleRegions({
    collection: trainSamples, properties: ['code'], scale: 20, tileScale: 4
  });

  var classifier = ee.Classifier.smileRandomForest(CONFIG.rfTrees)
    .train({features: training, classProperty: 'code'})
    .setOutputMode('PROBABILITY');

  var result = features.classify(classifier).multiply(100).toUint8().unmask(0);
  final_result = final_result.add(result);
  image_count  = image_count.add(one);
}

var final_prop = final_result.divide(image_count);
var final_rice = final_prop.gte(CONFIG.probabilityThreshold)
  .focal_mode(2, 'circle', 'pixels')
  .focal_max(1).focal_min(1)
  .selfMask()
  .rename('rice')
  .toByte();

Map.addLayer(final_rice, {palette: ['32CD32']}, 'final_rice');

// --- Exports ---
Export.image.toDrive({
  image: final_rice.clip(roi),
  description: CONFIG.rasterDescription,
  folder: CONFIG.exportFolder,
  fileNamePrefix: 'Bahanaga_Paddy_Rice_2025',
  scale: CONFIG.scale,
  region: roi,
  maxPixels: 1e13,
  crs: 'EPSG:4326',
  fileFormat: 'GeoTIFF'
});

var rice_vector = final_rice.reduceToVectors({
  geometry: roi,
  scale: CONFIG.scale,
  geometryType: 'polygon',
  eightConnected: false,
  labelProperty: 'rice',
  maxPixels: 1e13,
  tileScale: 4
});

Export.table.toDrive({
  collection: rice_vector,
  description: CONFIG.vectorDescription,
  folder: CONFIG.exportFolder,
  fileFormat: 'SHP'
});

print('Classification finished. Run export tasks from the Tasks tab.');
