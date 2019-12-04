import test from 'ava';
import puppeteer from 'puppeteer';
import {api, reset_db} from './utils'
import {MapModel} from '../src/model'

test.beforeEach(async t => {
  await reset_db();
});

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

test('page - draw bbox', async t => {
  var model = new MapModel(api, {name: 'foo'});
  await model.save()

	const browser = await puppeteer.launch({
    headless: false
  });
	const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });

  const id = model.id
  const secret = model.secret
  var url = 'http://localhost:8080/#'+id+'/'+secret;
  await page.goto(url)

  await sleep(1000)

  // start drawing bbox
  await page.mouse.click(720,128)
  //await page.click('button.btn-primary')

  await sleep(1000)

  // draw bbox
  await page.mouse.move(755,500)
  await page.mouse.down()
  await page.mouse.move(775,500, {steps: 20})
  await page.mouse.up()

  await sleep(1000)

  // commit bbox
  await page.mouse.click(750,128)
  //await page.click('button.btn-primary')

  await sleep(1000)

  model= await MapModel.get(api, id, secret);
  t.is(model.bbox.length, 4)

  await page.close();
  await browser.close();
});

test('page - draw marker', async t => {
  const bbox = [ 13.412933, 52.496578, 13.424606, 52.501601 ]
  var model = new MapModel(api, {name: 'foo', bbox: bbox});
  await model.save()

	const browser = await puppeteer.launch({
    headless: false
  });
	const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });

  const id = model.id
  const secret = model.secret
  var url = 'http://localhost:8080/#'+id+'/'+secret;
  await page.goto(url)

  try {
    await page.waitForSelector('.leaflet-styleeditor-tooltip')
  } catch (error) {
    console.log("Bounding box tooltip did not appear.")
  }

  // confirm bbox
  await page.click('button.btn-primary')

  // place markers
  for (var i=0; i<10;++i) {
    await page.click('.leaflet-toolbar-editable-marker')

    try {
      await page.waitForSelector('.leaflet-styleeditor-tooltip')
    } catch (error) {
      console.log("Marker could not be drawn.")
    }

    await page.mouse.click(600+i*30,500)

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
