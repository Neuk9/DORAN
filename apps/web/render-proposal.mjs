import { chromium } from '@playwright/test';
const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto('file:///Users/jjw/dev/bigdata/docs/proposal/doran-proposal.html');
await page.pdf({
  path: '/Users/jjw/dev/bigdata/docs/proposal/도란도란_아이디어제안서.pdf',
  format: 'A4',
  printBackground: true,
  preferCSSPageSize: true,
});
await browser.close();
