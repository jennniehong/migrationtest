
const puppeteer = require('puppeteer');
const path = require('path');

(async () => {
  const browser = await puppeteer.launch({headless: 'new'});
  const page = await browser.newPage();
  
  // Open the local HTML file
  const htmlPath = path.join(__dirname, 'mermaid_render.html');
  await page.goto(`file://${htmlPath}`, {waitUntil: 'networkidle0'});

  // Wait for mermaid to render
  await page.waitForSelector('.mermaid svg');

  // Select the element
  const element = await page.$('#diagram');
  
  // Capture screenshot of the element
  await element.screenshot({
    path: path.join(__dirname, 'docs/images/architecture_diagram.png'),
    omitBackground: false
  });

  await browser.close();
  console.log('Screenshot captured successfully');
})();
