import { chromium } from '@playwright/test';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 794, height: 1123 }, deviceScaleFactor: 1 });
await page.emulateMedia({ media: 'print' });
await page.goto('file:///Users/jjw/dev/bigdata/docs/proposal/doran-proposal.html');
await page.screenshot({ path: '/tmp/doran-preview.png', fullPage: true });
await browser.close();
