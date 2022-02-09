import test from 'ava';
import puppeteer from 'puppeteer';
import {api, reset_db} from './utils'
import {MapModel} from '../src/model'
import haversine from 's-haversine';

// Use to track xy coords in new tests. Add the folloing in your test case
// await registerMouseEvents(page);
function registerMouseEvents(page) {
  page.evaluateOnNewDocument(type=>{
    let callback = (e)=>{
      console.info(e.type, e.clientX, e.clientY);
      return true;
    };
    document.addEventListener('click', e=>callback(e))
    document.addEventListener('mousedown', e=>callback(e))
    document.addEventListener('mouseup', e=>callback(e))
  });
}

function getSizes(bbox) {
  //latitude: 52, longitude: 13
  var southEast = bbox.slice(0,2).reverse(),
      northWest = bbox.slice(2).reverse(),
      northEast = [northWest[0], southEast[1]],
      southWest = [southEast[0], northWest[1]]

  let height = haversine.distance(southEast, northEast),
      width = haversine.distance(southEast, southWest);

  return [height, width];
}


test.beforeEach(async t => {
  await reset_db();
});

test('page - draw bbox (landscape)', async t => {
  var model = new MapModel(api, {name: 'foo'});
  await model.save()

	const browser = await puppeteer.launch({
//    headless: false
  });
	const page = await browser.newPage();
  await page.setViewport({ width: 1024, height: 544 });

  const id = model.id
  const secret = model.secret
  var url = 'http://'+process.env.AKTIONSKARTEN_JS_HOST+':'+process.env.AKTIONSKARTEN_JS_PORT+'/#'+id+'/'+secret;
  await page.goto(url)

  await page.waitForTimeout(1000)

  // draw bbox
  await page.mouse.move(530,280)
  await page.mouse.down()
  await page.mouse.move(550,290, {steps: 20})
  await page.mouse.up()

  await page.waitForTimeout(1000)

  // commit bbox
  await page.mouse.click(600, 100);

  await page.waitForTimeout(1000)

  model= await MapModel.get(api, id, secret);
  t.is(model.bbox.length, 4)

  let [height, width] = getSizes(model.bbox),
      ratio = height/width,
      landscape = 1240/1754.;

  t.true(Math.abs(ratio-landscape) < 0.1)

  await page.close();
  await browser.close();
});

test('page - draw bbox (portrait)', async t => {
  var model = new MapModel(api, {name: 'foo'});
  await model.save()

	const browser = await puppeteer.launch({
//    headless: false
  });
	const page = await browser.newPage();
  await page.setViewport({ width: 1024, height: 544 });

  const id = model.id
  const secret = model.secret
  var url = 'http://127.0.0.1:8080/#'+id+'/'+secret;
  await page.goto(url)

  await page.waitForTimeout(1000)

  await page.select('.container select', 'portrait')

  await page.waitForTimeout(1000)

  // draw bbox
  await page.mouse.move(530,280)
  await page.mouse.down()
  await page.mouse.move(550,290, {steps: 20})
  await page.mouse.up()

  await page.waitForTimeout(1000)

  // commit bbox
  await page.mouse.click(600, 100);

  await page.waitForTimeout(1000)

  model= await MapModel.get(api, id, secret);
  t.is(model.bbox.length, 4)

  let [height, width] = getSizes(model.bbox),
      ratio = height/width,
      portrait = 1754/1240.;

  t.true(Math.abs(ratio-portrait) < 0.1)

  await page.close();
  await browser.close();
});


test('page - draw bbox (no restrictions)', async t => {
  var model = new MapModel(api, {name: 'foo'});
  await model.save()

	const browser = await puppeteer.launch({
//    headless: false
  });
	const page = await browser.newPage();
  await page.setViewport({ width: 1024, height: 544 });

  const id = model.id
  const secret = model.secret
  var url = 'http://'+process.env.AKTIONSKARTEN_JS_HOST+'/#'+id+'/'+secret;
  await page.goto(url)

  await page.waitForTimeout(1000)

  await page.select('.container select', '')

  await page.waitForTimeout(1000)

  // draw bbox
  await page.mouse.move(530,280)
  await page.mouse.down()
  await page.mouse.move(550,300, {steps: 20})
  await page.mouse.up()

  await page.waitForTimeout(1000)

  // commit bbox
  await page.mouse.click(600, 100);

  await page.waitForTimeout(1000)

  model= await MapModel.get(api, id, secret);
  t.is(model.bbox.length, 4)

  let [height, width] = getSizes(model.bbox)
  t.true(Math.abs(width-height) < 1)

  await page.close();
  await browser.close();
});


test('page - draw marker', async t => {
  const bbox = [ 13.412933, 52.496578, 13.424606, 52.501601 ]
  var model = new MapModel(api, {name: 'foo', bbox: bbox});
  await model.save()

	const browser = await puppeteer.launch({
//    headless: false
  });
	const page = await browser.newPage();
  await page.setViewport({ width: 1024, height: 544 });

  const id = model.id
  const secret = model.secret
  var url = 'http://'+process.env.AKTIONSKARTEN_JS_HOST+':'+process.env.AKTIONSKARTEN_JS_PORT+'/#'+id+'/'+secret;
  await page.goto(url)

  try {
    await page.waitForSelector('.leaflet-toolbar-editable-marker')
  } catch (error) {
    console.log("Controls not rendered.")
  }

  // place markers
  for (var i=0; i<10;++i) {
    await page.click('.leaflet-toolbar-editable-marker')

    try {
      await page.waitForSelector('.leaflet-styleeditor-tooltip')
    } catch (error) {
      console.log("Marker could not be drawn.")
    }

    await page.mouse.click(300+i*30,300)

    // check if style editor is open
    try {
      await page.waitForSelector('.editor-enabled')
    } catch (error) {
      console.log("Style editor did not open.")
    }

    // close style editor
    await page.click('.styleeditor-nextBtn')
    try {
      await page.waitForSelector('.editor-enabled', { timeout: 500} )
      fail("Style editor did not close.")
    } catch (error) {
    }
  }

  var model2 = await MapModel.get(api, id, secret)
  var features = [...(await model2.features()).features]
  t.is(features.length, 10)

  await page.close();
  await browser.close();
});
