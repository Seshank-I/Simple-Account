// const puppeteer = require('puppeteer');

// (async () => {
//   const browser = await puppeteer.launch();

//   const page = await browser.newPage();

//   await page.goto('https://cablenote.com/login_logout.action');

//   await page.type('input[name="customerId"]', "1012");

//   await page.type('input[name="userName"]', 'seshank');
//   await page.type('input[name="password"]', 'Swetha1803');

//   await page.click('input[type="submit"]');

//   await page.waitForNavigation();
//   const summaryValue = await page.evaluate(() => {
//     const element = document.querySelector('body > div:nth-child(4) > table > tbody > tr > td:nth-child(2) > div:nth-child(5) > div:nth-child(2) > div > div:nth-child(1) > div > div > div > div > div > div.summary-value');
//     return element.textContent;
//   });
//   console.log('Summary Value:', summaryValue);

//   // await page.evaluate(() => {
//   //   window.scrollTo({
//   //     top: document.body.scrollHeight,
//   //     left: document.body.scrollWidth,
//   //     behavior: 'smooth',
//   //   });
//   // });

//   // // Wait for a short duration to ensure smooth scrolling has finished
//   // await new Promise(r => setTimeout(r, 1000));

//   // // Capture a full-page screenshot
//   // const screenshot = await page.screenshot({
//   //   fullPage: true, path: 'cable_notes.png'
//   // });

//   // Close the browser
//   await browser.close();
// })();
const puppeteer = require('puppeteer');
require('dotenv').config();
(async () => {
  // const browser = await puppeteer.launch({ headless: false });
  const browser = await puppeteer.launch();

  const page = await browser.newPage();

  await page.goto('https://cablenote.com/login_logout.action');

  await page.type('input[name="customerId"]', process.env.CUSTOMER_ID);
  await page.type('input[name="userName"]', process.env.USER_NAME);
  await page.type('input[name="password"]', process.env.PASSWORD);

  await page.click('input[type="submit"]');

  await page.waitForSelector('body > div:nth-child(4) > table > tbody > tr > td:nth-child(2) > div:nth-child(5) > div:nth-child(2) > div > div:nth-child(1) > div > div > div > div > div > div.summary-value');

  const summaryValue = await page.$eval('body > div:nth-child(4) > table > tbody > tr > td:nth-child(2) > div:nth-child(5) > div:nth-child(2) > div > div:nth-child(1) > div > div > div > div > div > div.summary-value', element => element.textContent);

  console.log('Summary Value:', summaryValue.trim());

  await browser.close();
})();


