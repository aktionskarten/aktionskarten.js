import 'cross-fetch/polyfill'   // Api is using fetch
import {Api} from '../src/api'
import puppeteer from 'puppeteer';


const url = 'http://localhost:5000'
const api = new Api(url)

//api.errorHandler = (err) => {
//  console.warn(err, new Error().stack);
//}

async function reset_db() {
  await api._get(url + '/test/reset_db');
}

async function withPage(t, run) {
	const browser = await puppeteer.launch();
	const page = await browser.newPage();
	try {
		await run(t, page);
	} finally {
		await page.close();
		await browser.close();
	}
}

export {api, reset_db, withPage}
