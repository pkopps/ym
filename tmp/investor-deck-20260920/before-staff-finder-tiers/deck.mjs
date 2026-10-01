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
const T=B.townRows, towns=data.towns;
const totalHH=towns.reduce((v,t)=>v+t.households,0);
const censusNotes=towns.map(t=>t.name+': https://www.census.gov/quickfacts/fact/table/'+t.slug+'/PST045225').join(' ; ');
const C={ink:'#14281D',green:'#205938',sage:'#8EAA79',light:'#E8EDDF',paper:'#F7F5EF',muted:'#66756A',red:'#A24D3E',white:'#FFFFFF'};
const P=Presentation.create({slideSize:{width:1280,height:720}}), tables=[], charts=[];
const assets=ROOT+'/output/pdf/assets/';
const sources={partner:'Source: YardMatch-Barnegat-Partner-Pitch.pdf, September 2026, pages 1-9. Product illustrations and sample data are conceptual, not commercial traction.',pricing:'Sources checked September 20, 2026: https://stripe.com/pricing ; https://stripe.com/connect/pricing ; https://support.stripe.com/questions/monetizing-payments-with-stripe-connect ; https://stripe.com/financial-connections . US domestic card and platform-controlled Connect assumptions. Exact commercial account terms require confirmation.',zocdoc:'Source checked September 20, 2026: https://www.zocdoc.com/provider-help/en/articles/10859404-understanding-zocdoc-pricing-and-billing . Discovery versus reputation bookings, one-time new patient/provider connection fee. Not every new-doctor booking is chargeable. YardMatch behavior is a planning hypothesis.',census:'Source: US Census Bureau QuickFacts, Barnegat township, Ocean County, New Jersey, 2020-2024 estimates. https://www.census.gov/quickfacts/fact/table/barnegattownshipoceancountynewjersey/PST045225 . 10,265 households and 88.0% owner occupancy. Lawn eligibility and outsourcing propensities are separate planning assumptions in Town inputs.',model:'Source: YardMatch-Investor-Model.xlsx, assumptions and formula-driven Operating model, prepared September 20, 2026. All 2027-2033 figures are illustrative forecasts, not actuals or promises. US dollars. No commercial actuals supplied.'};
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
text(s,'A $45 finder fee and size-aware service fee can fund ongoing care. Providers also cover payment processing at cost. A pilot must validate acceptance and retention.',66,544,1100,73,26);
foot(s,'Investment hypothesis. Core forecasts use finder and service fees. Optional provider subscriptions and sponsorship appear as separate expansion cases.');
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
// Recommended pricing
{
const s=slide('Keep the finder fee. Repair the recurring fee.','Recommendation for the launch pilot. All charges are paid by the provider.',sources.pricing+' '+sources.model+' This is proposed investor-model pricing, not a live product change. $45 after the first completed paid service in each new relationship; first-client welcome waiver remains. Recurring platform fee is MAX($2.99,1% of service bill), plus actual card/ACH processing. YardMatch absorbs Connect account/payout, bank verification, support and loss allowances.');
text(s,'$45',68,244,460,86,70,C.green,true);text(s,'Once per new customer/provider pair,\nafter the first paid completed job',68,340,507,87,26);
text(s,'$2.99 minimum',671,244,535,86,53,C.green,true);text(s,'Or 1% of the service bill, if higher,\nplus actual card / ACH processing',671,340,540,87,26);
table(s,[['A $60 card-paid service','First paid visit','Later paid visit'],['Provider proceeds before business costs','$9.97','$54.97']],{x:64,y:476,w:1152,h:111,widths:[650,251,251],font:23,highlights:[1]});
foot(s,'Keep the first-client finder-fee waiver. A $45 acquisition charge is already substantial on a $60 first visit; validate season-long value before increasing it. No customer surcharge modeled.');
}
// Zocdoc price research
{
const s=slide('What Zocdoc charges its providers','A useful acquisition benchmark, with a different charging event and repeat-use pattern.',sources.zocdoc+' https://www.zocdoc.com/about/understanding-your-bill/ publicly lists $30-$140 by specialty/location but also refers to annual licensing. Treat as published reference, not a verified current nationwide quote. Current provider help says no upfront/subscription to join, Sponsored Results can cost extra and Practice Solutions has a monthly per-provider fee. Older https://www.zocdoc.com/about/newpricing/ says Practice Solutions is free; current help is prioritized.');
text(s,'$30–$140',66,242,516,82,64,C.green,true);text(s,'Published range for a new-patient booking',68,333,499,86,28);
text(s,'Exact quote varies',675,246,523,50,32,C.green,true);text(s,'Current help confirms specialty and location affect the fee. Providers see their actual price in the dashboard.',677,309,521,120,27);
table(s,[['Zocdoc Marketplace rule','Implication for YardMatch'],['Charges at booking, even a no-show','Our $45 is earned after a paid completed job'],['Repeat visits to the same provider are free','Our retained service fee funds ongoing work']],{y:463,h:138,widths:[565,587],font:22});
foot(s,'The range appears on a page with older license language; it is not a current universal quote. Joining is free; paid add-ons exist. Current help and published range are linked in sources.');
}
// 07
{
const s=slide('Zocdoc monetizes a different relationship pattern','A new service category does not automatically create a new YardMatch finder fee.',sources.zocdoc+' '+sources.partner);
table(s,[['','Zocdoc','YardMatch'],['Fee event','New patient/provider discovery booking','First paid job in a new customer/provider pair'],['Return to the same provider','No new discovery fee','No new finder fee. Service + processing fees apply.'],['New category','May introduce a different doctor','May use the same landscaping company'],['Core revenue opportunity','More qualifying new provider connections','More profitable paid visits over time']],{y:246,h:335,widths:[235,432,485],font:23});
foot(s,'Zocdoc also exempts reputation and certain partner bookings. Fewer providers per YardMatch household is a hypothesis. Cross-category finder-fee revenue is zero in this forecast.');
}
// Provider bill and retained margin
{
const s=slide('A larger job pays a proportionate service fee','Recurring provider charges include the platform fee and payment processing, with no finder fee on repeats.',sources.pricing+' '+sources.model+' Standard US card rate 2.9% + $0.30. ACH 0.8% capped at $5. Platform fee max($2.99,1% of job price). Initial bank-link cost and Connect account/payout fees borne by YardMatch. Repeat contribution uses 2031 volume allocation. No provider labor or equipment expense deducted.');
table(s,[['Service bill','Platform fee','Total if card','Total if ACH'],...[60,100,300,1000,2500].map(v=>[whole(v),money(Math.max(2.99,v*.01)),money(Math.max(2.99,v*.01)+v*.029+.30),money(Math.max(2.99,v*.01)+Math.min(v*.008,5))])],{x:64,y:251,w:860,h:327,widths:[230,190,220,220],font:24});
text(s,money(B.rows[68][4]),963,269,247,67,48,C.green,true);text(s,'Average repeat contribution in the 2031 base mix',965,347,245,133,25);
foot(s,'Recurring platform pricing changes above $299. A bundle on one invoice counts once. Processing recovery is excluded from net platform revenue. Fees still require provider acceptance testing.');
}
// Service mix
{
const s=slide('$60 is the starting price for basic mowing','Illustrative 2027 inputs before neighborhood and property adjustments. These are assumptions, not provider quotes.',sources.model+' New Service mix schedule. Starting prices: $60, $85, $120, $300, $1,000. Base maintenance visits 20: 60% basic, 30% bundled, 10% expanded. Separate cleanup projects 0.60 and large projects 0.03 per full-season household. New households get half-year exposure. One combined visit is one fee.');
table(s,[['Service','Starting price','Scheduled jobs / household'],['Basic mowing','$60','12.00'],['Mowing + edging / trimming','$85','6.00'],['Expanded maintenance bundle','$120','2.00'],['Mulch / seasonal cleanup','$300','0.60'],['Tree / larger property project','$1,000','0.03']],{y:247,h:355,widths:[570,200,382],font:24});
foot(s,'2027 base: 20 maintenance visits plus 0.63 project jobs per full-season household before capture and completion. Bundles count once. Project visits pay the service fee plus processing, with no new finder fee for the same provider.');
}
// Price drivers
{
const s=slide('Property and neighborhood affect the ticket','Named town launches, service mix and 3% annual price escalation determine the weighted average.',sources.model+' Town forecast weights are based on full-season household exposure. Town-specific price tiers use 1.00 / 1.15 / 1.30, with lot factors 1.00 / 1.35 / 1.80. Correlated joint weights replace the former independent demographic mixes. All town price and lot assumptions are unvalidated. Income is not proof of lot size or willingness to pay.');
text(s,'Neighborhood',66,246,480,43,27,C.green,true);text(s,'Standard, +15%, or +30% pricing',66,295,543,56,25);
text(s,'Property size',670,246,480,43,27,C.green,true);text(s,'Typical, +35%, or +80% pricing',670,295,543,56,25);
table(s,[['Base case','2027','2030','2033'],['Maintenance average price',...[0,3,6].map(i=>money(B.unit.mixRows[45][i]))],['All-job average price',...[0,3,6].map(i=>money(B.rows[15][i]))],['Separate projects / household',...['0.63','0.86','1.08']]],{y:370,h:227,widths:[510,214,214,214],font:25,highlights:[2]});
foot(s,'Multipliers compound. Example: $85 bundle × 1.15 neighborhood × 1.35 property = $131.96 before later-year escalation. Town / lot weights stay correlated. Pricing assumptions are editable and need provider quotes.');
}
// Geographic demand and launch plan
{
const s=slide('Barnegat demand now has a defined funnel','Census facts anchor the denominator. Lawn eligibility and willingness to hire are assumptions.',sources.census+' '+sources.model+' '+censusNotes);
table(s,[['Barnegat launch funnel','Households'],['Census occupied households','10,265'],['Owner-occupied estimate: 88%','9,033'],['Assumed lawn-care eligibility: 75%','6,775'],['Assumed propensity to hire: 45%',n(T[8][0])],['2027 active customers after supply cap',n(B.rows[10][0])]],{y:245,h:331,widths:[862,290],font:25,highlights:[5]});
foot(s,`Base acquisition starts at 8% of the never-acquired outsourcing pool. Six planned providers × 40 households cap launch at ${n(B.rows[10][0])}. No provider commitments or measured hiring propensity are claimed.`);
}
{
const s=slide('A named rollout from Ocean to Monmouth County','Illustrative launch years. Each town has its own demand pool, provider plan, acquisition cost and local budget.',sources.model+' '+censusNotes);
table(s,[['Year','New towns','Total towns'],['2027','Barnegat','1'],['2028','Stafford, Lacey, Ocean / Waretown','4'],['2029','Berkeley, Toms River','6'],['2030','Brick, Jackson','8'],['2031','Howell, Wall','10'],['2032','Middletown, Holmdel','12'],['2033','Colts Neck, Rumson','14']],{y:245,h:355,widths:[154,805,193],font:24});
foot(s,'Municipal boundaries avoid overlapping CDPs or county totals. Ocean / Waretown refers to Ocean township in Ocean County. Launches remain conditional on supply, paid retention and service reliability.');
}
{
const s=slide('Affluent towns affect demand and job value','Income and home values are observed. Outsourcing, yard sizes and price tiers remain explicit hypotheses.',sources.model+' '+censusNotes+' Census ACS 2020-2024; income in 2024 dollars. Rumson median income is top-coded at $250,000+. Higher house value does not itself establish turf area.');
table(s,[['Town','Median income','Assumed hiring','Large / very large lots'],...['Barnegat','Stafford','Wall','Holmdel','Colts Neck','Rumson'].map(name=>{const t=towns.find(t=>t.name===name);return[t.name,whole(t.income)+(t.incomeCapped?'+':''),pct(t.outsource),pct(t.large)+' / '+pct(t.estate)];})],{y:245,h:343,widths:[270,250,230,402],font:23});
foot(s,'Hiring share applies only to eligible owner households. Lot shares apply to modeled customers, not all housing. Premium towns also have higher cash CAC assumptions; no automatic retention improvement is assumed.');
}
{
const s=slide('The regional plan is bounded by demand and supply','The household curve is now a sum of town cohorts, with launch timing and local capacity enforced.',sources.model+' '+censusNotes);
table(s,[['Base regional forecast','2027','2030','2033'],['Launched towns',...[0,3,6].map(i=>n(T[7][i]))],['Assumed outsourcing households',...[0,3,6].map(i=>n(T[8][i]))],['Active YardMatch households',...[0,3,6].map(i=>n(B.rows[10][i]))],['Qualified household capacity',...[0,3,6].map(i=>n(T[14][i]))],['Local launch + annual coverage',...[0,3,6].map(i=>whole(T[23][i]))]],{y:245,h:326,widths:[489,221,221,221],font:24,highlights:[3]});
foot(s,`${n(totalHH)} Census households across 14 towns support an assumed ${n(T[8][6])}-household outsourcing pool. The base captures ${pct(T[29][6])} as active customers by 2033. No unnamed national expansion is included.`);
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
foot(s,'The model includes completed project fees with existing providers. Core forecasts exclude optional provider products. Those expansion cases do not add extra finder fees for the same relationship.');
}
// Optional business subscriptions
{
const s=slide('Provider subscriptions add a software business','Proposed monthly prices for optional features. Transaction fees still apply.',sources.model+' Revenue streams sheet. Proposed products, not shipped features or validated demand. Market reference checked September 20, 2026: https://www.getjobber.com/pricing/ lists Core at $49/month, no commitment, one user, and Connect at $139/month, no commitment, one user. These are feature/billing references, not direct product equivalence.');
table(s,[['Plan','Provider price','Reason to pay'],['Core marketplace','$0 subscription','Booking, job details, crew assignments and essential communication'],['Pro','$49 / month','Job margin reports, quote follow-ups and advanced business reporting'],['Teams, including Pro','$99 / month','Timesheet approvals / exports, labor budgets and crew utilization']],{y:246,h:318,widths:[304,247,601],font:25});
foot(s,'Pro and Teams are mutually exclusive. Core service delivery remains accessible. The optional model allows nine paid months per year and makes no assumed retention or customer-acquisition improvement.');
}
// Crew monetization
{
const s=slide('Crew tools have a business buyer','Landscaping businesses pay for advanced team tools. Individual crew members pay $0.',sources.model+' Provider-owned crew engagement and compensation follow ROADMAP.md. Proposed optional Teams features must add value beyond essential tools already included in the core service. Worker-paid job access, wage deductions and mandatory paid credentials are excluded from the model.');
block(s,'Value for the business owner','Connect approved time to labor budgets. Compare crew utilization and job margin. Export records to existing payroll software.',66,252,536);
block(s,'Access for the crew member','View assignments, communicate about the job and submit essential service records through the core product.',674,252,536);
text(s,'A $99 Teams plan includes the $49 Pro features',66,493,1140,51,32,C.green,true);
text(s,'Later options include employer-funded recruiting or optional training partnerships. Neither contributes revenue to this forecast.',66,550,1140,67,25);
foot(s,'Basic coordination supports completion and retention. Charging workers to access required job tools would add adoption friction without a clear benefit.');
}
// Sponsored option proposal
{
const s=slide('Sponsored visibility can be a controlled pilot','Proposed fee: $15 extra after a new relationship completes a paid first job of $150 or more.',sources.model+' Primary source: https://www.zocdoc.com/provider-help/en/articles/8709753-how-much-does-sponsored-results-cost . Zocdoc charges sponsored fees above booking fees using bid-based advertising. YardMatch proposal differs: completed-first-job fee, no repeat-pair charge, one disclosed option within qualified backups. ROADMAP.md currently keeps sponsorship dormant and main recommendations quality-first. This is a commercial experiment, not an approved ranking change.');
table(s,[['Pilot rule','Customer and provider effect'],['One labeled sponsored option','More visibility within a small set of qualified backups'],['Service fit, capacity and quality gates','Payment cannot qualify an unsuitable provider'],['Quality-first main recommendation','Sponsorship does not buy the main recommendation'],['$150 monthly provider budget cap','Pay only for an attributed, completed new relationship']],{y:246,h:321,widths:[444,708],font:24});
foot(s,'Fee is additional to the $45 finder fee and recurring charges. No repeat-pair fee. Existing customers and canceled jobs are excluded. Measure incremental business with a holdout before wider rollout.');
}
// Optional revenue economics
{
const S=data.streamCases.Base['Subscriptions'],A=data.streamCases.Base['Subscriptions + sponsorship'];
const s=slide('Optional products need more scale to pay back','Illustrative 2033 results using the same base household and provider volumes. Stripe remains in place.',sources.model+' Pro-only adoption 30%, Teams adoption 12%, nine paid months, using the active-provider totals in the town forecast. Subscription net revenue after 2% credits/noncollection. Sponsorship: 12% provider participation, 27% first-job eligibility, 30% sponsored selection, capped by budget. No incremental households or GMV assumed. Subscription launch 2028, $120k build, annual fixed costs start $60k grow 35%; sponsorship launch 2030, $50k build, annual costs start $30k grow 30%. Variable delivery, card processing and 0.7% Billing fees also included.');
table(s,[['2033 result','Core only','+ Subscriptions','+ Sponsorship'],['Optional annual net revenue','$0',m(S.streamRows[59][6]),m(A.streamRows[59][6])],['Total net revenue',m(B.rows[26][6]),m(S.rows[26][6]),m(A.rows[26][6])],['EBITDA',m(B.rows[51][6]),m(S.rows[51][6]),m(A.rows[51][6])],['Net income proxy',m(B.rows[55][6]),m(S.rows[55][6]),m(A.rows[55][6])],['First positive EBITDA year',firstProfit(B),firstProfit(S),firstProfit(A)]],{y:246,h:328,widths:[447,235,235,235],font:23,highlights:[3,4]});
foot(s,`Final column includes both subscriptions and sponsorship. Their combined 2033 EBITDA impact is ${whole(A.streamRows[72][6])} after incremental costs. Early spending still increases cash needs. Adoption is unvalidated.`);
}
// 13
{
const s=slide('The core forecast makes the assumptions visible','2027-2033 calendar years. Optional subscriptions and sponsorship are excluded from these core cases.',sources.model+' New households enter halfway through the season. Annual household retention applies before the next service season. Cases share one formula-driven build.');
table(s,[['Driver','Downside','Base','Upside'],['New households, 2027 / 2033',...[D,B,U].map(c=>n(c.rows[7][0])+' / '+n(c.rows[7][6]))],['Annual retention by 2033','65%','80%','85%'],['Maintenance visits per full season','16','20','24'],['Visits kept on platform','80%','90%','95%'],['ACH share, 2027 / 2033','0% / 20%','10% / 60%','20% / 75%'],['Cash CAC, 2027 / 2033',...[D,B,U].map(c=>whole(c.townRows[27][0])+' / '+whole(c.townRows[27][6]))]],{y:247,h:355,widths:[510,214,214,214],font:22});
foot(s,'Service mix adds project visits. Base: 95% completion, eight payout-active months, 3 to 10 paid staff in the base. Downside prices are 15% higher. All cases use the recommended $45 finder fee and recurring fee plus processing.');
}
// 14
{
const s=slide(`Base revenue reaches ${m(B.rows[26][6],1)} in 2033`,'Net marketplace revenue, US$ millions. Finder fees and recurring fees are distinct revenue streams.',sources.model+' Revenue is finder fees after welcome waivers plus per-transaction MAX($2.99,1% of price). Processing recovery offsets expense and is excluded from net marketplace revenue. Charts are editable snapshots of the Base model, not a live workbook link.');
chart(s,'bar',data.years.map(String),[{name:'Finder fees after waivers',values:B.rows[24].map(v=>Number((v/1e6).toFixed(6))),fill:C.sage},{name:'Service fees',values:B.rows[25].map(v=>Number((v/1e6).toFixed(6))),fill:C.green}],{left:62,top:240,width:1156,height:353},{barOptions:{direction:'column',grouping:'stacked',gapWidth:85},yAxis:{min:0,max:1.2,majorUnit:.3,numberFormatCode:'$0.0',textStyle:{fontSize:18,typeface:'Arial',fill:C.muted},majorGridlines:{fill:'#D9DFD5',width:1}}});
foot(s,`Base 2033: ${n(B.rows[10][6])} year-end paying households, ${(B.rows[13][6]/1e6).toFixed(2)}m paid jobs and ${m(B.rows[14][6],1)} GMV. Revenue excludes GMV and processing passed through at cost.`);
}
// 15
{
const s=slide('The regional base remains loss-making','US$ millions. Recommended pricing; Stripe retained throughout. Growth and fee acceptance are assumptions.',sources.model+' EBITDA excludes depreciation, interest and taxes. EBIT includes equipment depreciation. Net income proxy uses an illustrative 25% tax on positive EBIT with no NOL benefit. Free cash flow includes equipment capex and a 1% annual-GMV restricted risk cash assumption.');
table(s,[['Base forecast',...data.years.map(String)],['Revenue',...B.rows[26].map(v=>m(v).replace('m',''))],['Gross profit',...B.rows[40].map(v=>m(v).replace('m',''))],['EBITDA',...B.rows[51].map(v=>m(v).replace('m',''))],['Operating profit',...B.rows[53].map(v=>m(v).replace('m',''))],['Net income proxy',...B.rows[55].map(v=>m(v).replace('m',''))],['Free cash flow',...B.rows[60].map(v=>m(v).replace('m',''))]],{y:246,h:339,widths:[270,...Array(7).fill(126)],font:20,highlights:[3,5]});
foot(s,`2033 net income proxy: ${m(B.rows[55][6])}. Free cash flow: ${m(B.rows[60][6])}. No positive EBITDA year appears through 2033. Staffing, acquisition and local coverage exceed contribution at this scale.`);
}
// 16
{
const s=slide('Returns depend on execution, not volume alone','All three cases use the same platform fees. Service prices, retention, acquisition and payment mix change the outcome.',sources.model+' No probability weights are assigned. Upside is a target case, not a forecast with validated inputs.');
table(s,[['Result','Downside','Base','Upside'],['2031 revenue',m(D.rows[26][4]),m(B.rows[26][4]),m(U.rows[26][4])],['2031 EBITDA',m(D.rows[51][4]),m(B.rows[51][4]),m(U.rows[51][4])],['2033 revenue',m(D.rows[26][6]),m(B.rows[26][6]),m(U.rows[26][6])],['2033 net income proxy',m(D.rows[55][6]),m(B.rows[55][6]),m(U.rows[55][6])],['First positive EBITDA year',firstProfit(D),firstProfit(B),firstProfit(U)]],{y:249,h:321,widths:[483,223,223,223],font:24,highlights:[4]});
foot(s,'All three named-town cases remain EBITDA-negative through 2033. Higher adoption alone does not cover the current cost structure. Pricing, acquisition efficiency and staffing need validation.');
}
{
const s=slide('The next proof is company-level economics','The named-town model replaces an unbounded expansion curve. It does not support the former profitability claim.',sources.model+' Prior build used 160,000 new households in 2033 without a local-market denominator. Revised forecast only includes the named municipalities. Fee sensitivity is arithmetic at unchanged volume, staffing, retention and acquisition, not a price recommendation.');
const requiredFee=B.unit.companyBreakEvenFees[6];
block(s,'Positive repeat contribution',`About ${money(B.rows[68][6])} per paid repeat job in 2033, before customer acquisition and company overhead.`,66,250,532);
block(s,'A company-level funding gap',`${m(B.rows[26][6])} of annual revenue does not cover ten paid employees, acquisition and regional operations. EBITDA is ${m(B.rows[51][6])}.`,674,250,532);
block(s,'A pricing sensitivity',`At fixed volume and costs, the average service fee needs to rise from ${money(B.unit.mixRows[85][6])} to about ${money(requiredFee)} per paid job for EBITDA break-even.`,66,450,532);
block(s,'Evidence before faster expansion','Test fee acceptance, leaner staffing and paid retention. Each new market needs its own demand forecast and launch budget.',674,450,532);
foot(s,'The fee sensitivity includes the small payout-cost reduction from retaining a higher fee. It assumes no customer or provider response and is not a validated price.');
}
// 17
{
const s=slide('Illustrative funding for a pricing pilot','The two-year base budget tests commercial adoption and leaves a reserve for the next financing decision.',sources.model+' Financing illustration: $1.5m gross less $25k transaction expenses. Model opens with zero cash. 2027-2028 budget recalculates from the revised job mix. A finite pilot must validate proposed pricing and unit economics before growth funding. Annual model does not establish exact monthly runway.');
table(s,[['2027-2028 base cash plan','Amount'],['Payroll',whole(sum2(49))],['Customer and provider acquisition',whole(sum2(43)+sum2(44))],['Corporate + local operating costs',whole(sum2(50)+sum2(91))],['Capex and risk cash',whole(sum2(57)+sum2(59))],['Less gross profit generated',whole(-sum2(40))],['Net cash used',whole(-sum2(60))],['Financing costs','$25,000'],['Remaining cash from $1.5m',whole(B.rows[64][1])]],{x:64,y:243,w:720,h:354,widths:[510,210],font:22,highlights:[6,8]});
text(s,'A first round',836,254,368,57,34,C.green,true);text(s,'Validate fee acceptance and retention before financing expansion.',836,325,364,105,27);
text(s,m(B.rows[62][6]),836,463,364,61,45,C.green,true);text(s,'Peak cumulative cash deficit before financing under the revised base case.',836,533,364,80,24);
foot(s,`Adding the ${m(B.rows[65][6])} 2033 fixed-cost buffer gives ${m(B.rows[66][6])}, before financing fees. The $1.5m round is an initial pilot illustration; follow-on capital would be needed.`);
}
// Payment ownership
{
const s=slide('Owning payments does not mean free payments','An internal transaction engine can replace software layers. Banks and payment networks still carry costs.',sources.pricing+' https://usa.visa.com/support/small-business/regulations-fees.html explains interchange and acquiring-bank merchant discounts. https://www.frbservices.org/resources/fees/ach-2026 lists financial-institution ACH fees, not end-merchant prices. https://www.pcisecuritystandards.org/standards/pci-dss/ covers card-data security obligations. '+sources.model+' Alternative assumptions are unquoted estimates.');
table(s,[['Cost category','What a build can change'],['Gateway, ledger and reconciliation','Own the workflow; maintain and support it'],['Card networks and acquiring banks','Negotiate rates; interchange and banking costs remain'],['ACH, payouts and verification','Replace vendors; bank and rail costs remain'],['Fraud, disputes and security','Fund operations and retain risk controls']],{y:248,h:316,widths:[440,712],font:24});
text(s,'Negotiate pricing before funding a replacement engine',66,578,1140,37,28,C.green,true);
foot(s,'Base forecast keeps Stripe. Build options use replacement processing rates, development cost and incremental annual operations. No zero-cost payments assumption is used.');
}
// Build decision
{
const E2=data.engineCases['2028'],E3=data.engineCases['2029'];
const s=slide('Year-two or year-three build: wait for the scale','Same base volumes and proposed fees. Savings are measured against continuing with Stripe.',sources.model+' Payments sheet: $600k build expensed half before launch and half at launch; $300k incremental annual operations growing 3%. Assumed alternative card 2.35%+$0.12, ACH min(0.10%+$0.25,$1.50), payout 0.10%+$0.10, active account $1/month. Unquoted estimates inclusive of replacement processing/network costs. Provider recovery stays 100%, so card/ACH savings are passed through. Table impact is pre-tax and includes build/run costs.');
table(s,[['Build assumption / outcome','Live in 2028','Live in 2029'],['Build + migration cost','$600,000','$600,000'],['Annual operations at launch','$300,000','$300,000'],['2033 provider processing savings',m(E2.paymentRows[43][6]),m(E3.paymentRows[43][6])],['2033 net platform benefit',whole(E2.paymentRows[45][6]),whole(E3.paymentRows[45][6])],['Cumulative platform impact to 2033',whole(E2.paymentRows[46][6]),whole(E3.paymentRows[46][6])]],{y:246,h:331,widths:[570,291,291],font:23,highlights:[5]});
foot(s,'Neither build option covers annual run costs or recovers the investment by 2033 at the modeled regional scale. Gate a build on quoted costs and payback, not a calendar date.');
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
table(s,[['Test','Proposed evidence'],['Demand and retention','240 launch households; measure second-season paid retention'],['Provider fee acceptance','Repeat bookings persist under the proposed total fees'],['Acquisition economics','Pilot CAC around $55; test a path below $50'],['Positive repeat contribution','At least $0.50 per repeat job across the actual service mix'],['Reliability and expansion','Reliable service and economics reproduced in a second market']],{y:248,h:350,widths:[365,787],font:24});
foot(s,'Material risks: off-platform migration, seasonal cash needs, high-ticket payment costs and service liability. Expansion pauses when contribution or retention misses the gate.');
}
// 21
{
const s=slide('Model mechanics and limits','The companion workbook exposes the formulas and all editable assumptions.',sources.model+' Cohort calculation is undiscounted, five-year contribution using 2031 base economics. No customer lifetime value has been observed.');
block(s,'Households and paid visits','Retained households plus half of new households form the season’s base. Maintenance and separate projects then reflect capture and completion.',66,249,530);
block(s,'Retained service economics',`The 2031 base mix retains ${money(B.rows[68][4])} per repeat job after variable costs. Processing is recovered at cost; acquisition and fixed overhead remain separate.`,673,249,530);
block(s,'Profit and cash','Payroll includes founder pay. Fixed costs run all year. Cash also funds equipment and a modeled risk reserve.',66,448,530);
block(s,'A cohort check',`Base 2031 economics imply ${money(B.unit.ltv,0)} of five-year contribution versus ${whole(T[27][4])} CAC, or ${B.unit.ltvCac.toFixed(1)}x. This assumes retention and unchanged cohort economics.`,673,448,530);
}
// 22
{
const s=slide('Sources and basis','Prepared September 20, 2026. Financial projections use explicit planning assumptions.',sources.partner+' '+sources.pricing+' '+sources.zocdoc+' '+sources.census+' '+sources.model);
text(s,'Company materials',66,243,390,43,27,C.green,true);text(s,'YardMatch partner pitch, September 2026\nProduct positioning, role concepts, $45 finder fee and welcome offer\nRepository roadmap and engineering status for local product progress',66,294,1142,108,23);
text(s,'External sources',66,407,390,43,27,C.green,true);
const refs=[['Stripe Payments pricing','https://stripe.com/pricing'],['Stripe Connect pricing','https://stripe.com/connect/pricing'],['Stripe Financial Connections','https://stripe.com/financial-connections'],['Zocdoc: current pricing help','https://www.zocdoc.com/provider-help/en/articles/10859404-understanding-zocdoc-pricing-and-billing'],['Zocdoc: published booking-fee range','https://www.zocdoc.com/about/understanding-your-bill/'],['Visa: interchange and merchant fees','https://usa.visa.com/support/small-business/regulations-fees.html'],['Federal Reserve: ACH fees','https://www.frbservices.org/resources/fees/ach-2026'],['PCI Security Standards Council','https://www.pcisecuritystandards.org/standards/pci-dss/'],['Census QuickFacts: Barnegat','https://www.census.gov/quickfacts/fact/table/barnegattownshipoceancountynewjersey/PST045225'],['Jobber: software pricing','https://www.getjobber.com/pricing/'],['Zocdoc: Sponsored Results cost','https://www.zocdoc.com/provider-help/en/articles/8709753-how-much-does-sponsored-results-cost'],['Stripe Billing pricing','https://stripe.com/billing/pricing']];
refs.forEach(([label,url],i)=>{const x=i<6?66:672,y=457+(i%6)*27;const sh=text(s,label,x,y,541,26,19,C.green);sh.text.get(label).link={uri:url,isExternal:true};});
foot(s,'External references are linked. Full citations are also in PowerPoint notes. Growth, costs, financing terms and exit values are assumptions. No historical financial statements were supplied.');
}
for(let batch=0;batch<2;batch++){
 const group=towns.slice(batch*7,batch*7+7);
 const s=slide('Geographic evidence and planning inputs',`Census QuickFacts sources ${batch*7+1}–${batch*7+group.length}. All links open the underlying municipal table.`,censusNotes+' ACS 2020-2024 occupied-household and owner-occupancy estimates. Income in 2024 dollars. Figures are held constant through the forecast; no Census prediction is implied.');
 const tb=table(s,[['Municipality','Households','Owner share','Median income'],...group.map(t=>[t.name,n(t.households), (t.owner*100).toFixed(1)+'%',whole(t.income)+(t.incomeCapped?'+':'')])],{y:244,h:350,widths:[454,215,215,268],font:23});
 group.forEach((t,i)=>{tb.getCell(i+1,0).text.get(t.name).link={uri:'https://www.census.gov/quickfacts/fact/table/'+t.slug+'/PST045225',isExternal:true};});
 foot(s,'Lawn eligibility, outsourcing, lot size, price premiums, launch timing and capacity are YardMatch assumptions, not Census findings. Editable sources and inputs appear in the workbook.');
}
await fs.mkdir(OUT,{recursive:true});await fs.mkdir(ROOT+'/tmp/investor-deck-20260920/final',{recursive:true});await fs.mkdir(TMP+'/slides',{recursive:true});
await (await PresentationFile.exportPptx(P)).save(TMP+'/candidate.pptx');
const result=await finalizePresentation({workspaceDir:ROOT+'/tmp/investor-deck-20260920',candidatePath:TMP+'/candidate.pptx',finalPath:ROOT+'/tmp/investor-deck-20260920/final/YardMatch-Investor-Deck-v10.pptx',pythonExecutable:PY,integrityValidatorPath:SKILL+'/container_tools/inspect_presentation_package_integrity.py',layoutValidatorPath:SKILL+'/container_tools/inspect_presentation_layout_geometry.py',layoutArgs:['--expected-slide-size-emu','12192000,6858000','--validate-bullet-geometry','--validate-heading-fit',...tables.flatMap(x=>['--require-native-table-slide',String(x)])],requiredNativeTableOwnerSlides:tables,requiredNativeChartOwnerSlides:charts,materializeLiteralChartWorkbooks:true,fontPolicy:{basis:'design',families:['Arial','Georgia']},verifyArtifactToolImport:true,receiptPath:TMP+'/validation-v10.json'});
await fs.copyFile(ROOT+'/tmp/investor-deck-20260920/final/YardMatch-Investor-Deck-v10.pptx',OUT+'/YardMatch-Investor-Deck.pptx');
await fs.writeFile(TMP+'/deck-proto.json',JSON.stringify(P.toProto()));
const finalDeck=await PresentationFile.importPptx(await FileBlob.load(OUT+'/YardMatch-Investor-Deck.pptx'));
for(let i=0;i<finalDeck.slides.items.length;i++){const s=finalDeck.slides.items[i],im=await finalDeck.export({slide:s,format:'png',scale:1.5});await fs.writeFile(TMP+`/slides/slide-${i+1}.png`,new Uint8Array(await im.arrayBuffer()));const l=await s.export({format:'layout'});await fs.writeFile(TMP+`/slides/slide-${i+1}.json`,await l.text());}
console.log(JSON.stringify({slides:P.slides.items.length,tables,charts,result},null,2));
