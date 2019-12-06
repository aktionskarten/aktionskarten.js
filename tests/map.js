import test from 'ava';
import {api, reset_db} from './utils'
import {MapModel} from '../src/model'

// TODO:
//   * parameter order in Api
//   * if map param is empty, don't include it


test.beforeEach(async t => {
  await reset_db();
});


test.serial.cb('Create new map', t => {
  t.plan(5);

  const name = 'foo'
  const model = new MapModel(api);

  model.on('created', value => {
    t.is(model.name, name)
    t.truthy(model.id)
    t.pass();
		t.end();
  })

  model.on('idChanged', data => {
    t.truthy(data['value'])
  })

  t.falsy(model.id)

  model.name = name
  model.save()
});


test.serial.cb('Map change events', t => {
  t.plan(9);

  const model = new MapModel(api);
  const now = new Date()
  const name = 'foo'
  const place = 'bar'
  const description = 'yea'

  model.on('nameChanged', data => {
    t.is(name, data['value'])
    t.is(name, model.name)
  })

  model.on('placeChanged', data => {
    t.is(place, data['value'])
    t.is(place, model.place)
  })

  model.on('descriptionChanged', data => {
    t.is(description, data['value'])
    t.is(description, model.description)
  })

  model.on('datetimeChanged', data => {
    t.is(now.toISOString(), model.datetime.toISOString())
    t.is(now.toISOString(), data['value'].toISOString())
  })

  model.datetime = now
  model.name = name
  model.place = place
  model.description = description

  t.pass();
	t.end();
});


test.serial('Edit map', async t => {
  const name = 'foo'
  const new_name = 'foo2'
  const model = new MapModel(api);
  model.name = name

  t.falsy(model.id)
  await model.save()
  t.truthy(model.id)
  const id = model.id
  t.is(model.name, name)

  model.name = new_name
  await model.save()

  t.is(model.name, new_name)
  t.is(model.id, id)
});


test.serial('Delete map', async t => {
  const model = new MapModel(api, {'name': 'foo'});

  t.falsy(model.id)
  await model.save()
  t.truthy(model.id)
  await model.remove()
  t.falsy(model.id)
});


test.serial('Date and time in maps', async t => {
  let date = new Date('2035-01-01');
  const model = new MapModel(api, {
    'name': 'foo',
    'datetime': date.toISOString()
  });
  t.is(model.datetime.getTime(), date.getTime())

  await model.save()
  t.is(model.datetime.getTime(), date.getTime())

  const model2 = await MapModel.get(api, model.id, model.secret)
  t.is(model2.datetime.getTime(), date.getTime())
});
