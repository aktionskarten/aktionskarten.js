import test from 'ava';
import {api, reset_db} from './utils'
import {MapModel} from '../src/model'

// TODO:
//   * error check of feature in api (has to be type feature with geometry of type point/polygon..
//   * remove FeatureCollection to simplify things
//   * test events (featureAdded, featureRemoved...)


test.beforeEach(async t => {
  await reset_db();
});

const FEATURE_POINT = {
  "type": "Feature",
  "geometry": {
    "type": "Point",
    "coordinates": [1,1]
  }
}

test.serial('Create feature', async t => {
  const model = new MapModel(api, {'name': 'foo', 'bbox':[0,0,1,1,]});

  const feature = await model.addFeature(FEATURE_POINT)
  t.true(await model.save());
  t.is(feature.geojson.type, FEATURE_POINT.type)
  t.deepEqual(feature.geojson.geometry, FEATURE_POINT.geometry)
  t.is(feature.map.id, model.id)
  t.truthy(feature.id)
  t.is(feature._state, 'persistent')

  const features = [...(await model.features()).features]
  t.is(features.length, 1)

  const feature2 = features[0]
  t.is(feature2.geojson.type, FEATURE_POINT.type)
  t.deepEqual(feature2, feature)
  t.is(feature2.map.id, model.id)
  t.is(feature2.id, feature.id)
  t.is(feature._state, 'persistent')
});


test.serial('Update feature', async t => {
  const model = new MapModel(api, {'name': 'foo', 'bbox':[0,0,1,1,]});
  const feature = await model.addFeature(FEATURE_POINT)
  t.true(await model.save());


  const geojson = Object.assign({}, feature.geojson)
  geojson.geometry.coordinates = [0,0];
  feature.geojson = geojson

  t.is(feature._state, 'dirty')

  await feature.save()

  t.deepEqual(feature.geojson.geometry, geojson.geometry)
  t.is(feature.map.id, model.id)
  t.is(feature.id, feature.id)
  t.is(feature._state, 'persistent')
});


test.serial('Remove feature', async t => {
  const model = new MapModel(api, {'name': 'foo', 'bbox':[0,0,1,1,]});
  t.true(await model.save());

  let features = [...(await model.features()).features]
  t.is(features.length, 0)

  const feature = await model.addFeature(FEATURE_POINT)
  await feature.save()

  features = [...(await model.features()).features]
  t.is(features.length, 1)

  t.true(await feature.remove())

  features = [...(await model.features()).features]
  t.is(features.length, 0)
});
