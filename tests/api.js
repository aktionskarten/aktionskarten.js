import test from 'ava';
import {api, reset_db} from './utils'
import {MapModel} from '../src/model'

// TODO:
//   * parameter order in Api
//   * if map param is empty, don't include it
//   * map.update contains id in data but feature.update it has to be provided
//   * check each test with invalid data
//   * check auth for each endpoint

test.beforeEach(async t => {
  await reset_db();
});


test.serial('Create new map', async t => {
  const data = {'name': 'foobar'};
  var result = await api.createMap(data);

  t.is(result['name'], data['name']);
  t.false(result['published']);
  t.true('id' in result)
  t.true('secret' in result)
});

test.serial('Log into map', async t => {
  const data = {'name': 'foobar'};
  var result = await api.createMap(data);

  t.true('id' in result)
  t.true('secret' in result)
  const token = await api.loginForMap(result['id'], result['secret']);
  t.true(token.length > 0)
});


test.serial('Get private map', async t => {
  const data = {'name': 'foobar'};
  var result = await api.createMap(data);
  const token = await api.loginForMap(result['id'], result['secret']);
  t.true(token.length > 0)

  result = await api.getMap(result['id'], token);
  t.is(result['name'], data['name']);
  t.false(result['published']);
  t.true('id' in result)
  t.false('secret' in result)
});


test.serial('Delete private map', async t => {
  const data = {'name': 'foobar'};
  var result = await api.createMap(data);
  const token = await api.loginForMap(result['id'], result['secret']);
  await api.removeMap(token, result['id']);
  t.pass();
});

test.serial('Create public map', async t => {
  const data = {'name': 'foobar', 'published': true};
  var result = await api.createMap(data);

  result = await api.getMap(result['id']);
  t.is(result['name'], data['name']);
  t.true(result['published']);
  t.true('id' in result)
  t.false('secret' in result)
});

test.serial('List empty maps', async t => {
  t.deepEqual(await api.getAllMaps(), []);
});

test.serial('List public map', async t => {
  const data = {'name': 'foobar', 'published': true, 'bbox':[1,1,1,1]}
  await api.createMap(data)

  t.is((await api.getAllMaps()).length, 1);
});

test.serial('List mixed maps', async t => {
  const data = {'name': 'foobar', 'bbox':[1,1,1,1]}
  var resp = await api.createMap(data)
  t.is((await api.getAllMaps()).length, 0);

  // publish map
  var token = await api.loginForMap(resp['id'], resp['secret']);
  await api.updateMap(token, {'id': resp['id'], 'published': true})

  t.is((await api.getAllMaps()).length, 1);

  // make private
  await api.updateMap(token, {'id': resp['id'], 'published': false})
  t.is((await api.getAllMaps()).length, 0);
});

test.serial('Update bbox', async t => {
  const data = {'name': 'foobar'}
  var resp = await api.createMap(data)
  t.is(resp['bbox'], null);

  // change bbox map
  var token = await api.loginForMap(resp['id'], resp['secret']);
  const bbox = [1,1,1,1]
  await api.updateMap(token, {'id': resp['id'], 'bbox': bbox})

  resp = await api.getMap(resp['id'], token);
  t.deepEqual(resp['bbox'], bbox);
});


const FEATURE_POINT = {
  "type": "Feature",
  "geometry": {
    "type": "Point",
    "coordinates": [1,1]
  }
}

test.serial('Add feature', async t => {
  const data = {'name': 'foobar', 'bbox':[1,1,1,1]}
  let resp = await api.createMap(data)

  const id = resp['id']
  const token = await api.loginForMap(id, resp['secret']);

  // check no features exist
  resp = await api.getFeatures(id, token)
  t.deepEqual(resp['features'], [])

  // add feature
  const featureData = Object.assign({}, FEATURE_POINT)
  const feature = await api.addFeature(token, id, featureData);

  t.is(feature['properties']['map_id'], id)
  t.is(feature['type'], featureData['type'])
  t.deepEqual(feature['geometry'], featureData['geometry'])
  t.truthy(feature['properties']['id'])

  // check feature list again
  resp = await api.getFeatures(id, token)
  t.is(resp['features'].length, 1)
  t.deepEqual(resp['features'][0], feature)
});


test.serial('Edit feature', async t => {
  const data = {'name': 'foobar', 'bbox':[1,1,1,1]}
  let resp = await api.createMap(data)

  const id = resp['id']
  const token = await api.loginForMap(id, resp['secret']);

  // add feature
  const feature = await api.addFeature(token, id, FEATURE_POINT);
  const feature_id = feature.properties.id

  // change geometry
  feature['geometry']['coordinates'] = [0,0];
  const feature_new = await api.updateFeature(token, id, feature_id, feature);

  t.is(feature_new.properties.id, feature_id)
  t.is(feature_new['type'], feature['type'])
  t.deepEqual(feature_new['geometry'], feature['geometry'])
});


test.serial('Delete feature', async t => {
  const data = {'name': 'foobar', 'bbox':[1,1,1,1]}
  let resp = await api.createMap(data)

  const id = resp['id']
  const token = await api.loginForMap(id, resp['secret']);

  // add feature
  const feature = await api.addFeature(token, id, FEATURE_POINT);
  const feature_id = feature.properties.id

  resp = await api.getFeatures(id, token)
  t.is(resp['features'].length, 1)

  // delete feature
  await api.removeFeature(token, id, feature_id);

  resp = await api.getFeatures(id, token)
  t.is(resp['features'].length, 0)
});
