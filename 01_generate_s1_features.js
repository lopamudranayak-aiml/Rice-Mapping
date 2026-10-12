/**
 * Step 1 – Generate Sentinel-1 features and export as asset
 * Bahanaga Paddy Rice Mapping
 *
 * Prerequisites:
 *   - Edit gee/config.js (or paste CONFIG below)
 *   - AOI asset must exist and be accessible
 *
 * After running: Tasks → Run the export → wait for asset to finish
 */

// ========== CONFIG (edit or load from config.js) ==========
var CONFIG = {
  aoiAsset: 'projects/bloomiq-507413/assets/Bahanaga_OCT_2025',
  aoiIsImage: true,
  year: 2025,
  growStart: [6, 20],
  growTrans: [8, 15],
  growEnd:   [11, 15],
  s1FeatureAssetId: 'projects/bloomiq-507413/assets/s1features_Bahanaga_2025',
  scale: 10
};

// ========== Helpers ==========
function Sentinel_1_collection(start, end, roi) {
  return ee.ImageCollection('COPERNICUS/S1_GRD')
    .filterBounds(roi)
    .filterDate(start, end)
    .filter(ee.Filter.eq('instrumentMode', 'IW'))
    .select(['VV', 'VH'])
    .map(function(img) {
      return img.where(img.gt(1), 1);
    });
}

function refinedLee(image) {
  var image_info = image.get('system:time_start');
  var bandNames = image.bandNames();
  image = ee.Image(10).pow(image.divide(10));

  var result = ee.ImageCollection(bandNames.map(function(b) {
    var img = image.select([b]);
    var weights3 = ee.List.repeat(ee.List.repeat(1, 3), 3);
    var kernel3 = ee.Kernel.fixed(3, 3, weights3, 1, 1, false);
    var mean3 = img.reduceNeighborhood(ee.Reducer.mean(), kernel3);
    var variance3 = img.reduceNeighborhood(ee.Reducer.variance(), kernel3);

    var sample_weights = ee.List([
      [0,0,0,0,0,0,0], [0,1,0,1,0,1,0], [0,0,0,0,0,0,0],
      [0,1,0,1,0,1,0], [0,0,0,0,0,0,0], [0,1,0,1,0,1,0], [0,0,0,0,0,0,0]
    ]);
    var sample_kernel = ee.Kernel.fixed(7, 7, sample_weights, 3, 3, false);
    var sample_mean = mean3.neighborhoodToBands(sample_kernel);
    var sample_var = variance3.neighborhoodToBands(sample_kernel);

    var gradients = sample_mean.select(1).subtract(sample_mean.select(7)).abs();
    gradients = gradients.addBands(sample_mean.select(6).subtract(sample_mean.select(2)).abs());
    gradients = gradients.addBands(sample_mean.select(3).subtract(sample_mean.select(5)).abs());
    gradients = gradients.addBands(sample_mean.select(0).subtract(sample_mean.select(8)).abs());
    var max_gradient = gradients.reduce(ee.Reducer.max());
    var gradmask = gradients.eq(max_gradient).addBands(gradients.eq(max_gradient));

    var directions = sample_mean.select(1).subtract(sample_mean.select(4))
      .gt(sample_mean.select(4).subtract(sample_mean.select(7))).multiply(1);
    directions = directions.addBands(sample_mean.select(6).subtract(sample_mean.select(4))
      .gt(sample_mean.select(4).subtract(sample_mean.select(2))).multiply(2));
    directions = directions.addBands(sample_mean.select(3).subtract(sample_mean.select(4))
      .gt(sample_mean.select(4).subtract(sample_mean.select(5))).multiply(3));
    directions = directions.addBands(sample_mean.select(0).subtract(sample_mean.select(4))
      .gt(sample_mean.select(4).subtract(sample_mean.select(8))).multiply(4));
    directions = directions.addBands(directions.select(0).not().multiply(5));
    directions = directions.addBands(directions.select(1).not().multiply(6));
    directions = directions.addBands(directions.select(2).not().multiply(7));
    directions = directions.addBands(directions.select(3).not().multiply(8));
    directions = directions.updateMask(gradmask).reduce(ee.Reducer.sum());

    var sample_stats = sample_var.divide(sample_mean.multiply(sample_mean));
    var sigmaV = sample_stats.toArray().arraySort().arraySlice(0, 0, 5)
      .arrayReduce(ee.Reducer.mean(), [0]);

    var rect_weights = ee.List.repeat(ee.List.repeat(0, 7), 3)
      .cat(ee.List.repeat(ee.List.repeat(1, 7), 4));
    var diag_weights = ee.List([
      [1,0,0,0,0,0,0], [1,1,0,0,0,0,0], [1,1,1,0,0,0,0],
      [1,1,1,1,0,0,0], [1,1,1,1,1,0,0], [1,1,1,1,1,1,0], [1,1,1,1,1,1,1]
    ]);
    var rect_kernel = ee.Kernel.fixed(7, 7, rect_weights, 3, 3, false);
    var diag_kernel = ee.Kernel.fixed(7, 7, diag_weights, 3, 3, false);

    var dir_mean = img.reduceNeighborhood(ee.Reducer.mean(), rect_kernel).updateMask(directions.eq(1));
    var dir_var  = img.reduceNeighborhood(ee.Reducer.variance(), rect_kernel).updateMask(directions.eq(1));
    dir_mean = dir_mean.addBands(img.reduceNeighborhood(ee.Reducer.mean(), diag_kernel).updateMask(directions.eq(2)));
    dir_var  = dir_var.addBands(img.reduceNeighborhood(ee.Reducer.variance(), diag_kernel).updateMask(directions.eq(2)));

    for (var i = 1; i < 4; i++) {
      dir_mean = dir_mean.addBands(img.reduceNeighborhood(ee.Reducer.mean(), rect_kernel.rotate(i)).updateMask(directions.eq(2*i+1)));
      dir_var  = dir_var.addBands(img.reduceNeighborhood(ee.Reducer.variance(), rect_kernel.rotate(i)).updateMask(directions.eq(2*i+1)));
      dir_mean = dir_mean.addBands(img.reduceNeighborhood(ee.Reducer.mean(), diag_kernel.rotate(i)).updateMask(directions.eq(2*i+2)));
      dir_var  = dir_var.addBands(img.reduceNeighborhood(ee.Reducer.variance(), diag_kernel.rotate(i)).updateMask(directions.eq(2*i+2)));
    }

    dir_mean = dir_mean.reduce(ee.Reducer.sum());
    dir_var  = dir_var.reduce(ee.Reducer.sum());
    var varX = dir_var.subtract(dir_mean.multiply(dir_mean).multiply(sigmaV)).divide(sigmaV.add(1.0));
    var b = varX.divide(dir_var);

    return dir_mean.add(b.multiply(img.subtract(dir_mean)))
      .arrayProject([0]).arrayFlatten([['sum']]).float();
  })).toBands().rename(bandNames);

  var result_image = ee.Image(10).multiply(result.log10());
  return image.addBands(result_image.select(['VV', 'VH'], ['VV', 'VH']), null, true)
    .set('system:time_start', image_info);
}

