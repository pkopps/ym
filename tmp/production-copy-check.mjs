import { chromium } from '@playwright/test';
const browser = await chromium.launch({headless:true});
const page = await browser.newPage();
const routes = ['/', '/about', '/barnegat-nj', '/services/lawn-mowing', '/services/yard-cleanup', '/provider', '/provider/partnerships', '/booking-expectations', '/cancellation-policy', '/privacy-policy', '/provider-standards', '/provider-verification', '/refund-policy', '/support', '/terms-of-service', '/help'];
const results=[];
for (const locale of ['', '/es']) {
 for (const path of routes) {
  for (const [size,width,height] of [['desktop',1440,900],['mobile',390,844]]) {
   await page.setViewportSize({width,height});
   const route = locale + (path === '/' ? '' : path) || '/';
   const response = await page.goto('http://localhost:3000'+route);
   if(response.status()!==200) throw new Error(`${route}: ${response.status()}`);
   await page.locator('h1').first().waitFor();
   const body=await page.locator('body').innerText();
   if(/first launch market|launch demand|launch-era|why this page exists|operational telemetry|theoretical for now|should match how the product|Starting here|Our first market/i.test(body)) throw new Error(`Internal copy: ${route}`);
   const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth);
   if(overflow) throw new Error(`Overflow: ${route} ${size}`);
   if(!locale && ['/', '/barnegat-nj','/provider/partnerships','/refund-policy','/help'].includes(path)) {
    const name=path==='/'?'home':path.replaceAll('/','-').slice(1);
    if(path==='/') await page.locator('.market-home__launch-empty').scrollIntoViewIfNeeded();
    await page.screenshot({path:`reports/agent-checkpoints/engineer/latest/production-copy/${name}-${size}.png`});
   }
   results.push({route,size,status:response.status(),overflow});
  }
 }
}
console.log(JSON.stringify({pagesChecked:results.length,results}));
await browser.close();
