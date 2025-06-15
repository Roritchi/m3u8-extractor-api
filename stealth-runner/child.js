const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const AdblockPlugin = require('puppeteer-extra-plugin-adblocker');
puppeteer.use(StealthPlugin());
puppeteer.use(AdblockPlugin());

let browser;

process.on('message', async ({ id, url, cookies, script }) => {
  try {
    if (!browser) {
      browser = await puppeteer.launch({ headless: true });
    }

    const context = browser;
    const page = await context.newPage();

    const allRequests = [];
    page.on('request', request => {
      allRequests.push({
        url: request.url(),
        method: request.method(),
        headers: request.headers(),
        postData: request.postData(),
        resourceType: request.resourceType(),
      });
    });
    

    if (cookies.length > 0) {
      const cookieUrl = new URL(url).origin;
      await page.setCookie(...cookies.map(c => ({ ...c, url: cookieUrl })));
    }

    await page.goto(url, { waitUntil: 'networkidle2' });

    const result = await page.evaluate(new Function(`return (${script})()`));

    await page.goto(url, { waitUntil: 'networkidle2' });

    await page.close();
    process.send({ id, result, requests: allRequests });
  } catch (err) {
    console.error('[child] Job failed:', err);
    process.send({ id, error: err.message });
  }
});
