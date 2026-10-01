import fs from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {Presentation,PresentationFile,FileBlob} from '@oai/artifact-tool';
const ROOT='/Users/patrickkopps/Documents/app', TMP=ROOT+'/tmp/investor-deck-20260920/build', OUT=ROOT+'/output/presentations';
const SKILL='/Users/patrickkopps/.codex/plugins/cache/openai-primary-runtime/presentations/26.909.12148/skills/presentations';
const PY='/Users/patrickkopps/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3';
process.env.RUNTIME_NODE_MODULES='/Users/patrickkopps/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules';
const {finalizePresentation,applyPresentationChartFont}=await import(pathToFileURL(SKILL+'/container_tools/artifact_tool_utils.mjs'));
const data=JSON.parse(await fs.readFile(TMP+'/model-data.json','utf8')), B=data.captures.Base,U=data.captures.Upside,D=data.captures.Downside;
const N=B.nationalRows,T=B.townRows,towns=data.towns;
const C={ink:'#14281D',green:'#205938',sage:'#8EAA79',light:'#E8EDDF',paper:'#F7F5EF',muted:'#66756A',red:'#A24D3E',gold:'#C39245',white:'#FFFFFF'};
const P=Presentation.create({slideSize:{width:1280,height:720}}), tables=[], charts=[];
const assets=ROOT+'/output/pdf/assets/';
const sources={partner:'Source: YardMatch-Barnegat-Partner-Pitch.pdf, September 2026. Product illustrations and sample data are conceptual, not commercial traction.',zocdoc:'Sources checked September 20, 2026: https://www.zocdoc.com/provider-help/en/articles/10859404-understanding-zocdoc-pricing-and-billing and https://www.zocdoc.com/about/understanding-your-bill/ . Public information confirms variable discovery fees and paid add-ons; exact provider quotes control.',census:'Source: US Census Bureau QuickFacts, 2020-2024 estimates for the named New Jersey municipalities. Lawn eligibility, willingness to hire and property mix remain YardMatch assumptions.',model:'Source: YardMatch-Investor-Model.xlsx, prepared September 27, 2026. All 2027-2033 figures are illustrative planning forecasts, not actuals, commitments or guarantees. No commercial operating history was supplied.'};
const money=(v,d=1)=> (v<0?'(':'')+'$'+Math.abs(v).toFixed(d)+(v<0?')':'');
const m=(v,d=1)=>money(v/1e6,d)+'m';
const n=v=>Math.round(v).toLocaleString('en-US');
const pct=(v,d=0)=>(v*100).toFixed(d)+'%';
const whole=v=>(v<0?'(':'')+'$'+n(Math.abs(v))+(v<0?')':'');
const firstProfit=ca=>{const i=ca.rows[51].findIndex(v=>v>0);return i<0?'After 2033':String(data.years[i]);};
function text(s,t,x,y,w,h,size=26,color=C.ink,bold=false,font='Arial',align='left'){
 const sh=s.shapes.add({geometry:'textbox',name:String(t).slice(0,50),position:{left:x,top:y,width:w,height:h},fill:'none',line:{fill:'none',width:0}});sh.text=String(t);sh.text.style={typeface:font,fontSize:size,color,bold,alignment:align,verticalAlignment:'top',autoFit:'none',wrap:'square',insets:{left:0,right:0,top:0,bottom:0}};return sh;
}
function slide(title,sub='',notes='',dark=false){const s=P.slides.add();s.background.fill=dark?C.green:C.paper;const idx=P.slides.items.length;if(title)text(s,title,64,50,1152,108,48,dark?C.white:C.ink,false,'Georgia');if(sub)text(s,sub,66,164,1145,66,23,dark?'#DDE8D7':C.muted);text(s,'YardMatch',64,680,220,24,14,dark?'#DDE8D7':C.muted,true);text(s,String(idx).padStart(2,'0'),1150,680,66,24,14,dark?'#DDE8D7':C.muted,false,'Arial','right');if(notes)s.speakerNotes.textFrame.setText(notes);return s;}
function foot(s,t){text(s,t,66,623,1140,43,16,C.muted);}
function block(s,head,body,x,y,w=510){text(s,head,x,y,w,46,28,C.green,true);text(s,body,x,y+52,w,138,24,C.ink);}
function stat(s,value,label,x,y,w=250,color=C.green){text(s,value,x,y,w,70,49,color,true,'Georgia');text(s,label,x,y+73,w,80,22,C.ink);}
function table(s,values,{x=64,y=246,w=1152,h=330,widths,font=23,highlights=[]}={}){const tb=s.tables.add({rows:values.length,columns:values[0].length,left:x,top:y,width:w,height:h,values,columnWidths:widths});tb.borders.assign({fill:C.paper,width:1,style:'solid'});for(let r=0;r<values.length;r++){tb.rows[r].height=h/values.length;for(let c=0;c<values[0].length;c++){const cell=tb.getCell(r,c);cell.fill=r===0?C.green:highlights.includes(r)?C.light:r%2?C.white:C.paper;cell.text.style={typeface:'Arial',fontSize:font,color:r===0?C.white:C.ink,bold:r===0||highlights.includes(r),alignment:c===0||!/^[$(0-9]/.test(String(values[r][c]))?'left':'right',verticalAlignment:'middle',insets:{left:12,right:12,top:7,bottom:7},autoFit:'none'};}}tables.push(P.slides.items.length);return tb;}
async function image(s,name,x,y,w,h,alt){s.images.add({blob:new Uint8Array(await fs.readFile(assets+name)),contentType:'image/png',alt,fit:'contain',position:{left:x,top:y,width:w,height:h}});}
function chart(s,type,cats,series,position,extra={}){const ch=s.charts.add(type,{position,categories:cats,series,hasLegend:true,chartFill:C.paper,plotAreaFill:C.paper,legend:{position:'bottom',textStyle:{fontSize:18,typeface:'Arial',fill:C.ink}},xAxis:{textStyle:{fontSize:17,typeface:'Arial',fill:C.ink},line:{fill:C.light,width:1}},yAxis:{textStyle:{fontSize:16,typeface:'Arial',fill:C.muted},majorGridlines:{fill:'#D9DFD5',width:1}},...extra});applyPresentationChartFont(ch,{fontFamily:'Arial'});charts.push(P.slides.items.length);return ch;}
// 01
{
 const s=slide('','','Investor discussion draft. September 27, 2026. '+sources.partner+' '+sources.model);
 await image(s,'yardmatch-mower-logo.png',58,45,495,166,'YardMatch mower and checkmark logo');
 text(s,'Investing in YardMatch',64,259,1110,182,68,C.green,false,'Georgia');
 text(s,'A national managed marketplace for lawn and property care',68,478,1020,74,29,C.ink);
 text(s,'Investor discussion draft\nSeptember 2026',68,578,780,62,20,C.muted);
}
// 02
{
 const s=slide('The investment thesis','Build local liquidity town by town, then compound the playbook across the country.',sources.model);
 block(s,'Acquire valuable relationships','A provider pays once when YardMatch delivers a new customer and the first paid job is completed.',66,250,530);
 block(s,'Monetize the provider workflow','Pro and Teams help the business recruit crews, schedule work and serve the added demand.',676,250,530);
 block(s,'Protect provider margins','Customers pay providers directly. YardMatch takes no percentage from repeat service revenue.',66,444,530);
 block(s,'Scale by service-area cohorts','Each town or suburban cluster advances only after supply, retention and contribution gates are met.',676,444,530);
}
// 03
{
 const s=slide('Local property care is still fragmented','Customers need confidence; providers need demand that fits the route.',sources.partner+' Customer and provider problems are product hypotheses that require launch validation.');
 table(s,[['Customer friction','Provider friction','YardMatch response'],['Finding a reliable available business','Winning good customers efficiently','One recommendation and curated backups'],['Knowing whether the crew will arrive','Coordinating schedules and crews','Shared job details and arrival status'],['Getting the next visit handled','Turning demand into repeat routes','Rebooking, records and issue resolution']],{y:246,h:337,widths:[350,365,437],font:24});
 foot(s,'The recommendation-first experience stays central: service, timing and property come first; YardMatch recommends the fit.');
}
// 04
{
 const s=slide('One service experience across three roles','Customer, provider and crew share the same job while each sees the information needed for the role.',sources.partner);
 await image(s,'yardmatch-device-branded-mower.png',402,238,822,372,'Illustrative YardMatch desktop, tablet and mobile concepts');
 text(s,'Customer\nBook and follow the visit\n\nProvider\nSchedule and assign work\n\nCrew\nKnow the place and task',66,254,335,335,27);
 foot(s,'Illustrative product concepts from the partner pitch. They do not show live customers, revenue or app-store availability.');
}
// 05
{
 const s=slide('Local density improves the marketplace','A concentrated launch can fit provider routes and make each acquired relationship more valuable.',sources.partner+' Map is conceptual. No measured route savings or density effect is claimed.');
 await image(s,'yardmatch-client-map-v2.png',64,248,770,335,'Illustrative provider client map and nearby demand');
 text(s,'For providers',876,252,334,44,29,C.green,true);text(s,'Qualified demand, route fit and tools to add workers when growth creates a capacity need.',876,303,330,126,24);
 text(s,'For customers',876,442,334,44,29,C.green,true);text(s,'A managed recommendation, dependable service history and a consistent way to rebook.',876,493,330,110,24);
}
// 06
{
 const s=slide('Two revenue streams align with provider value','The model charges for customer acquisition and optional operating software.',sources.model);
 table(s,[['Revenue stream','Price','When it is earned'],['Typical-property finder fee','$75','First completed paid job in a new relationship'],['Large-property finder fee','$110','First completed paid job in a new relationship'],['Very-large-property finder fee','$150','First completed paid job in a new relationship'],['Pro subscription','$49 / month','Recruiting, scheduling, history, estimates and routes'],['Teams subscription','$99 / month','Multi-crew permissions, labor costing and utilization']],{y:241,h:334,widths:[376,226,550],font:20,highlights:[4,5]});
 foot(s,'The first finder fee is waived for each new provider. Pro and Teams are optional; crew members pay nothing. Subscription status does not influence matching rank.');
}
// 07
{
 const s=slide('Zocdoc supports the acquisition-fee logic','The analogy is customer discovery, not the healthcare payment flow.',sources.zocdoc+' '+sources.model);
 table(s,[['','Zocdoc','YardMatch'],['Charge event','Qualifying new-patient discovery booking','First completed paid job in a new pair'],['Repeat with same provider','No new discovery fee','No new finder fee'],['How service is paid','Patient / insurer pays practice','Customer pays provider directly'],['Additional monetization','Sponsored and practice products','Pro, Teams and later sponsored backups']],{y:243,h:333,widths:[232,442,478],font:22});
 foot(s,'A homeowner may use fewer providers than a patient uses doctors. YardMatch therefore pairs finder fees with provider software rather than relying on repeat transaction fees.');
}
// 08
{
 const s=slide('YardMatch stays outside the service-payment flow','Removing payment processing simplifies the model and preserves provider economics.',sources.model);
 stat(s,'$0','YardMatch recurring service fee',66,252,300);
 stat(s,'$0','Customer service funds handled by YardMatch',370,252,380);
 stat(s,'$0','Crew-member fee',850,252,260);
 table(s,[['What YardMatch records','What the provider controls'],['Booking, service scope and scheduled time','Cash, check or the provider’s existing payment method'],['Completion status and service history','Customer billing, collections and tax treatment'],['Finder-fee eligibility and subscription status','Crew payroll, equipment and operating margin']],{y:426,h:154,widths:[576,576],font:19});
 foot(s,'YardMatch separately bills providers for finder fees and subscriptions. The forecast has no Stripe Connect, payout, chargeback reserve or proprietary payment-engine cost.');
}
// 09
{
 const s=slide('$60 mowing is the floor, not the average job','Service mix, neighborhood, property size and project work expand provider gross booking value.',sources.model);
 table(s,[['Service','2027 starting price','Scheduled jobs / full-season household'],['Basic mowing','$60','12.00'],['Mowing + edging / trimming','$85','6.00'],['Expanded maintenance bundle','$120','2.00'],['Mulch / seasonal cleanup','$300','0.60'],['Tree / larger property project','$1,000','0.03']],{y:243,h:354,widths:[550,240,362],font:23});
 foot(s,`The national forecast uses the detailed New Jersey mix as a planning proxy. 2033 weighted average ticket: ${whole(B.rows[15][6])}. Customer funds remain provider gross booking value, not YardMatch revenue.`);
}
// 10
{
 const s=slide('Barnegat is the proving ground','The pilot converts a known local denominator into measurable launch evidence.',sources.census+' '+sources.model);
 table(s,[['Barnegat launch funnel','Households'],['Census occupied households','10,265'],['Owner-occupied estimate: 88%','9,033'],['Assumed lawn-care eligibility: 75%','6,775'],['Assumed propensity to hire: 45%',n(T[8][0])],['2027 active YardMatch households',n(B.rows[10][0])]],{y:244,h:332,widths:[850,302],font:25,highlights:[5]});
 foot(s,'The 240-household launch target is a planning assumption, bounded by provider capacity. No signed provider commitments or measured outsourcing propensity are claimed.');
}
// 11
{
 const s=slide('The destination is national','The base case expands from one New Jersey service area to a broad U.S. footprint by 2033.',sources.model);
 stat(s,n(N[10][6]),'active service areas',66,258,290);
 stat(s,n(N[15][6]),'states',394,258,210);
 stat(s,n(N[20][6]),'metro clusters',674,258,275);
 stat(s,n(B.rows[10][6]),'active households',971,258,250);
 text(s,'A service area can be one municipality, several neighboring small towns, or a suburban neighborhood group.',66,444,1120,65,27,C.ink);
 text(s,'The schedule is a gated operating plan. Missing retention, supply or contribution thresholds delays the next cohort.',66,530,1120,65,27,C.green,true);
}
// 12
{
 const s=slide('National expansion accelerates in cohorts','The base case reaches multiple states in 2029 and 40 states by 2033.',sources.model);
 table(s,[['Year','Active service areas','States','Metro clusters','New areas launched'],...data.years.map((yr,i)=>[String(yr),n(N[10][i]),n(N[15][i]),n(N[20][i]),n(N[65][i])])],{y:238,h:365,widths:[170,260,180,260,282],font:21,highlights:[1,7]});
 foot(s,'Base footprint: 1, 6, 25, 70, 175, 400 and 750 service areas. Downside reaches 400 areas / 25 states; upside reaches 1,200 areas / 48 states.');
}
// 13
{
 const s=slide('A market needs several seasons to mature','The model separates launch speed from household density inside each service area.',sources.model);
 table(s,[['Service-area age','Active households / area','What must be proven'],['Season 1','240','Supply, first-job completion and fee acceptance'],['Season 2','550','Second-season retention and route density'],['Season 3','850','Repeatable acquisition and local operations'],['Season 4','1,100','Provider capacity and Pro conversion'],['Season 5+','1,300–1,550','Durable density and metro-level operating leverage']],{y:242,h:351,widths:[250,294,608],font:23,highlights:[5]});
 foot(s,'A service area does not reach maturity in one year. New cohorts create heavy acquisition and launch spending even while older cohorts become more productive.');
}
// 14
{
 const s=slide('Every new cohort passes the same launch gates','Town-by-town execution protects the recommendation quality and provider experience.',sources.model+' Proposed gates are operating targets, not achieved results.');
 table(s,[['Gate','Evidence before expanding'],['Supply','Verified providers cover the service types, geography and seasonal capacity'],['Demand','Local CAC and booking conversion support the next marketing tranche'],['Reliability','Completion, arrival and issue-resolution standards hold under load'],['Retention','Homeowners return the next season and providers stay active'],['Economics','Finder-fee acceptance and contribution cover local growth spending']],{y:243,h:350,widths:[250,902],font:23});
 foot(s,'Expansion can move to adjacent municipalities faster when the same provider base and marketing channels carry across the boundary.');
}
// 15
{
 const s=slide('Cohorts create a national marketplace by 2033','Base case operational scale. Gross booking value is paid directly to providers.',sources.model);
 chart(s,'line',data.years.map(String),[{name:'Active households (000s)',values:B.rows[10].map(v=>Number((v/1000).toFixed(6))),line:{fill:C.green,width:3},fill:C.green},{name:'Active providers (000s)',values:B.rows[18].map(v=>Number((v/1000).toFixed(6))),line:{fill:C.gold,width:3},fill:C.gold}],{left:64,top:238,width:780,height:353},{yAxis:{min:0,max:400,majorUnit:100,numberFormatCode:'0',textStyle:{fontSize:16,typeface:'Arial',fill:C.muted},majorGridlines:{fill:'#D9DFD5',width:1}}});
 stat(s,n(B.rows[10][6]),'2033 active households',900,252,300);
 stat(s,n(B.rows[18][6]),'2033 active providers',900,402,300);
 text(s,m(B.rows[14][6]),900,548,300,52,40,C.green,true);text(s,'2033 provider gross booking value',900,600,300,45,19,C.ink);
}
// 16
{
 const s=slide(`Revenue reaches ${m(B.rows[26][6])} in 2033`,'Finder fees fund customer acquisition; provider subscriptions add recurring company revenue.',sources.model);
 chart(s,'bar',data.years.map(String),[{name:'Finder fees',values:B.rows[24].map(v=>Number((v/1e6).toFixed(6))),fill:C.sage},{name:'Pro and Teams',values:B.rows[87].map(v=>Number((v/1e6).toFixed(6))),fill:C.green}],{left:64,top:237,width:1152,height:355},{barOptions:{direction:'column',grouping:'stacked',gapWidth:70},yAxis:{min:0,max:25,majorUnit:5,numberFormatCode:'$0',textStyle:{fontSize:16,typeface:'Arial',fill:C.muted},majorGridlines:{fill:'#D9DFD5',width:1}}});
 foot(s,`2033: ${m(B.rows[24][6])} finder-fee revenue plus ${m(B.rows[87][6])} net subscription revenue. YardMatch revenue equals ${pct(B.rows[70][6],1)} of provider gross booking value.`);
}
// 17
{
 const s=slide('The national base case earns operating leverage','2033 EBITDA bridge. US$ millions.',sources.model);
 table(s,[['2033 base bridge','Amount'],['Finder-fee revenue',m(B.rows[24][6])],['Net Pro and Teams revenue',m(B.rows[87][6])],['Cost of revenue',m(-B.rows[39][6])],['Customer and provider acquisition',m(-(B.rows[43][6]+B.rows[44][6]))],['Payroll',m(-B.rows[49][6])],['Corporate + local operations',m(-(B.rows[50][6]+B.rows[91][6]))],['Subscription operating expense',m(-B.rows[90][6])],['EBITDA',m(B.rows[51][6])]],{y:237,h:365,widths:[760,392],font:21,highlights:[8]});
 foot(s,`2033 net income proxy: ${m(B.rows[55][6])}. The model includes 60 paid employees and ${m(B.rows[91][6])} of that year’s service-area launch, coverage and regional operating spend.`);
}
// 18
{
 const s=slide(`Base EBITDA turns positive in ${firstProfit(B)}`,'Scenario outcomes reflect different rollout speeds, CAC, staffing and overhead.',sources.model);
 table(s,[['2033 result','Downside','Base','Upside'],['Service areas',n(D.nationalRows[10][6]),n(N[10][6]),n(U.nationalRows[10][6])],['States',n(D.nationalRows[15][6]),n(N[15][6]),n(U.nationalRows[15][6])],['Revenue',m(D.rows[26][6]),m(B.rows[26][6]),m(U.rows[26][6])],['EBITDA',m(D.rows[51][6]),m(B.rows[51][6]),m(U.rows[51][6])],['Net income proxy',m(D.rows[55][6]),m(B.rows[55][6]),m(U.rows[55][6])],['First positive EBITDA',firstProfit(D),firstProfit(B),firstProfit(U)]],{y:240,h:351,widths:[370,260,260,262],font:22,highlights:[4]});
 foot(s,'The downside remains EBITDA-negative in 2033. The base becomes positive in 2033, while the upside reaches profitability in 2032. Rollout speed alone does not remove execution risk.');
}
// 19
{
 const s=slide('The model requires staged capital before break-even','The initial round funds proof; later rounds fund national acceleration.',sources.model);
 stat(s,m(Math.max(...B.rows[62])),'peak cumulative funding deficit',66,251,350);
 stat(s,m(B.rows[66][6]),'capital need through 2033 incl. six-month buffer',455,251,390);
 stat(s,m(B.rows[60][6]),'2033 free cash flow before financing',890,251,310);
 table(s,[['Illustrative financing view','Role'],['$1.5m initial round','Validate Barnegat, adjacent NJ cohorts and provider pricing'],['Follow-on capital','Fund metro replication, staffing and household acquisition'],['Operating cash generation','Begins after base EBITDA turns positive in 2033']],{y:430,h:171,widths:[390,762],font:21});
 foot(s,'The workbook assumes only the initial $1.5m financing in the cash balance. The capital-need metric adds six months of fixed-cost buffer to the peak cumulative deficit; actual round timing requires a monthly plan.');
}
// 20
{
 const s=slide('The team scales with the footprint','A remote company still needs product, growth, marketplace and regional operating capacity.',sources.model);
 table(s,[['Year','Paid employees','Active areas','Active households','Payroll'],...data.years.map((yr,i)=>[String(yr),n(B.rows[47][i]),n(N[10][i]),n(B.rows[10][i]),m(B.rows[49][i])])],{y:238,h:364,widths:[156,215,215,306,260],font:21,highlights:[1,7]});
 foot(s,'Fully remote: no office rent, facilities or utilities. Payroll uses an average fully loaded cost rising from $100,000 in 2027 to $110,000 in 2033.');
}
// 21
{
 const s=slide('Ownership starts at 70% / 30%, then dilutes','Illustrative priced rounds show how new capital affects every existing owner.',sources.model);
 table(s,[['Owner','Before financing','After 20% round 1','After 20% round 2'],['Patrick','70.0%','56.0%','44.8%'],['Other initial owners','30.0%','24.0%','19.2%'],['Round 1 investors','—','20.0%','16.0%'],['Round 2 investors','—','—','20.0%'],['Total','100.0%','100.0%','100.0%']],{y:244,h:330,widths:[370,250,266,266],font:23,highlights:[1]});
 foot(s,'Round 1 illustrates $1.5m for 20%, implying $6.0m pre-money and $7.5m post-money. These are discussion assumptions, not an agreed valuation or term sheet.');
}
// 22
{
 const s=slide('Capital buys a repeatable national launch system','The first dollars reduce uncertainty before the company accelerates.',sources.model+' Use-of-funds allocation is illustrative and is not a forecast line-item split.');
 table(s,[['Workstream','What the money proves'],['Marketplace liquidity','Enough verified supply and homeowner demand in each launch cohort'],['Product reliability','Recommendation, booking, scheduling, crew workflow and service history'],['Acquisition playbook','Repeatable local channels with CAC that improves as the network grows'],['Provider monetization','Acceptance of finder tiers and conversion to Pro / Teams'],['Operating controls','Support, quality, local launch and auditable marketplace operations']],{y:243,h:325,widths:[325,827],font:21});
 foot(s,'A payment engine is outside the plan. Capital is directed to demand, supply, product reliability and provider software.');
}
// 23
{
 const s=slide('The next round should be earned with cohort evidence','Investors should see that the Barnegat result can be reproduced in the next markets.',sources.model+' Proposed validation gates, not achieved results.');
 table(s,[['Evidence','Proposed proof point'],['Demand','240 active launch households and measurable booking conversion'],['Retention','Second-season homeowner and provider retention'],['Pricing','Finder-fee acceptance across $75 / $110 / $150 property tiers'],['Subscription','Providers use recruiting and workflow tools as customer demand rises'],['Replication','The same economics hold in adjacent service areas and a second metro']],{y:243,h:350,widths:[315,837],font:23});
 foot(s,'The national forecast is credible only if early cohorts prove these inputs. Expansion pauses when quality, retention, supply or contribution misses the gate.');
}
// 24
{
 const s=slide('The model makes the major risks visible','The upside is large because the plan is ambitious; the assumptions require evidence.',sources.model);
 table(s,[['Risk','What the model assumes / how to manage it'],['Launch velocity','350 new service areas in 2033; use cohort gates and adjacent-market reuse'],['Provider fee acceptance','One-time finder fee follows a completed paid job; validate tier thresholds'],['Off-platform behavior','Software and service history must keep the relationship useful'],['Subscription adoption','60% Pro / Teams share by 2033; recruiting is the key wedge'],['Seasonality and cash','Staged rounds and a six-month fixed-cost buffer'],['Service quality','Curated supply, backup providers and auditable operations']],{y:232,h:374,widths:[305,847],font:21});
}
// 25
{
 const s=slide('Sources and basis','Prepared September 27, 2026. Financial projections use explicit planning assumptions.',sources.partner+' '+sources.zocdoc+' '+sources.census+' '+sources.model);
 text(s,'Company materials',66,238,360,40,27,C.green,true);text(s,'YardMatch partner pitch, September 2026\nProduct positioning, role concepts and welcome offer\nCompanion formula-driven investor workbook',66,286,540,105,22);
 text(s,'External references',66,410,360,40,27,C.green,true);
 const refs=[['Zocdoc: current pricing help','https://www.zocdoc.com/provider-help/en/articles/10859404-understanding-zocdoc-pricing-and-billing'],['Zocdoc: published booking-fee range','https://www.zocdoc.com/about/understanding-your-bill/'],['Zocdoc: Sponsored Results','https://www.zocdoc.com/provider-help/en/articles/8709753-how-much-does-sponsored-results-cost'],['Jobber pricing reference','https://www.getjobber.com/pricing/'],['Stripe Billing pricing','https://stripe.com/billing/pricing'],['Census QuickFacts: Barnegat','https://www.census.gov/quickfacts/fact/table/barnegattownshipoceancountynewjersey/PST045225']];
 refs.forEach(([label,url],i)=>{const x=i<3?66:672,y=462+(i%3)*38;const sh=text(s,label,x,y,540,29,19,C.green);sh.text.get(label).link={uri:url,isExternal:true};});
 foot(s,'External references are linked and cited in PowerPoint notes. National footprint, adoption, CAC, staffing, prices, financing terms and outcomes are YardMatch assumptions.');
}
// 26-27 appendix
for(let batch=0;batch<2;batch++){
 const group=towns.slice(batch*7,batch*7+7);
 const s=slide('Appendix: New Jersey launch evidence',`Named municipal inputs ${batch*7+1}–${batch*7+group.length} support the pilot layer; national cohorts drive the consolidated forecast.`,sources.census+' '+sources.model);
 const tb=table(s,[['Municipality','Households','Owner share','Median income'],...group.map(t=>[t.name,n(t.households),(t.owner*100).toFixed(1)+'%',whole(t.income)+(t.incomeCapped?'+':'')])],{y:242,h:352,widths:[454,215,215,268],font:23});
 group.forEach((t,i)=>{tb.getCell(i+1,0).text.get(t.name).link={uri:'https://www.census.gov/quickfacts/fact/table/'+t.slug+'/PST045225',isExternal:true};});
 foot(s,'Lawn eligibility, outsourcing, lot size, price premiums, launch timing and provider capacity are planning assumptions, not Census findings.');
}
await fs.mkdir(OUT,{recursive:true});await fs.mkdir(ROOT+'/tmp/investor-deck-20260920/final',{recursive:true});
await fs.rm(TMP+'/slides',{recursive:true,force:true});await fs.mkdir(TMP+'/slides',{recursive:true});
await (await PresentationFile.exportPptx(P)).save(TMP+'/candidate.pptx');
const result=await finalizePresentation({workspaceDir:ROOT+'/tmp/investor-deck-20260920',candidatePath:TMP+'/candidate.pptx',finalPath:ROOT+'/tmp/investor-deck-20260920/final/YardMatch-Investor-Deck-v17.pptx',pythonExecutable:PY,integrityValidatorPath:SKILL+'/container_tools/inspect_presentation_package_integrity.py',layoutValidatorPath:SKILL+'/container_tools/inspect_presentation_layout_geometry.py',layoutArgs:['--expected-slide-size-emu','12192000,6858000','--validate-bullet-geometry','--validate-heading-fit',...tables.flatMap(x=>['--require-native-table-slide',String(x)])],requiredNativeTableOwnerSlides:tables,requiredNativeChartOwnerSlides:charts,materializeLiteralChartWorkbooks:true,fontPolicy:{basis:'design',families:['Arial','Georgia']},verifyArtifactToolImport:true,receiptPath:TMP+'/validation-v17.json'});
await fs.copyFile(ROOT+'/tmp/investor-deck-20260920/final/YardMatch-Investor-Deck-v17.pptx',OUT+'/YardMatch-Investor-Deck.pptx');
await fs.writeFile(TMP+'/deck-proto.json',JSON.stringify(P.toProto()));
const finalDeck=await PresentationFile.importPptx(await FileBlob.load(OUT+'/YardMatch-Investor-Deck.pptx'));
for(let i=0;i<finalDeck.slides.items.length;i++){const s=finalDeck.slides.items[i],im=await finalDeck.export({slide:s,format:'png',scale:1.5});await fs.writeFile(TMP+`/slides/slide-${i+1}.png`,new Uint8Array(await im.arrayBuffer()));const l=await s.export({format:'layout'});await fs.writeFile(TMP+`/slides/slide-${i+1}.json`,await l.text());}
console.log(JSON.stringify({slides:P.slides.items.length,tables,charts,result},null,2));
