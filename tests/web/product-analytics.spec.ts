import {expect,test} from "@playwright/test";
test("analytics is optional, measures navigation once, excludes query strings and stops after withdrawal",async({page})=>{
  const events:Array<{name:string;properties:Record<string,unknown>}>=[];
  await page.route("**/api/analytics/events",async route=>{events.push(route.request().postDataJSON());await route.fulfill({status:201,json:{accepted:true}});});
  await page.goto("/?private=secret-value");
  await page.locator('main').click({position:{x:10,y:10}});
  expect(events).toHaveLength(0);
  await page.locator('.analytics-preferences summary').click();
  await page.locator('.analytics-preferences button').first().click();
  await expect.poll(()=>events.filter(event=>event.name==="page_viewed").length).toBe(1);
  await page.locator('footer a[href="/help"]').first().click();
  await expect(page).toHaveURL(/\/help$/);
  await expect.poll(()=>events.filter(event=>event.name==="page_viewed").length).toBe(2);
  expect(events.some(event=>event.name==="action_clicked" && event.properties.destination==="/help")).toBe(true);
  expect(JSON.stringify(events)).not.toContain("secret-value");
  const preference=page.locator('.analytics-preferences');
  if(!await preference.evaluate(element=>(element as HTMLDetailsElement).open)) await preference.locator('summary').click();
  await preference.locator('button').last().click();
  const count=events.length;
  await page.goto('/services/lawn-mowing');
  expect(events).toHaveLength(count);
  expect(await page.evaluate(()=>sessionStorage.getItem('yardmatch-analytics-queue'))).toBeNull();
});
test("failed collection retries the same event ID and privacy signals override permission",async({page})=>{
  await page.addInitScript(()=>localStorage.setItem('yardmatch-analytics-permission','yes'));
  const ids:string[]=[];
  const paths:string[]=[];
  await page.route('**/api/analytics/events',async route=>{ids.push(route.request().postDataJSON().id);paths.push(route.request().postDataJSON().properties.path);await route.fulfill({status:ids.length===1?503:201,json:{}});});
  await page.goto('/services/lawn-mowing');
  await expect.poll(()=>ids.length).toBeGreaterThanOrEqual(2);
  expect(ids[0]).toBe(ids[1]);
  await page.addInitScript(()=>Object.defineProperty(navigator,'globalPrivacyControl',{value:true}));
  await page.goto('/help');
  expect(paths).not.toContain('/help');
});

test("coverage inquiry keeps area, service and timing in the contact form",async({page})=>{
  await page.goto('/help?service=seasonal-cleanup&area=Barnegat%2C+NJ&timing=this-week#contact-us');
  const form=page.locator('#contact-us');
  await expect(form.locator('select').last()).toHaveValue('seasonal-cleanup');
  await expect(form.locator('input').last()).toHaveValue('Barnegat, NJ');
  await expect(form.locator('textarea')).toHaveValue(/this week/);
});

import {loginUi,opsEmail,opsPassword,registerProvider,captureResponsiveEvidence} from './workflow-helpers';
test('empty provider payouts describe setup and ops reports fit both viewports',async({page,request})=>{
  test.setTimeout(60000);
  const provider=await registerProvider(request);
  await loginUi(page,'provider',provider.email);
  await expect(page).toHaveURL(/\/provider\/management$/);
  await page.goto('/provider/payments');
  await expect(page.getByRole('heading',{name:'Finish payout setup'})).toBeVisible();
  await expect(page.getByText('No payout scheduled',{exact:true})).toBeVisible();
  await expect(page.getByText('On track',{exact:true})).toHaveCount(0);
  await captureResponsiveEvidence(page,'payout-empty-readiness',page.getByRole('heading',{name:'Finish payout setup'}));
  await loginUi(page,'ops',opsEmail,opsPassword);
  await expect(page).toHaveURL(/\/ops$/);
  await page.locator('.workspace-nav a[href="#ops-reports"]').click();
  const report=page.getByTestId('product-analytics');
  await expect(report.locator('tbody tr').first()).toBeVisible();
  await expect(report.getByRole('alert')).toHaveCount(0);
  await captureResponsiveEvidence(page,'product-analytics',report);
  for(const width of [1440,390]) {
    await page.setViewportSize({width,height:width===390?844:900});
    expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width+1);
  }
});

test('an expired account cannot reuse its previous analytics visitor identity',async({page})=>{
  await page.addInitScript(()=>{
    localStorage.setItem('yardmatch-analytics-permission','yes');
    localStorage.setItem('yardmatch-analytics-owner','previous-account');
    localStorage.setItem('yardmatch-analytics-visitor','previous-visitor');
  });
  const visitors:string[]=[];
  await page.route('**/api/analytics/events',async route=>{visitors.push(route.request().postDataJSON().properties.anonymousId);await route.fulfill({status:201,json:{}});});
  await page.goto('/help');
  await expect.poll(()=>visitors.length).toBeGreaterThan(0);
  expect(visitors).not.toContain('previous-visitor');
});