// ========== Main ==========
var aoi = CONFIG.aoiIsImage
  ? ee.Image(CONFIG.aoiAsset)
  : ee.FeatureCollection(CONFIG.aoiAsset);
var roi = aoi.geometry();
Map.centerObject(roi, 12);
Map.addLayer(ee.FeatureCollection([ee.Feature(roi)]), {color: 'red'}, 'AOI');

var year = CONFIG.year;
var start_allYear = ee.Date.fromYMD(year, 1, 1);
var end_allYear   = ee.Date.fromYMD(year, 12, 31);
var start_grow    = ee.Date.fromYMD(year, CONFIG.growStart[0], CONFIG.growStart[1]);
var trans_grow    = ee.Date.fromYMD(year, CONFIG.growTrans[0], CONFIG.growTrans[1]);
var end_grow      = ee.Date.fromYMD(year, CONFIG.growEnd[0], CONFIG.growEnd[1]);

var s1 = Sentinel_1_collection(start_allYear, end_allYear, roi).map(refinedLee);

var s1VH_std      = s1.select('VH').reduce(ee.Reducer.stdDev()).clip(roi).rename('VHyear_std');
var s1VH_median   = s1.select('VH').reduce(ee.Reducer.percentile([50])).clip(roi).rename('VHyear_median');
var s1VV_min      = s1.select('VV').reduce(ee.Reducer.percentile([5])).clip(roi).rename('VVyear_min');
var s1VH_grow_min = s1.filterDate(start_grow, end_grow).select('VH')
                      .reduce(ee.Reducer.percentile([5])).clip(roi).rename('VHgrow_min');

var VH_slope_col = s1.map(function(image) {
  var time = ee.Image(
    ee.Date(image.get('system:time_start')).difference(ee.Date(year + '-01-01'), 'day')
  ).float();
  return image.select('VH').addBands(time.rename('DOY'));
});

var VHslope_trans = VH_slope_col.filterDate(start_grow, trans_grow)
  .reduce(ee.Reducer.linearFit()).select('scale').rename('VH_slopeST');
var VHslope_grow  = VH_slope_col.filterDate(trans_grow, end_grow)
  .reduce(ee.Reducer.linearFit()).select('scale').rename('VH_slopeTG');
var features_slope = VHslope_trans.lte(1).and(VHslope_grow.gte(1)).rename('slope').toInt16();

var s1_features = s1VH_std
  .addBands(s1VH_median)
  .addBands(s1VV_min)
  .addBands(s1VH_grow_min)
  .addBands(features_slope);

Map.addLayer(s1_features.select('VHyear_median'), {min: -25, max: -8}, 'VH median (preview)', false);

Export.image.toAsset({
  image: s1_features,
  description: 's1features_Bahanaga_' + year,
  assetId: CONFIG.s1FeatureAssetId,
  region: roi,
  scale: CONFIG.scale,
  maxPixels: 1e13
});

print('Step 1 ready. Go to Tasks and run the export.');
print('Asset will be written to:', CONFIG.s1FeatureAssetId);
