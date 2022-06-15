import puppeteer from 'puppeteer';

module.exports = async (t, run) => {
  const browser = await puppeteer.launch({
    headless: true
  });
  const page = await browser.newPage();
  try {
    await run(t, page);
  } finally {
    await page.close();
    await browser.close();
  }
}
