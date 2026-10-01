import fs from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {Presentation,PresentationFile,FileBlob} from '@oai/artifact-tool';
const ROOT='/Users/patrickkopps/Documents/app', TMP=ROOT+'/tmp/investor-deck-20260920/build', OUT=ROOT+'/output/presentations';
const SKILL='/Users/patrickkopps/.codex/plugins/cache/openai-primary-runtime/presentations/26.909.61513/skills/presentations';
const PY='/Users/patrickkopps/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3';
process.env.RUNTIME_NODE_MODULES='/Users/patrickkopps/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules';
const {finalizePresentation,applyPresentationChartFont}=await import(pathToFileURL(SKILL+'/container_tools/artifact_tool_utils.mjs'));
const data=JSON.parse(await fs.readFile(TMP+'/model-data.json','utf8')), B=data.captures.Base,U=data.captures.Upside,D=data.captures.Downside;
const C={ink:'#14281D',green:'#205938',sage:'#8EAA79',light:'#E8EDDF',paper:'#F7F5EF',muted:'#66756A',red:'#A24D3E',white:'#FFFFFF'};
const P=Presentation.create({slideSize:{width:1280,height:720}}), tables=[], charts=[];
const assets=ROOT+'/output/pdf/assets/';
const sources={partner:'Source: YardMatch-Barnegat-Partner-Pitch.pdf, September 2026, pages 1-9. Product illustrations and sample data are conceptual, not commercial traction.',pricing:'Sources checked September 20, 2026: https://stripe.com/pricing ; https://stripe.com/connect/pricing ; https://support.stripe.com/questions/monetizing-payments-with-stripe-connect ; https://stripe.com/financial-connections . US domestic card and platform-controlled Connect assumptions. Exact commercial account terms require confirmation.',zocdoc:'Source checked September 20, 2026: https://www.zocdoc.com/provider-help/en/articles/10859404-understanding-zocdoc-pricing-and-billing . Discovery versus reputation bookings, one-time new patient/provider connection fee. Not every new-doctor booking is chargeable. YardMatch behavior is a planning hypothesis.',census:'Source: US Census Bureau QuickFacts, Barnegat township, Ocean County, New Jersey, 2020-2024 estimates. https://www.census.gov/quickfacts/fact/table/barnegattownshipoceancountynewjersey/SBO010223 . 10,265 households and 88.0% owner occupancy. Households with lawn-care demand are a subset, not measured here.',model:'Source: YardMatch-Investor-Model.xlsx, assumptions and formula-driven Operating model, prepared September 20, 2026. All 2027-2033 figures are illustrative forecasts, not actuals or promises. US dollars. No commercial actuals supplied.'};
const money=(v,d=2)=> (v<0?'(':'')+'$'+Math.abs(v).toFixed(d)+(v<0?')':'');
const m=(v,d=2)=>money(v/1e6,d)+'m';
const n=v=>Math.round(v).toLocaleString('en-US');
const pct=v=>Math.round(v*100)+'%';
const whole=v=>(v<0?'(':'')+'$'+n(Math.abs(v))+(v<0?')':'');
const firstProfit=ca=>{const i=ca.rows[51].findIndex(v=>v>0);return i<0?'None by 2033':String(data.years[i]);};
const sum2=r=>B.rows[r][0]+B.rows[r][1];
function text(s,t,x,y,w,h,size=26,color=C.ink,bold=false,font='Arial',align='left'){
 const sh=s.shapes.add({geometry:'textbox',name:t.slice(0,50),position:{left:x,top:y,width:w,height:h},fill:'none',line:{fill:'none',width:0}});sh.text=t;sh.text.style={typeface:font,fontSize:size,color,bold,alignment:align,verticalAlignment:'top',autoFit:'none',wrap:'square',insets:{left:0,right:0,top:0,bottom:0}};return sh;
}
function slide(title,sub='',notes='',dark=false){const s=P.slides.add();s.background.fill=dark?C.green:C.paper;const idx=P.slides.items.length;if(title)text(s,title,64,50,1152,112,48,dark?C.white:C.ink,false,'Georgia');if(sub)text(s,sub,66,168,1145,67,23,dark?'#DDE8D7':C.muted);text(s,'YardMatch',64,680,220,24,14,dark?'#DDE8D7':C.muted,true);text(s,String(idx).padStart(2,'0'),1150,680,66,24,14,dark?'#DDE8D7':C.muted,false,'Arial','right');if(notes)s.speakerNotes.textFrame.setText(notes);return s;}
function foot(s,t){text(s,t,66,622,1140,46,16,C.muted);}
function block(s,head,body,x,y,w=510){text(s,head,x,y,w,48,28,C.green,true);text(s,body,x,y+55,w,135,25,C.ink);}
function table(s,values,{x=64,y=247,w=1152,h=325,widths,font=23,highlights=[]}={}){const tb=s.tables.add({rows:values.length,columns:values[0].length,left:x,top:y,width:w,height:h,values,columnWidths:widths});tb.borders.assign({fill:C.paper,width:1,style:'solid'});for(let r=0;r<values.length;r++){tb.rows[r].height=h/values.length;for(let c=0;c<values[0].length;c++){const cell=tb.getCell(r,c);cell.fill=r===0?C.green:highlights.includes(r)?C.light:r%2?C.white:C.paper;cell.text.style={typeface:'Arial',fontSize:r===0?font:font,color:r===0?C.white:C.ink,bold:r===0||highlights.includes(r),alignment:c===0||!/^[$(0-9]/.test(String(values[r][c]))?'left':'right',verticalAlignment:'middle',insets:{left:12,right:12,top:8,bottom:8},autoFit:'none'};}}tables.push(P.slides.items.length);return tb;}
async function image(s,name,x,y,w,h,alt,crop){s.images.add({blob:new Uint8Array(await fs.readFile(assets+name)),contentType:'image/png',alt,fit:'contain',position:{left:x,top:y,width:w,height:h},...(crop?{crop}: {})});}
function chart(s,type,cats,series,position,extra={}){const ch=s.charts.add(type,{position,categories:cats,series,hasLegend:true,chartFill:C.paper,plotAreaFill:C.paper,legend:{position:'bottom',textStyle:{fontSize:19,typeface:'Arial',fill:C.ink}},xAxis:{textStyle:{fontSize:18,typeface:'Arial',fill:C.ink},line:{fill:C.light,width:1}},yAxis:{numberFormatCode:'$0.0',textStyle:{fontSize:17,typeface:'Arial',fill:C.muted},majorGridlines:{fill:'#D9DFD5',width:1}},...extra});applyPresentationChartFont(ch,{fontFamily:'Arial'});charts.push(P.slides.items.length);return ch;}
// 01
{
const s=slide('','','Investor discussion draft. September 20, 2026. '+sources.partner+' '+sources.model);
await image(s,'yardmatch-mower-logo.png',58,48,495,166,'Approved YardMatch mower and checkmark logo');
text(s,'Investing in YardMatch',64,259,1110,182,68,C.green,false,'Georgia');
text(s,'A managed marketplace for homeowners and local service businesses',68,478,1020,74,28,C.ink);
text(s,'Investor discussion draft\nSeptember 2026',68,578,780,62,20,C.muted);
}
// 02
{
const s=slide('The investment thesis','Own a share of the company that helps local service relationships form and continue.',sources.partner+' '+sources.model);
block(s,'A useful first transaction','A qualified recommendation helps a homeowner book and gives a provider a new customer.',66,262,522);
block(s,'An ongoing reason to return','Schedules, service history, arrival updates and issue resolution keep later visits connected.',670,262,520);
text(s,'The opportunity depends on profitable repeat use',66,481,1125,54,33,C.green,true);
text(s,'The broader service mix exposes a pricing gap at $2.99. A local pilot must validate contribution before the company funds expansion.',66,544,1100,73,26);
foot(s,'Investment hypothesis. The model does not assume subscriptions, advertising or repeated finder fees from the same relationship.');
}
// 03
{
const s=slide('Booking is only the start of the work','YardMatch connects the customer request to the provider’s schedule and the crew’s actual visit.',sources.partner+' Customer and provider problems are product hypotheses, not survey findings.');
table(s,[['Customer need','Provider need','YardMatch response'],['A suitable, available business','New work that fits the route','One recommendation and a few qualified backups'],['Confidence about arrival','A schedule crews can execute','Shared job details and arrival updates'],['A dependable next visit','Repeat business without another finder fee','Rebooking, service records and follow-up']],{widths:[350,360,442],h:337,font:25});
foot(s,'Local referrals can supply trust. Direct texting and field-service tools can coordinate work. YardMatch aims to connect discovery with the ongoing job.');
}
// 04
{
const s=slide('One service experience across three roles','Customer, provider and crew share the job while each sees the information needed for their role.',sources.partner);
await image(s,'yardmatch-device-branded-mower.png',404,239,820,370,'Illustrative YardMatch desktop, tablet and mobile concepts');
text(s,'Customer\nBook and follow the visit\n\nProvider\nSchedule and assign work\n\nCrew\nKnow the place and task',66,255,335,335,27);
foot(s,'Illustrative screens and sample data from the partner pitch. They do not show live customers or app-store availability.');
}
// 05
{
const s=slide('Local density benefits both sides','Nearby bookings can fit existing routes and make a provider’s customer base more valuable.',sources.partner+' Map is conceptual. No measured route savings or density effect is claimed.');
await image(s,'yardmatch-client-map-v2.png',64,250,770,333,'Illustrative provider client map and nearby demand');
text(s,'Provider control',882,251,330,45,29,C.green,true);text(s,'The business chooses its service area, capacity and crew assignments.',882,305,325,125,25);
text(s,'Customer trust',882,439,330,45,29,C.green,true);text(s,'Recommendations favor service fit and reliability. Paid placement does not set the order.',882,493,325,116,25);
foot(s,'Route savings and retention effects remain to be measured. Providers handle equipment, insurance, supervision and crew pay.');
}
// 06
{
const s=slide('A finder fee plus $2.99 for every paid service','Providers pay both fees. YardMatch covers modeled processing costs.',sources.partner+' Patrick instructions September 20, 2026: provider pays $2.99 per completed service. '+sources.model+' $45 once per new relationship. One welcome finder-fee waiver per new provider.');
text(s,'$45',68,244,460,96,78,C.green,true);text(s,'Once per new customer/provider pairing,\nafter the first paid completed job',68,346,507,99,27);
text(s,'$2.99',671,244,465,96,78,C.green,true);text(s,'On every paid completed service,\nincluding repeat visits',671,346,507,99,27);
table(s,[['A $60 service','First paid visit','Later paid visit'],['Provider proceeds before business costs','$12.01','$57.01']],{x:64,y:476,w:1152,h:111,widths:[650,251,251],font:23,highlights:[1]});
foot(s,'Welcome offer waives the first $45 finder fee for a new provider. It does not waive the $2.99 service fee. No customer surcharge modeled.');
}
// 07
{
const s=slide('Zocdoc monetizes a different relationship pattern','A new service category does not automatically create a new YardMatch finder fee.',sources.zocdoc+' '+sources.partner);
table(s,[['','Zocdoc','YardMatch'],['Fee event','New patient/provider discovery booking','First paid job in a new customer/provider pair'],['Return to the same provider','No new discovery fee','No new finder fee. $2.99 service fee applies.'],['New category','May introduce a different doctor','May use the same landscaping company'],['Core revenue opportunity','More qualifying new provider connections','More profitable paid visits over time']],{y:246,h:335,widths:[235,432,485],font:23});
foot(s,'Zocdoc also exempts reputation and certain partner bookings. Fewer providers per YardMatch household is a hypothesis. Cross-category finder-fee revenue is zero in this forecast.');
}
// 08
{
const s=slide('Larger jobs increase costs under a flat fee','Repeat contribution after processing and variable costs, before acquisition and fixed overhead.',sources.pricing+' '+sources.model+' Uses 2031 Base volume to allocate account and payout-count costs. Includes payout volume fees, support, infrastructure and loss allowance. ACH cap applied per transaction. No first-job finder fee included.');
table(s,[['Completed service price','Card contribution','ACH contribution'],...[0,1,2,4].map(i=>[whole(B.unit.tickets[i]),money(B.unit.cards[i]),money(B.unit.achs[i])])],{x:64,y:250,w:860,h:302,widths:[310,275,275],font:26});
text(s,money(B.rows[68][4]),963,269,247,67,48,C.red,true);text(s,'Average repeat contribution in the 2031 base mix',965,346,245,136,25);
text(s,'A larger bill does not increase the $2.99 fee',66,569,1139,46,29,C.red,true);
foot(s,'ACH reduces payment costs, but does not make every large job profitable. Processing uses the full bill. Payout fees use provider proceeds. Initial bank-link setup is excluded.');
}
// Service mix
{
const s=slide('$60 is the starting price for basic mowing','Illustrative 2027 inputs before neighborhood and property adjustments. These are assumptions, not provider quotes.',sources.model+' New Service mix schedule. Starting prices: $60, $85, $120, $300, $1,000. Base maintenance visits 20: 60% basic, 30% bundled, 10% expanded. Separate cleanup projects 0.60 and large projects 0.03 per full-season household. New households get half-year exposure. One combined visit is one fee.');
table(s,[['Service','Starting price','Scheduled jobs / household'],['Basic mowing','$60','12.00'],['Mowing + edging / trimming','$85','6.00'],['Expanded maintenance bundle','$120','2.00'],['Mulch / seasonal cleanup','$300','0.60'],['Tree / larger property project','$1,000','0.03']],{y:247,h:355,widths:[570,200,382],font:24});
foot(s,'2027 base: 20 maintenance visits plus 0.63 project jobs per full-season household before capture and completion. Bundles count once. Project visits add $2.99, with no extra finder fee for the same provider.');
}
// Price drivers
{
const s=slide('Property and neighborhood affect the ticket','Mix shifts, larger properties and 3% annual price escalation lift the weighted average over time.',sources.model+' Neighborhood multipliers 1.00 / 1.15 / 1.30, with 2027 shares 70% / 25% / 5% and 2033 shares 55% / 35% / 10%. Property multipliers 1.00 / 1.35 / 1.80, shares 70% / 25% / 5% in 2027 and 60% / 30% / 10% in 2033. Independent distributions compound. Maintenance mix ends 45% basic / 40% bundled / 15% expanded. Project frequency reaches 1.00 cleanup and 0.08 larger project. Same ACH, completion and capture rates across categories.');
text(s,'Neighborhood',66,246,480,43,27,C.green,true);text(s,'Standard, +15%, or +30% pricing',66,295,543,56,25);
text(s,'Property size',670,246,480,43,27,C.green,true);text(s,'Typical, +35%, or +80% pricing',670,295,543,56,25);
table(s,[['Base case','2027','2030','2033'],['Maintenance average price',...[0,3,6].map(i=>money(B.unit.mixRows[45][i]))],['All-job average price',...[0,3,6].map(i=>money(B.rows[15][i]))],['Separate projects / household',...['0.63','0.86','1.08']]],{y:370,h:227,widths:[510,214,214,214],font:25,highlights:[2]});
foot(s,'Multipliers compound. Example: $85 bundle × 1.15 neighborhood × 1.35 property = $131.96 before later-year escalation. Mix and pricing assumptions are editable in the workbook.');
}
// 09
{
const s=slide('Barnegat is a starting market','The investment case requires expansion into many local markets after the first market works.',sources.census+' '+sources.model+' Approximate owner households = 10,265 * 88% = 9,033.2. 500 / 9,033.2 = 5.5%. This is an upper-envelope denominator, not a lawn-care TAM.');
text(s,'10,265',66,252,490,84,64,C.green,true);text(s,'Barnegat households',68,347,500,49,29);
text(s,'88%',675,252,460,84,64,C.green,true);text(s,'Homes occupied by their owners',677,347,510,76,29);
text(s,'500 paying households in the first forecast year',66,460,1138,57,34,C.ink,true);text(s,'About 5.5% of the roughly 9,033 owner households. Actual eligible lawns and willingness to pay remain unmeasured.',68,531,1115,74,27);
foot(s,'Census 2020-2024 estimates. Launch target is illustrative. Later-year household totals require regional and multi-market expansion.');
}
// 10
{
const s=slide('Expansion follows verified local economics','A proposed sequence for acquiring supply and demand without sacrificing service reliability.',sources.partner+' '+sources.model+' These are proposed experiments and decision gates, not completed milestones.');
block(s,'1. Concentrated provider launch','Recruit qualified businesses around neighboring routes. Use the first-client finder-fee waiver.',66,252,526);
block(s,'2. Measured household acquisition','Test local search, neighborhood referrals and provider referrals. Count paying customers, not leads.',672,252,526);
block(s,'3. A complete service season','Measure paid repeat visits, fee acceptance, service quality and cost per completed job.',66,447,526);
block(s,'4. A second local market','Expand only after retention and acquisition economics repeat across providers and neighborhoods.',672,447,526);
}
// 11
{
const s=slide('Product progress and commercial evidence','An early company with working product workflows and commercial assumptions still to validate.',sources.partner+' Sources: repository README.md, ROADMAP.md and docs/agent-status/engineer.md, reviewed September 20, 2026. Local engineering checkpoint evidence is not independent production verification. No founder biography or commercial actuals supplied.');
block(s,'Product foundation','Customer booking and rebooking, provider calendars and client maps, crew assignments, payments and ops workflows.',66,252,532);
block(s,'Launch work remaining','Live payment acceptance, provider onboarding, production readiness and store distribution need independent verification.',672,252,532);
block(s,'Founder and operating team','Patrick leads the company. The model budgets paid staff, including founder compensation. Other owner roles remain to be defined.',66,459,532);
block(s,'Commercial evidence required','No verified revenue, paying customer base, signed provider count or measured retention is claimed in this deck.',672,459,532);
}
// 12
{
const s=slide('What can increase the value of the company','More paying households matter when the relationships remain profitable and stay on the platform.',sources.model+' These effects are hypotheses, not measured network effects or proven competitive advantages.');
table(s,[['Value driver','Evidence an investor can evaluate'],['Household retention','The next season’s paid bookings, not just app activity'],['Provider density','More completed jobs per service area and less unfilled demand'],['Acquisition efficiency','Contribution earned relative to cost per first paying household'],['Operational reliability','On-time visits, fewer service issues and resolved payment failures']],{y:252,h:329,widths:[357,795],font:25});
foot(s,'The model includes completed project fees with existing providers. It assumes no subscription, advertising, recruiting revenue or additional finder fees from those projects.');
}
// 13
{
const s=slide('The forecast makes the assumptions visible','2027-2033 calendar years. No historical operating results are implied.',sources.model+' New households enter halfway through the season. Annual household retention applies before the next service season. Cases share one formula-driven build.');
table(s,[['Driver','Downside','Base','Upside'],['New paying households, 2027 / 2033','300 / 40,000','500 / 160,000','500 / 280,000'],['Annual retention by 2033','65%','80%','85%'],['Maintenance visits per full season','16','20','24'],['Visits kept on platform','80%','90%','95%'],['ACH share, 2027 / 2033','0% / 20%','10% / 60%','20% / 75%'],['Cash CAC, 2027 / 2033','$75 / $50','$55 / $28','$45 / $22']],{y:247,h:355,widths:[510,214,214,214],font:22});
foot(s,'Service mix adds project visits. Base: 95% completion, eight payout-active months, 3 to 36 staff. Downside prices are 15% higher. All cases keep $45 plus $2.99 fees.');
}
// 14
{
const s=slide(`Base revenue reaches ${m(B.rows[26][6],1)} in 2033`,'Net marketplace revenue, US$ millions. Finder fees and recurring fees are distinct revenue streams.',sources.model+' Revenue is finder fees after welcome waivers plus completed paid jobs * $2.99. Charts are editable snapshots of the Base model, not a live workbook link.');
chart(s,'bar',data.years.map(String),[{name:'Finder fees after waivers',values:B.rows[24].map(v=>Number((v/1e6).toFixed(6))),fill:C.sage},{name:'Service fees',values:B.rows[25].map(v=>Number((v/1e6).toFixed(6))),fill:C.green}],{left:62,top:240,width:1156,height:353},{barOptions:{direction:'column',grouping:'stacked',gapWidth:85},yAxis:{min:0,max:20,majorUnit:5,numberFormatCode:'$0.0',textStyle:{fontSize:18,typeface:'Arial',fill:C.muted},majorGridlines:{fill:'#D9DFD5',width:1}}});
foot(s,`Base 2033: ${n(B.rows[10][6])} year-end paying households, ${(B.rows[13][6]/1e6).toFixed(2)}m paid jobs and ${m(B.rows[14][6],1)} GMV. Larger prices lift GMV. Extra completed jobs lift fee revenue.`);
}
// 15
{
const s=slide('The revised base remains loss-making','US$ millions. The broader job mix exposes the cost of retaining a flat $2.99 service fee.',sources.model+' EBITDA excludes depreciation, interest and taxes. EBIT includes equipment depreciation. Net income proxy uses an illustrative 25% tax on positive EBIT with no NOL benefit. Free cash flow includes equipment capex and a 1% annual-GMV restricted risk cash assumption.');
table(s,[['Base forecast',...data.years.map(String)],['Revenue',...B.rows[26].map(v=>m(v).replace('m',''))],['Gross profit',...B.rows[40].map(v=>m(v).replace('m',''))],['EBITDA',...B.rows[51].map(v=>m(v).replace('m',''))],['Operating profit',...B.rows[53].map(v=>m(v).replace('m',''))],['Net income proxy',...B.rows[55].map(v=>m(v).replace('m',''))],['Free cash flow',...B.rows[60].map(v=>m(v).replace('m',''))]],{y:246,h:339,widths:[270,...Array(7).fill(126)],font:20,highlights:[3,5]});
foot(s,`2033 net loss is ${m(-B.rows[55][6])}. Cash use is ${m(-B.rows[60][6])}. Revenue growth does not fix negative repeat contribution. Pricing or payment-cost responsibility must improve before scaling.`);
}
// 16
{
const s=slide('Returns depend on execution, not volume alone','All three cases use the same platform fees. Service prices, retention, acquisition and payment mix change the outcome.',sources.model+' No probability weights are assigned. Upside is a target case, not a forecast with validated inputs.');
table(s,[['Result','Downside','Base','Upside'],['2031 revenue',m(D.rows[26][4]),m(B.rows[26][4]),m(U.rows[26][4])],['2031 EBITDA',m(D.rows[51][4]),m(B.rows[51][4]),m(U.rows[51][4])],['2033 revenue',m(D.rows[26][6]),m(B.rows[26][6]),m(U.rows[26][6])],['2033 net income proxy',m(D.rows[55][6]),m(B.rows[55][6]),m(U.rows[55][6])],['First positive EBITDA year',firstProfit(D),firstProfit(B),firstProfit(U)]],{y:249,h:321,widths:[483,223,223,223],font:24,highlights:[4]});
foot(s,'None of these cases reaches positive EBITDA by 2033. More ACH use helps, but fee economics still need improvement before expansion is financially supported.');
}
// 17
{
const s=slide('Illustrative funding for a pricing pilot','The two-year base budget tests commercial adoption and leaves a reserve for the next financing decision.',sources.model+' Financing illustration: $1.5m gross less $25k transaction expenses. Model opens with zero cash. 2027-2028 budget recalculates from the revised job mix. A finite pilot must repair unit economics before growth funding. Annual model does not establish exact monthly runway.');
table(s,[['2027-2028 base cash plan','Amount'],['Payroll',whole(sum2(49))],['Customer and provider acquisition',whole(sum2(43)+sum2(44))],['Fixed overhead',whole(sum2(50))],['Capex and risk cash',whole(sum2(57)+sum2(59))],['Less gross profit generated',whole(-sum2(40))],['Net cash used',whole(-sum2(60))],['Financing costs','$25,000'],['Remaining cash from $1.5m',whole(B.rows[64][1])]],{x:64,y:243,w:720,h:354,widths:[510,210],font:22,highlights:[6,8]});
text(s,'A first round',836,254,368,57,34,C.green,true);text(s,'Repair repeat economics before financing expansion.',836,325,364,105,27);
text(s,m(B.rows[62][6]),836,463,364,61,45,C.green,true);text(s,'Cash deficit through 2033 if growth continues without fixing pricing.',836,533,364,80,24);
foot(s,`Including the ${m(B.rows[65][6])} buffer implies ${m(B.rows[66][6])}. This is an unrepaired forecast, not a recommended raise. The illustrative $1.5m pilot round and valuation remain unapproved.`);
}
// 18
{
const s=slide('70% founder ownership before new investment','Every new equity round dilutes existing owners proportionately in this illustration.',sources.model+' Patrick instruction: 70% to Patrick, 30% to other initial owners, then dilute per round. Assumes new share issuance, no secondary sales or convertible instruments.');
table(s,[['Ownership','At formation','After round 1','After round 2'],['Patrick','70.0%','56.0%','44.8%'],['Other initial owners','30.0%','24.0%','19.2%'],['Round 1 investors','0.0%','20.0%','16.0%'],['Round 2 investors','0.0%','0.0%','20.0%'],['Total','100.0%','100.0%','100.0%']],{y:252,h:319,widths:[447,235,235,235],font:26,highlights:[1,5]});
foot(s,'Each illustrative round sells 20% post-money. A later 10% option pool would reduce Patrick to 40.32%. Voting and board control require separate terms.');
}
// 19
{
const s=slide('The investor’s return comes from equity value','Illustration: $1.5m buys 20% initially and becomes 16% after one further 20% round.',sources.model+' Equity proceeds arithmetic only. No exit multiple or transaction probability assumed. Initial price implies $6m pre-money and $7.5m post-money. These valuations are not supported by comparable transactions or an agreed term sheet. Equity value assumes distributable proceeds with no senior claims.');
table(s,[['Exit equity value','Initial investor proceeds','Gross multiple'],['$0','$0','0.0x'],['$10m','$1.6m','1.1x'],['$50m','$8.0m','5.3x'],['$100m','$16.0m','10.7x']],{x:64,y:253,w:900,h:297,widths:[270,380,250],font:27});
text(s,'$6.0m',1006,262,206,54,37,C.green,true);text(s,'Illustrative\npre-money value',1006,328,207,87,24);
text(s,'$7.5m',1006,445,206,54,37,C.green,true);text(s,'Illustrative\npost-money value',1006,511,207,87,24);
foot(s,'Return arithmetic, not an exit forecast. Excludes further dilution, option pools, preferences, taxes and fees. The $0 outcome represents a complete loss.');
}
// 20
{
const s=slide('Milestones for the next round','The strongest investment case will rest on paid cohort results from a concentrated launch.',sources.model+' Proposed validation gates, not achieved results. Figures chosen as operating test thresholds rather than claimed industry benchmarks.');
table(s,[['Test','Proposed evidence'],['Demand and retention','500 paying households and measured second-season retention'],['Provider fee acceptance','Repeat visits continue with a $2.99 provider fee'],['Acquisition economics','Cash CAC of $50 or less in year two'],['Positive repeat contribution','At least $0.50 per repeat job across the actual service mix'],['Reliability and expansion','Reliable service and economics reproduced in a second market']],{y:248,h:350,widths:[365,787],font:24});
foot(s,'Material risks: off-platform migration, seasonal cash needs, high-ticket payment costs and service liability. Expansion pauses when contribution or retention misses the gate.');
}
// 21
{
const s=slide('Model mechanics and limits','The companion workbook exposes the formulas and all editable assumptions.',sources.model+' Cohort calculation is undiscounted, five-year contribution using 2031 base economics. No customer lifetime value has been observed.');
block(s,'Households and paid visits','Retained households plus half of new households form the season’s base. Maintenance and separate projects then reflect capture and completion.',66,249,530);
block(s,'The fee gap',`The 2031 base mix needs about ${money(B.unit.breakEvenFees[4])} per service to cover variable costs, before acquisition and fixed overhead. $2.99 remains the modeled fee.`,673,249,530);
block(s,'Profit and cash','Payroll includes founder pay. Fixed costs run all year. Cash also funds equipment and a modeled risk reserve.',66,448,530);
block(s,'A cohort check',`Base 2031 economics imply ${money(B.unit.ltv,0)} of five-year contribution versus $35 CAC, or ${B.unit.ltvCac.toFixed(1)}x. The assumed repeat losses undermine retention value.`,673,448,530);
}
// 22
{
const s=slide('Sources and basis','Prepared September 20, 2026. Financial projections use explicit planning assumptions.',sources.partner+' '+sources.pricing+' '+sources.zocdoc+' '+sources.census+' '+sources.model);
text(s,'Company materials',66,243,390,43,27,C.green,true);text(s,'YardMatch partner pitch, September 2026\nProduct positioning, role concepts, $45 finder fee and welcome offer\nRepository roadmap and engineering status for local product progress',66,294,1142,108,23);
text(s,'External sources',66,407,390,43,27,C.green,true);
const refs=[['Stripe Payments pricing','https://stripe.com/pricing'],['Stripe Connect pricing','https://stripe.com/connect/pricing'],['Stripe Financial Connections pricing','https://stripe.com/financial-connections'],['Zocdoc: Understanding pricing and billing','https://www.zocdoc.com/provider-help/en/articles/10859404-understanding-zocdoc-pricing-and-billing'],['US Census QuickFacts: Barnegat, 2020-2024','https://www.census.gov/quickfacts/fact/table/barnegattownshipoceancountynewjersey/SBO010223']];
refs.forEach(([label,url],i)=>{const sh=text(s,label,66,457+i*29,1138,28,21,C.green);sh.text.get(label).link={uri:url,isExternal:true};});
foot(s,'External references are linked. Full citations are also in PowerPoint notes. Growth, costs, financing terms and exit values are assumptions. No historical financial statements were supplied.');
}
await fs.mkdir(OUT,{recursive:true});await fs.mkdir(ROOT+'/tmp/investor-deck-20260920/final',{recursive:true});await fs.mkdir(TMP+'/slides',{recursive:true});
await (await PresentationFile.exportPptx(P)).save(TMP+'/candidate.pptx');
const result=await finalizePresentation({workspaceDir:ROOT+'/tmp/investor-deck-20260920',candidatePath:TMP+'/candidate.pptx',finalPath:ROOT+'/tmp/investor-deck-20260920/final/YardMatch-Investor-Deck-v5.pptx',pythonExecutable:PY,integrityValidatorPath:SKILL+'/container_tools/inspect_presentation_package_integrity.py',layoutValidatorPath:SKILL+'/container_tools/inspect_presentation_layout_geometry.py',layoutArgs:['--expected-slide-size-emu','12192000,6858000','--validate-bullet-geometry','--validate-heading-fit',...tables.flatMap(x=>['--require-native-table-slide',String(x)])],requiredNativeTableOwnerSlides:tables,requiredNativeChartOwnerSlides:charts,materializeLiteralChartWorkbooks:true,fontPolicy:{basis:'design',families:['Arial','Georgia']},verifyArtifactToolImport:true,receiptPath:TMP+'/validation-v5.json'});
await fs.copyFile(ROOT+'/tmp/investor-deck-20260920/final/YardMatch-Investor-Deck-v5.pptx',OUT+'/YardMatch-Investor-Deck.pptx');
await fs.writeFile(TMP+'/deck-proto.json',JSON.stringify(P.toProto()));
const finalDeck=await PresentationFile.importPptx(await FileBlob.load(OUT+'/YardMatch-Investor-Deck.pptx'));
for(let i=0;i<finalDeck.slides.items.length;i++){const s=finalDeck.slides.items[i],im=await finalDeck.export({slide:s,format:'png',scale:1.5});await fs.writeFile(TMP+`/slides/slide-${i+1}.png`,new Uint8Array(await im.arrayBuffer()));const l=await s.export({format:'layout'});await fs.writeFile(TMP+`/slides/slide-${i+1}.json`,await l.text());}
console.log(JSON.stringify({slides:P.slides.items.length,tables,charts,result},null,2));
