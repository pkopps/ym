import fs from 'node:fs/promises';
import {buildTowns,towns} from './town-expansion.mjs';
import {buildNationalExpansion} from './national-expansion.mjs';
import {buildPayments} from './payments.mjs';
import {buildRevenueStreams} from './revenue-streams.mjs';
import {buildServiceMix} from './service-mix.mjs';
import {Workbook,SpreadsheetFile} from '@oai/artifact-tool';
const ROOT='/Users/patrickkopps/Documents/app';
const OUT=ROOT+'/outputs/investor-deck-20260920';
const TMP=ROOT+'/tmp/investor-deck-20260920/build';
const wb=Workbook.create();
const sheets={}; for(const n of ['Summary','Assumptions','Operating model','Ownership','Unit economics','Service mix','Payments','Revenue streams','National rollout','Town inputs','Town forecast']) sheets[n]=wb.worksheets.add(n);
const years=[2027,2028,2029,2030,2031,2032,2033], cols=['D','E','F','G','H','I','J'];
const C={green:'#205938',ink:'#14281D',paper:'#F7F5EF',sage:'#E9EFDF',blue:'#174DB8',red:'#9D3C30'};
const num='#,##0;(#,##0);"-"', usd='$#,##0;($#,##0);"-"', dec='$0.00;($0.00);"-"';
const put=(s,a,v)=>s.getRange(a).values=[[v]];
const formula=(s,a,f)=>{s.getRange(a).formulas=[[f]];s.getRange(a).format.font.color=f.includes("'!")||f.includes("'!")?C.green:'#111111';};
function top(s,title,last=60){s.showGridLines=false;s.tabColor=C.green;s.getRange(`A1:M${last}`).format.font={name:'Arial',size:11,color:C.ink};s.getRange('A:B').format.columnWidth=2;s.getRange('C:C').format.columnWidth=50;s.getRange('D:J').format.columnWidth=16;s.getRange('K:K').format.columnWidth=3;s.getRange('L:L').format.columnWidth=78;s.getRange(`C1:J${last}`).format.rowHeight=22;s.mergeCells('C1:J2');put(s,'C1',title);s.getRange('C1:J2').format={fill:C.green,font:{name:'Arial',size:20,bold:true,color:'#FFFFFF'}};s.freezePanes.freezeRows(5);s.getRange('D5:J5').values=[years];s.getRange('C5:J5').format={fill:C.sage,font:{bold:true,color:C.ink}};s.getRange(`D6:J${last}`).setNumberFormat(num);}
function band(s,row,label){put(s,'C'+row,label);s.getRange(`C${row}:J${row}`).format={fill:C.sage,font:{bold:true}};}
function note(s,row,txt){s.mergeCells(`C${row}:J${row+1}`);put(s,'C'+row,txt);s.getRange(`C${row}:J${row+1}`).format={wrapText:true,font:{size:10,color:'#66756A'}};}
const a=sheets.Assumptions;top(a,'YardMatch | Forecast assumptions',150);
put(a,'C3','Case selector');put(a,'D3','Base');a.getRange('D3').dataValidation={rule:{type:'list',values:['Downside','Base','Upside']}};a.getRange('D3').format={fill:'#FFF2CE',font:{color:C.blue,bold:true}};
put(a,'C4','Pricing recommendation');put(a,'D4','Proposed');a.getRange('D4').dataValidation={rule:{type:'list',values:['Proposed','Prior $2.99']}};a.getRange('D4').format.font.color=C.blue;
put(a,'L5','Basis / source. All operating drivers are assumptions, not actuals.');a.getRange('L5:L135').format.wrapText=true;
const drivers={};let row=7;
function driver(key,label,base,down,up,format=num,source='Planning assumption, September 20, 2026. No operating actuals supplied.'){
  const arr=x=>Array.isArray(x)?x:Array(7).fill(x);drivers[key]=row;put(a,'C'+row,label+' / active');
  for(let j=0;j<7;j++)formula(a,cols[j]+row,`=IF($D$3="Base",${cols[j]}${row+1},IF($D$3="Downside",${cols[j]}${row+2},${cols[j]}${row+3}))`);
  for(const [i,n,v] of [[1,'Base',base],[2,'Downside',down??base],[3,'Upside',up??base]]){put(a,'C'+(row+i),n);a.getRange(`D${row+i}:J${row+i}`).values=[arr(v)];a.getRange(`D${row+i}:J${row+i}`).format.font.color=C.blue;}
  a.getRange(`D${row}:J${row+3}`).setNumberFormat(format);a.getRange(`C${row}:J${row}`).format.fill=C.sage;put(a,'L'+row,source);row+=5;
}
driver('new','Town acquisition-rate multiplier',1,.60,1.50,'0.00\"x\"','Superseded by Town inputs case settings; household forecast is built from individual towns, not this display.');
driver('ret','Annual household retention',[.70,.70,.75,.78,.80,.80,.80],[.55,.55,.60,.60,.65,.65,.65],[.80,.80,.82,.85,.85,.85,.85],'0.0%');
driver('visits','Maintenance visits / full season',20,16,24,'0.0');
driver('capture','Share of visits kept on platform',.90,.80,.95,'0.0%');
driver('complete','Completion and successful collection',.95,.90,.97,'0.0%');
driver('priceFactor','Service price multiplier',1,1.15,1,'0.00"x"','Service mix builds weighted prices from category, neighborhood, property and escalation. Downside stresses prices 15% above the common mix. No customer tax or tips assumed.');
driver('ach','Service payments processed by YardMatch',0,0,0,'0.0%','Selected model: customers pay providers directly. YardMatch does not process service payments or issue provider payouts.');
driver('cac','Blended acquisition / new household',[55,50,45,40,35,30,28],[75,70,65,60,55,50,50],[45,35,30,28,25,23,22],usd,'Cash customer acquisition per first paying household, including incentives and agency spend. Growth staff salaries in payroll.');
driver('fte','Average paid employees',[3,5,8,12,18,26,36],[3,4,6,8,10,13,16],[3,5,9,15,24,36,52],'0.0');
driver('salary','Fully loaded annual cost / employee',Array.from({length:7},(_,i)=>100000+10000*i/6),null,null,usd,'Option 1 planning budget: average loaded cost increases from $100,000 in 2027 to $110,000 in 2033, including founder pay, taxes and benefits. Five staff cost $550,000 in 2033. Roles and compensation need validation; variable support vendors remain separate.');
driver('overhead','Fixed overhead',[60000,100000,160000,250000,400000,600000,800000],[60000,80000,120000,160000,200000,260000,340000],[60000,100000,180000,300000,500000,800000,1200000],usd,'Fully remote. Insurance, legal, accounting and fixed software remain. Office rent, utilities and facilities are zero. Detail in Town inputs rows 113-117.');
driver('capex','Equipment capex',[15000,25000,40000,60000,90000,130000,180000],null,[15000,25000,45000,75000,120000,180000,260000],usd);
band(a,68,'Shared assumptions');
const fixed=[['finder','Finder fee / typical property',75,dec,'Selected planning price. One fee per customer/provider pair, after first paid completed job.'],['fee','Minimum platform fee / paid service',0,dec,'Selected acquisition-first model: no recurring YardMatch fee. Providers cover payment processing at cost when they use in-app payments. Prior mode reproduces the flat $2.99 inclusive model.'],['newWeight','New household season exposure',.5,'0.0%','Mid-season acquisition. Retained households participate for a full season.'],['capacity','Year-end households / provider',40,num,'Supply sizing assumption. Fractional providers round up.'],['providerRet','Provider annual retention',.85,'0.0%','Supply churn assumption. Replacement providers get the welcome offer.'],['season','Payout-active months / year',8,num,'Seasonal market assumption. Fixed payroll and overhead run all 12 months.'],['payouts','Payouts / active provider month',4.33,'0.00','Weekly batching assumption, not one payout per job.'],['cardPct','Domestic card rate',.029,'0.0%','Stripe standard US pricing, checked Sep 20, 2026: https://stripe.com/pricing'],['cardFixed','Domestic card fixed charge',.30,dec,'Stripe standard US pricing: https://stripe.com/pricing'],['achPct','ACH debit rate',.008,'0.0%','Stripe standard US ACH 0.8%, $5 cap: https://stripe.com/pricing'],['achCap','ACH debit cap',5,dec,'Stripe standard US pricing: https://stripe.com/pricing'],['connectPct','Connect payout volume rate',.0025,'0.00%','US platform-controlled pricing assumption: https://stripe.com/connect/pricing and https://support.stripe.com/questions/monetizing-payments-with-stripe-connect'],['connectFixed','Connect cost / payout',.25,dec,'Same Connect source. Confirm exact contracted account configuration before launch.'],['connectActive','Connect / active account month',2,dec,'Same Connect source. Added to card/ACH processing costs.'],['bankVerify','Allowance / new bank link',1.5,dec,'Conservative Financial Connections allowance. Actual ACH integration may bundle verification: https://stripe.com/financial-connections'],['support','Variable support / completed booking',.15,dec,'Planning allowance for external support labor. Staff salaries separately in payroll.'],['infra','Variable infrastructure / paid job',.10,dec,'Messaging, maps, storage and usage-based infrastructure allowance.'],['loss','Marketplace payment-loss allowance / booking value',0,'0.0%','Zero because YardMatch does not process customer service payments. Finder and subscription billing risk is modeled in Revenue streams.'],['onboard','Acquisition and verification / new provider',75,usd,'Planning allowance beyond waived finder fees and growth staff salaries.'],['waive','Free first pairing / new provider',1,num,'Partner PDF page 9 welcome offer. Only finder fee waived. Processing charges apply when in-app payments are used; no recurring YardMatch service fee applies.'],['tax','Illustrative tax on positive EBIT',.25,'0.0%','Model placeholder only. No loss carryforward benefit assumed. Not an assessed tax rate.'],['reserve','Restricted payment risk cash / booking value',0,'0.0%','Zero because customer service payments flow directly to providers.'],['life','Equipment useful life / years',3,num,'Straight-line from start of acquisition year. Development payroll expensed.'],['raise','Illustrative round 1 gross proceeds',1500000,usd,'Financing illustration, not an agreed valuation or fundraising target.'],['raiseCosts','Round 1 transaction cost',25000,usd,'Planning allowance, paid when round closes.'],['buffer','Fixed operating cost buffer / months',6,num,'Added to peak annual cash deficit to address intra-year seasonality.'],['founder','Initial Patrick ownership',.70,'0.0%','Patrick instruction: 70% founder, 30% other owners before external dilution.'],['round1','Round 1 new investor stake',.20,'0.0%','Illustrative post-money equity issuance. No option pool or convertible instruments assumed.'],['round2','Round 2 new investor stake',.20,'0.0%','Dilution illustration only. Round 2 proceeds are not assumed in cash forecast.']];
for(let i=0;i<fixed.length;i++){let [k,l,v,f,src]=fixed[i],r=69+i;drivers[k]=r;put(a,'C'+r,l);put(a,'D'+r,v);a.getRange('D'+r).format.font.color=C.blue;a.getRange('D'+r).setNumberFormat(f);put(a,'L'+r,src);}
note(a,100,'2027-2033 calendar-year forecast. No historical revenue, paying customer count, signed provider count or cash balance was supplied. Opening forecast balances are zero assumptions.');
note(a,103,'Staffing scales with the national footprint. Selected forecast includes Pro and Teams subscriptions; sponsorship remains off. No worker fees, hiring commissions, customer fees, tax/tip revenue or volume discounts. Projects with the same provider add no new finder fee.');
note(a,106,'Change D3 to switch cases. The same operating model recalculates all outputs. Deck scenarios are dated exports of this model and do not update automatically.');
note(a,109,'Cash analysis excludes existing company cash/debt, financing beyond illustrative round 1 and liquidation preferences. Actual monthly runway requires a hiring and collection calendar.');
band(a,113,'Recommended pricing inputs');
drivers.feePct=114;drivers.pctActive=115;drivers.recover=116;drivers.recoverActive=117;
put(a,'C114','Card platform percentage');put(a,'D114',0);a.getRange('D114').format.font.color=C.blue;a.getRange('D114').setNumberFormat('0.0%');
put(a,'C115','Active card platform percentage');formula(a,'D115','=IF(D4="Proposed",D114,0)');a.getRange('D115').setNumberFormat('0.0%');
put(a,'C116','Service-payment processing recovery');put(a,'D116',0);a.getRange('D116').format.font.color=C.blue;a.getRange('D116').setNumberFormat('0.0%');
put(a,'C117','Active processing recovery');formula(a,'D117','=IF(D4="Proposed",D116,0)');a.getRange('D117').setNumberFormat('0.0%');
put(a,'L114','Selected acquisition-first model: no recurring YardMatch percentage. Customers pay providers directly. No additional adoption is assumed.');
put(a,'L116','Zero because YardMatch does not process customer service payments. Providers use cash, check or their existing payment method.');
note(a,120,'Use $75 / $110 / $150 property-tier finder fees, charged after the first completed paid service per new customer/provider pairing. Larger serviceable properties pay more once at acquisition. Preserve the first-new-client finder-fee waiver for new providers.');
note(a,123,'Zocdoc publicly shows $30-$140 depending on specialty/location. That page references older licensing terms. Current help confirms variable discovery fees, charged at booking. https://www.zocdoc.com/about/understanding-your-bill/');
note(a,126,'Current Zocdoc help: no subscription to join, but Sponsored Results and Practice Solutions can cost extra. Older pages describe free Practice Solutions. Exact quotes control. https://www.zocdoc.com/provider-help/en/articles/10859404-understanding-zocdoc-pricing-and-billing');
band(a,129,'Property-based finder fee / once per new relationship');
put(a,'C130','Finder fee policy');put(a,'D130','Property tiers');a.getRange('D130').dataValidation={rule:{type:'list',values:['Property tiers','Flat $45']}};a.getRange('D130').format.font.color=C.blue;
for(const[k,r,l,v]of [['largeFinder',131,'Large-property finder fee',110],['veryLargeFinder',132,'Very-large-property finder fee',150]]){drivers[k]=r;put(a,'C'+r,l);put(a,'D'+r,v);a.getRange('D'+r).format.font.color=C.blue;a.getRange('D'+r).setNumberFormat(dec);}
drivers.largeFinderActive=133;drivers.veryLargeFinderActive=134;
for(const[r,input,l]of [[133,131,'Active large-property finder fee'],[134,132,'Active very-large-property finder fee']]){put(a,'C'+r,l);formula(a,'D'+r,`=IF(AND(D130="Property tiers",D4="Proposed"),D${input},D69)`);a.getRange('D'+r).setNumberFormat(dec);}
note(a,136,'Planning tiers: $75 typical, $110 large, $150 very large. Classify the serviceable property scope at first match; no income or postcode surcharge. Exact size boundaries require provider quote validation. A new service or bigger later job with the same provider creates no second finder fee.');
note(a,139,'Provider pays after first completed paid job; first-client waiver remains. New-customer property mix, with proportional waivers within each town, determines revenue. Prior $2.99 mode also restores a flat finder fee. No automatic adoption lift from higher pricing.');
drivers.feeActive=118;put(a,'C118','Active recurring fee minimum');formula(a,'D118','=IF(D4="Proposed",D70,2.99)');a.getRange('D118').setNumberFormat(dec);
band(a,143,'ACH platform pricing');drivers.achFeePct=144;drivers.achFeeActive=145;
put(a,'C144','ACH platform percentage');put(a,'D144',0);a.getRange('D144').format.font.color=C.blue;a.getRange('D144').setNumberFormat('0.0%');
put(a,'C145','Active ACH platform percentage');formula(a,'D145','=IF(D4="Proposed",D144,0)');a.getRange('D145').setNumberFormat('0.0%');
note(a,147,'Legacy comparison only. The selected forecast has no YardMatch service-payment flow, card mix, ACH mix or provider payout expense.');
const ref=k=>`'Assumptions'!$D$${drivers[k==='fee'?'feeActive':k]}`, ar=(k,c)=>`'Assumptions'!${c}${drivers[k]}`;
const town=buildTowns({sheets,top,put,formula,band,note,cols,years,ref,ar,C,usd});
const tr=(c,r)=>`'Town forecast'!${c}${r}`;
const national=buildNationalExpansion({sheets,top,put,formula,band,note,cols,years,ref,ar,C,usd});
const nr=(c,r)=>`'National rollout'!${c}${r}`;
// National service-area cohorts drive the consolidated forecast. Named towns remain pilot evidence.
for(const [key,r] of [['new',68],['cac',40],['fte',45],['overhead',50],['capex',81]]){
 put(a,'C'+drivers[key],{new:'New households / national cohorts',cac:'Customer CAC / national rollout',fte:'Employees / national rollout',overhead:'Corporate overhead / national rollout',capex:'Equipment / national staffing'}[key]);
 for(const c of cols)formula(a,c+drivers[key],'='+nr(c,r));
 a.getRange(`C${drivers[key]+1}:J${drivers[key]+3}`).clear({applyTo:'contents'});
 put(a,'L'+drivers[key],'Formula from National rollout. Change footprint, cohort, staffing and cost assumptions on that sheet.');
}
a.getRange('D7:J7').setNumberFormat(num);
const payments=buildPayments({sheets,top,put,formula,band,note,cols,years,ref,ar,C,dec,usd});
const pr=(c,r)=>`'Payments'!${c}${r}`;
const mix=buildServiceMix({sheets,top,put,formula,band,note,cols,ref,ar,C,dec});
const mr=(c,r)=>`'Service mix'!${c}${r}`;
const streams=buildRevenueStreams({sheets,top,put,formula,band,note,cols,years,C,dec,usd});
const sr=(c,r)=>`'Revenue streams'!${c}${r}`;
const b=sheets['Operating model'];top(b,'YardMatch | Operating forecast',86);put(b,'C3','Active case');formula(b,'D3',"='Assumptions'!D3");
const labels={6:'Opening paying households',7:'New paying households',8:'Retained households',9:'Churned households',10:'Ending paying households',11:'Full-season equivalent households',12:'Scheduled maintenance and project bookings',13:'Completed service bookings',14:'Gross booking value / paid directly to providers',15:'Weighted average service price',16:'Opening providers',17:'Retained providers',18:'Ending providers',19:'New/replacement providers',20:'Average active providers',21:'New customer/provider pairs',22:'Welcome finder-fee waivers',24:'Finder-fee revenue',25:'Recurring service-fee revenue',26:'Net marketplace revenue',27:'Provider collections before business costs',28:'Service-payment processing recovery / excluded',29:'Card service-payment processing / excluded',30:'ACH service-payment processing / excluded',31:'Connect volume cost / excluded',32:'Connect payout cost / excluded',33:'Connected-account cost / excluded',34:'New service-payment bank links / excluded',35:'Bank verification / excluded',36:'Variable support',37:'Variable infrastructure',38:'Marketplace payment-loss allowance / excluded',39:'Total cost of revenue',40:'Gross profit',41:'Gross margin',43:'Customer acquisition spend',44:'Provider onboarding spend',45:'Contribution after acquisition',46:'Service-payment build / operations / excluded',47:'Average paid employees',48:'Loaded employee cost',49:'Payroll expense',50:'Fixed overhead',51:'EBITDA',52:'Depreciation',53:'Operating profit / EBIT',54:'Illustrative income taxes',55:'Net income proxy',57:'Equipment capex',58:'Restricted payment risk cash / excluded',59:'Increase in payment risk cash / excluded',60:'Free cash flow before financing',61:'Cumulative free cash flow',62:'Peak cumulative funding deficit to date',63:'Illustrative round 1 net financing',64:'Cash after illustrative round 1 only',65:'Six-month fixed-cost buffer',66:'Capital requirement incl. buffer',68:'Recurring contribution / paid job',69:'Recurring contribution / retained household',70:'YardMatch revenue / gross booking value',72:'Household balance check',73:'Provider balance check',74:'Direct provider payment check',75:'Revenue check',76:'Cash-flow bridge check'};
for(const [r,l] of Object.entries(labels))put(b,'C'+r,l);
Object.assign(labels,{91:'Local launch and coverage spend',26:'Total net revenue',87:'Net subscription revenue',88:'Net sponsored revenue',89:'Incremental add-on cost of revenue',90:'Incremental add-on operating expense'});
for(const r of [26,87,88,89,90,91])put(b,'C'+r,labels[r]);
for(const [idx,c]of cols.entries()){
 const p=cols[idx-1];let f={6:idx?`${p}10`:'0',7:ar('new',c),8:`${c}6*${ar('ret',c)}`,9:`${c}6-${c}8`,10:`SUM(${c}7:${c}8)`,11:`${c}8+${c}7*${ref('newWeight')}`,12:`${c}11*${mr(c,44)}`,13:`${c}12*${ar('capture',c)}*${ar('complete',c)}`,14:`${c}13*${mr(c,46)}`,15:mr(c,46),16:idx?`${p}18`:'0',17:`${c}16*${ref('providerRet')}`,18:`MAX(20,ROUNDUP(${c}10/${ref('capacity')},0))`,19:`MAX(0,${c}18-${c}17)`,20:`${c}17+${c}19*${ref('newWeight')}`,21:`${c}7`,22:`MIN(${c}21,${c}19*${ref('waive')})`,24:`(${c}21-${c}22)*${ref('finder')}`,25:`${c}13*${mr(c,85)}`,26:`SUM(${c}24:${c}25)`,27:`${c}14-${c}26-${c}28`,28:`SUM(${c}29:${c}30)*${ref('recoverActive')}`,29:`${c}13*(1-${ar('ach',c)})*(${mr(c,46)}*${pr(c,22)}+${pr(c,23)})`,30:`${c}13*${ar('ach',c)}*${mr(c,86)}`,31:`${c}27*${pr(c,27)}`,32:`${c}20*${ref('season')}*${ref('payouts')}*${pr(c,28)}`,33:`${c}20*${ref('season')}*${pr(c,29)}`,34:`${c}7*${ar('ach',c)}+${c}8*MAX(0,${ar('ach',c)}-${idx?ar('ach',p):'0'})`,35:`${c}34*${ref('bankVerify')}`,36:`${c}13*${ref('support')}`,37:`${c}13*${ref('infra')}`,38:`${c}14*${ref('loss')}`,39:`SUM(${c}29:${c}33)+SUM(${c}35:${c}38)-${c}28`,40:`${c}26-${c}39`,41:`IF(${c}26=0,0,${c}40/${c}26)`,43:`${c}7*${ar('cac',c)}`,44:`${c}19*${ref('onboard')}`,45:`${c}40-SUM(${c}43:${c}44)`,46:`SUM('Payments'!${c}30:${c}31)`,47:ar('fte',c),48:ar('salary',c),49:`${c}47*${c}48`,50:ar('overhead',c),51:`${c}45-SUM(${c}49:${c}50)-${c}46`,52:`SUM(${cols[Math.max(0,idx-2)]}57:${c}57)/${ref('life')}`,53:`${c}51-${c}52`,54:`MAX(0,${c}53)*${ref('tax')}`,55:`${c}53-${c}54`,57:ar('capex',c),58:`${c}14*${ref('reserve')}`,59:`${c}58-${idx?p+'58':'0'}`,60:`${c}55+${c}52-${c}57-${c}59`,61:`${c}60+${idx?p+'61':'0'}`,62:`MAX(0,-MIN($D$61:${c}61))`,63:idx?'0':`${ref('raise')}-${ref('raiseCosts')}`,64:`${c}60+${c}63+${idx?p+'64':'0'}`,65:`SUM(${c}49:${c}50)*${ref('buffer')}/12`,66:`${c}62+${c}65`,68:`${ref('fee')}-(SUM(${c}29:${c}33)+SUM(${c}36:${c}38))/${c}13`,69:`${c}68*${mr(c,44)}*${ar('complete',c)}*${ar('capture',c)}`,70:`${c}26/${c}14`,72:`${c}6+${c}7-${c}9-${c}10`,73:`${c}17+${c}19-${c}18`,74:`${c}14-${c}26-${c}27-${c}28`,75:`${c}26-${c}24-${c}25`,76:`${c}60-(${c}51-${c}54-${c}57-${c}59)`};
 f[24]=nr(c,85);f[22]=nr(c,84);f[8]=nr(c,67);f[10]=nr(c,69);f[11]=nr(c,70);f[17]=nr(c,73);f[18]=nr(c,72);f[19]=nr(c,74);f[20]=nr(c,75);f[43]=nr(c,76);f[91]=nr(c,80);
 // Customer service payments flow directly to providers. YardMatch bills finder fees and subscriptions separately.
 f[27]=`${c}14`;for(const r of[28,29,30,31,32,33,34,35,38])f[r]='0';
 f[39]=`SUM(${c}36:${c}37)+${c}89`;
 f[46]='0';f[58]='0';f[59]='0';
 f[60]=`${c}55+${c}52-${c}57`;
 f[68]=`-(SUM(${c}36:${c}37)/${c}13)`;
 f[70]=`${c}26/${c}14`;
 f[74]=`${c}14-${c}27`;
 f[76]=`${c}60-(${c}51-${c}54-${c}57)`;
 f[51]+=`-${c}91`;
 f[52]=`SUMIFS($D57:${c}57,$D$5:${c}$5,">"&(${c}$5-${ref('life')}))/${ref('life')}`;
 f[26]=`SUM(${c}24:${c}25)+SUM(${c}87:${c}88)`;
 f[27]=`${c}14`;
 f[39]=`SUM(${c}36:${c}37)+${c}89`;
 f[51]+=`-${c}90`;
 f[65]=`(SUM(${c}49:${c}50)+${sr(c,79)}+${c}91)*${ref('buffer')}/12`;
 f[70]=`${c}26/${c}14`;
 f[74]=`${c}14-${c}27`;
 f[75]=`${c}26-SUM(${c}24:${c}25)-SUM(${c}87:${c}88)`;
 f[87]=sr(c,48);f[88]=sr(c,57);f[89]=sr(c,64);f[90]=sr(c,70);
 f[68]=`-(SUM(${c}36:${c}37)/${c}13)`;
 for(const [r,v]of Object.entries(f))formula(b,c+r,'='+v);
}
for(const r of [14,24,25,26,27,28,29,30,31,32,33,35,36,37,38,39,40,43,44,45,46,48,49,50,51,52,53,54,55,57,58,59,60,61,62,63,64,65,66])b.getRange(`D${r}:J${r}`).setNumberFormat(usd);
for(const r of [41,70])b.getRange(`D${r}:J${r}`).setNumberFormat('0.0%');for(const r of [15,68,69])b.getRange(`D${r}:J${r}`).setNumberFormat(dec);
for(const r of [10,26,40,45,51,53,55,60,64,66])b.getRange(`C${r}:J${r}`).format.fill=C.sage;
b.getRange('D72:J76').setNumberFormat('0.00');b.getRange('D72:J76').conditionalFormats.add('cellIs',{operator:'notEqual',formula:0,format:{fill:'#FDE5DD',font:{color:C.red}}});
note(b,79,'New households contribute half a service season. Retained households contribute a full season. One new pairing per new household. Customers pay providers directly; YardMatch does not process service payments or issue payouts. Bundles count once; project visits add fees but no new finder fee for the same pair.');
note(b,82,'Costs exclude provider labor, equipment and crew compensation because providers bear these costs. Net income is a planning proxy, with no debt, interest, NOL benefit or capitalized development.');
band(b,85,'Provider products and regional operating costs');b.getRange('D87:J91').setNumberFormat(usd);
const s=sheets.Summary;top(s,'YardMatch | Investor model',48);put(s,'C3','Active case');formula(s,'D3',"='Assumptions'!D3");s.getRange('D3').format.font.color=C.green;
const map={7:10,8:18,9:13,10:15,11:14,12:24,13:25,14:26,16:40,17:41,19:43,20:44,21:49,22:50,23:46,24:51,25:53,26:55,28:60,29:61,30:64,32:62,33:65,34:66,36:68};
for(const [rr,br]of Object.entries(map)){put(s,'C'+rr,labels[br]);for(const c of cols)formula(s,c+rr,`='Operating model'!${c}${br}`);s.getRange(`D${rr}:J${rr}`).format.font.color=C.ink;s.getRange(`D${rr}:J${rr}`).setNumberFormat([7,8,9].includes(+rr)?num:+rr===17?'0.0%':[10,36].includes(+rr)?dec:usd);}
for(const r of [14,16,24,26,28,30,34])s.getRange(`C${r}:J${r}`).format.fill=C.sage;
put(s,'C22','Corporate and local operating costs');for(const c of cols)formula(s,c+'22',`='Operating model'!${c}50+'Operating model'!${c}91`);
put(s,'C15','Provider subscriptions / included above');put(s,'C18','Provider product cost of revenue');put(s,'C23','Incremental builds / product operations');
for(const c of cols){formula(s,c+'15',`=SUM('Operating model'!${c}87:${c}88)`);formula(s,c+'18',`='Operating model'!${c}89`);formula(s,c+'23',`='Operating model'!${c}46+'Operating model'!${c}90`);}
s.getRange('D15:J15').setNumberFormat(usd);s.getRange('D18:J18').setNumberFormat(usd);
put(s,'C4','Optional revenue case');formula(s,'D4',"='Revenue streams'!D3");
note(s,39,'All years are illustrative forecasts. GMV belongs to providers before marketplace deductions. Revenue includes acquisition fees and selected provider subscriptions. Customers pay service businesses directly; gross booking value is not YardMatch revenue. This is a management presentation, not an accounting policy opinion.');
note(s,42,'Support and infrastructure create the small negative repeat contribution because YardMatch charges no recurring service fee. Negative cash requires funding or a change in spending. Capital requirement combines the peak cumulative deficit to date with six months of that year\'s fixed costs. It is not a monthly runway model.');
note(s,45,'Forecast starts January 2027 with zero opening balances. Select a case on Assumptions. National rollout controls service-area cohorts, states, staffing and local costs. Named New Jersey towns remain pilot evidence rather than the consolidated footprint.');
const o=sheets.Ownership;top(o,'YardMatch | Ownership and dilution',43);o.getRange('D5:J5').clear({applyTo:'contents'});o.getRange('C5:G5').values=[['Owner','Before financing','After round 1','After round 2','After option pool']];
for(const [i,l]of ['Patrick','Other initial owners','Round 1 investors','Round 2 investors','New option pool','Total ownership'].entries())put(o,'C'+(7+i),l);
formula(o,'D7','='+ref('founder'));formula(o,'D8','=1-D7');for(let r=9;r<=11;r++)put(o,'D'+r,0);
for(let r=7;r<=11;r++){formula(o,'E'+r,r===9?'='+ref('round1'):`=D${r}*(1-${ref('round1')})`);formula(o,'F'+r,r===10?'='+ref('round2'):`=E${r}*(1-${ref('round2')})`);formula(o,'G'+r,r===11?'=$D$21':`=F${r}*(1-$D$21)`);}
for(const c of ['D','E','F','G'])formula(o,c+'12',`=SUM(${c}7:${c}11)`);o.getRange('D7:G12').setNumberFormat('0.0%');
put(o,'C16','Illustrative round 1 proceeds');formula(o,'D16','='+ref('raise'));put(o,'C17','New investor share');formula(o,'D17','='+ref('round1'));put(o,'C18','Implied post-money valuation');formula(o,'D18','=D16/D17');put(o,'C19','Implied pre-money valuation');formula(o,'D19','=D18-D16');put(o,'C21','Optional pool after round 2');put(o,'D21',.10);o.getRange('D21').format.font.color=C.blue;o.getRange('D16:D19').setNumberFormat(usd);o.getRange('D17').setNumberFormat('0.0%');o.getRange('D21').setNumberFormat('0.0%');
note(o,24,'70% / 30% is the requested founding allocation before new investors. Each modeled financing issues new shares and dilutes every existing holder proportionately. The 30% is not reserved as the future investor pool.');
note(o,27,'Round 1 illustrates $1.50m for 20%. Round 2 illustrates 20% dilution only. These terms are not approved or supported by a priced-round valuation analysis.');
note(o,30,'Optional 10% post-round-2 pool shows additional dilution. No SAFEs, convertible notes, warrants, preferred rights or secondary sales. Economic ownership does not determine board or voting control.');
put(o,'C34','Illustrative exit equity value');o.getRange('D34:G34').values=[[0,10000000,50000000,100000000]];o.getRange('D34:G34').format.font.color=C.blue;o.getRange('D34:G34').setNumberFormat(usd);
put(o,'C35','Round 1 gross proceeds, after round 2');put(o,'C36','Round 1 gross investment multiple');for(const c of ['D','E','F','G']){formula(o,c+'35',`=${c}34*$F$9`);formula(o,c+'36',`=${c}35/$D$16`);}o.getRange('D35:G35').setNumberFormat(usd);o.getRange('D36:G36').setNumberFormat('0.0"x"');note(o,39,'Return arithmetic only, not an exit forecast or comparable-company valuation. Uses 16% after round 2, excludes optional pool, taxes, fees, liquidation preferences and further dilution. Complete loss is possible.');
const u=sheets['Unit economics'];top(u,'YardMatch | Relationship economics',58);u.getRange('D5:J5').clear({applyTo:'contents'});u.getRange('C5:F5').values=[['New customer / provider relationship','Typical property','Large property','Very large property']];
const unitLabels={6:'Illustrative first service bill',7:'One-time finder fee',8:'Provider onboarding and verification',9:'Customer acquisition cost / 2031 base',10:'First-relationship contribution before fixed costs',12:'Repeat service price retained by provider',13:'YardMatch recurring service fee',14:'Support + infrastructure per completed booking',15:'YardMatch repeat-job contribution',17:'Illustrative mature-year cohort / 2031',18:'Annual completed bookings / retained household',19:'Annual repeat-service contribution / household',20:'Net finder revenue / new household',21:'Provider onboarding / new household',22:'Customer CAC',23:'First-year contribution after acquisition',24:'Five-year contribution before fixed costs',25:'Five-year contribution / CAC',27:'Provider subscription economics / 2033',28:'Average active providers',29:'Pro-only subscribers',30:'Teams subscribers',31:'Net subscription revenue',32:'Subscription cost of revenue',33:'Subscription operating expense',34:'Subscription EBITDA contribution',36:'National scaling signals / 2033',37:'Active service areas',38:'Active states',39:'Metro clusters',40:'Ending active households',41:'Ending active providers',42:'Gross booking value paid to providers',43:'YardMatch revenue',44:'Revenue / gross booking value'};
for(const[r,l]of Object.entries(unitLabels))put(u,'C'+r,l);
u.getRange('D6:F6').values=[[60,150,500]];u.getRange('D6:F6').format.font.color=C.blue;u.getRange('D6:F6').setNumberFormat(dec);
for(const[c,fee]of [['D','finder'],['E','largeFinderActive'],['F','veryLargeFinderActive']]){formula(u,c+'7','='+ref(fee));formula(u,c+'8','='+ref('onboard'));formula(u,c+'9','='+ar('cac','H'));formula(u,c+'10',`=${c}7-${c}8-${c}9`);formula(u,c+'12',`=${c}6`);put(u,c+'13',0);formula(u,c+'14',`=${ref('support')}+${ref('infra')}`);formula(u,c+'15',`=-${c}14`);}
u.getRange('D7:F15').setNumberFormat(dec);
const uf={18:`${mr('H',44)}*${ar('capture','H')}*${ar('complete','H')}`,19:`'Operating model'!H69`,20:`'Operating model'!H24/'Operating model'!H7`,21:`'Operating model'!H44/'Operating model'!H7`,22:ar('cac','H'),23:`D20-D21-D22+D19*${ref('newWeight')}`,24:`D20-D21-D22+'Operating model'!H68*(D18*${ref('newWeight')}+D18*${ar('ret','H')}+D18*${ar('ret','H')}^2+D18*${ar('ret','H')}^3+D18*${ar('ret','H')}^4)`,25:'D24/D22',28:`'Operating model'!J20`,29:`'Revenue streams'!J43`,30:`'Revenue streams'!J44`,31:`'Operating model'!J87`,32:`'Operating model'!J89`,33:`'Operating model'!J90`,34:'D31-D32-D33',37:nr('J',10),38:nr('J',15),39:nr('J',20),40:`'Operating model'!J10`,41:`'Operating model'!J18`,42:`'Operating model'!J14`,43:`'Operating model'!J26`,44:`'Operating model'!J70`};
for(const[r,v]of Object.entries(uf))formula(u,'D'+r,'='+v);
u.getRange('D18').setNumberFormat('0.0');u.getRange('D19:D24').setNumberFormat(dec);u.getRange('D25').setNumberFormat('0.0"x"');u.getRange('D28:D30').setNumberFormat(num);u.getRange('D31:D34').setNumberFormat(usd);u.getRange('D37:D41').setNumberFormat(num);u.getRange('D42:D43').setNumberFormat(usd);u.getRange('D44').setNumberFormat('0.0%');
for(const r of[10,15,24,25,34,43,44])u.getRange(`C${r}:F${r}`).format.fill=C.sage;
note(u,47,'Customers pay providers directly. YardMatch records the booking and completion but does not touch homeowner service funds or issue provider payouts. The $0 repeat fee protects provider margin; support and infrastructure therefore create a small negative repeat-job contribution.');
note(u,50,'Finder fees are charged once per new customer/provider relationship after the first completed paid job. Pro and Teams subscriptions monetize provider workflow, including crew recruiting, without charging crew members.');
note(u,53,'Five-year contribution is an undiscounted planning calculation using 2031 retention and booking assumptions. It is not observed lifetime value. National outputs depend on the service-area cohort ramp and launch gates.');
// Clear title treatment, and use compact headers on the two shorter views.
for(const [name,sh] of Object.entries(sheets)){
 const title=sh.getRange('C1').values[0][0];sh.unmergeCells('C1:J2');sh.getRange('C1:J2').clear({applyTo:'all'});put(sh,'C2',title.replace(' | ',' - '));sh.getRange('C2').format.font={name:'Arial',size:16,bold:true,color:C.green};
 sh.getRange('C5:J5').format.horizontalAlignment='center';
}
put(u,'C3','Active case');formula(u,'D3',"='Assumptions'!D3");
b.getRange('D72:J76').conditionalFormats.clear();b.getRange('D72:J76').conditionalFormats.addCustom('ABS(D72)>0.000001',{fill:'#FDE5DD',font:{color:C.red}});
// One operating build, recomputed for each scenario used in the static deck.
const captures={};
for(const cas of ['Downside','Base','Upside']){
 put(a,'D3',cas);wb.recalculate();const out={};for(const r of Object.keys(labels))out[r]=b.getRange(`D${r}:J${r}`).values[0];
 captures[cas]={years,rows:out,nationalRows:Object.fromEntries(national.rows.map(r=>[r,national.sheet.getRange(`D${r}:J${r}`).values[0]])),townRows:Object.fromEntries(town.rows.map(r=>[r,town.sheet.getRange(`D${r}:J${r}`).values[0]])),townDetails:town.bases.map(r=>Object.fromEntries(Array.from({length:19},(_,j)=>j+1).map(j=>[j,town.sheet.getRange(`D${r+j}:J${r+j}`).values[0]]))),unit:{relationshipContribution:u.getRange('D10:F10').values[0],repeatContribution:u.getRange('D15').values[0][0],fiveYearContribution:u.getRange('D24').values[0][0],ltvCac:u.getRange('D25').values[0][0],mixRows:Object.fromEntries([43,44,45,46,47,48,49,51,52,53,54,55,57,58,59,60,61,63,64,65,66,67,69,70,85,86,87,88].map(r=>[r,mix.sheet.getRange(`D${r}:J${r}`).values[0]]))}};
}
put(a,'D3','Base');put(streams.sheet,'D3','Subscriptions');put(payments,'D4',0);wb.recalculate();
const readRows=()=>Object.fromEntries(Object.keys(labels).map(r=>[r,b.getRange(`D${r}:J${r}`).values[0]]));
const readStreamRows=()=>Object.fromEntries(streams.rows.map(r=>[r,streams.sheet.getRange(`D${r}:J${r}`).values[0]]));
const streamCases={};
for(const cas of ['Downside','Base','Upside']){put(a,'D3',cas);put(streams.sheet,'D3','Subscriptions');wb.recalculate();streamCases[cas]={rows:readRows(),streamRows:readStreamRows()};}
put(a,'D3','Base');put(streams.sheet,'D3','Subscriptions');wb.recalculate();
// Model integrity and sensitivity checks for the selected direct-payment national model.
for(const ca of Object.values(captures))for(const r of [72,73,74,75,76])for(const v of ca.rows[r])if(Math.abs(v)>1e-7)throw Error('Financial tie-out failed');
for(const [name,ca] of Object.entries(captures))for(const r of [87,88,89])for(const v of ca.nationalRows[r])if(Math.abs(v)>1e-4)throw Error(`National cohort check failed ${name} row ${r}: ${v}`);
if(captures.Base.nationalRows[10][6]!==750||captures.Base.nationalRows[15][6]!==40||captures.Base.nationalRows[20][6]!==50)throw Error('National footprint endpoint failed');
if(Math.abs(captures.Base.rows[49][6]-6600000)>1e-6||captures.Base.rows[47][6]!==60)throw Error('National staffing endpoint failed');
for(const ca of Object.values(captures))for(const r of [28,29,30,31,32,33,34,35,38,46,58,59])for(const v of ca.rows[r])if(Math.abs(v)>1e-7)throw Error('Excluded payment cost leaked into forecast');
const savedAreas=national.sheet.getRange('J7').values[0][0],baseHH=b.getRange('J10').values[0][0],baseRevenue=b.getRange('J26').values[0][0];
put(national.sheet,'J7',savedAreas+50);wb.recalculate();if(b.getRange('J10').values[0][0]<=baseHH||b.getRange('J26').values[0][0]<=baseRevenue)throw Error('National service-area sensitivity failed');put(national.sheet,'J7',savedAreas);wb.recalculate();
const savedPrice=mix.sheet.getRange('D7').values[0][0],savedGMV=b.getRange('D14').values[0][0],savedYardRevenue=b.getRange('D26').values[0][0],savedEbitda=b.getRange('D51').values[0][0];
put(mix.sheet,'D7',savedPrice+10);wb.recalculate();if(b.getRange('D14').values[0][0]<=savedGMV||Math.abs(b.getRange('D26').values[0][0]-savedYardRevenue)>1e-7||Math.abs(b.getRange('D51').values[0][0]-savedEbitda)>1e-7)throw Error('Direct-payment price linkage failed');put(mix.sheet,'D7',savedPrice);wb.recalculate();
const baseFinder=b.getRange('J24').values[0][0],baseServiceRevenue=b.getRange('J25').values[0][0];put(a,'D131',125);wb.recalculate();if(b.getRange('J24').values[0][0]<=baseFinder||Math.abs(b.getRange('J25').values[0][0]-baseServiceRevenue)>1e-7)throw Error('Finder tiers leaked into recurring revenue');put(a,'D131',110);wb.recalculate();
const errors=await wb.inspect({kind:'match',searchTerm:'#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A|#NUM!|#NULL!',options:{useRegex:true,maxResults:20},summary:'formula errors'});console.log(errors.ndjson);
await fs.writeFile(TMP+'/model-data.json',JSON.stringify({captures,streamCases,drivers,years,labels,towns,ownership:o.getRange('D7:G12').values,nationalPlan:{baseServiceAreas:[1,6,25,70,175,400,750],baseStates:[1,1,2,4,10,25,40],baseMetroClusters:[1,1,3,6,14,30,50]}},null,2));
await (await SpreadsheetFile.exportXlsx(wb)).save(OUT+'/YardMatch-Investor-Model.xlsx');
put(streams.sheet,'D3','Subscriptions + sponsorship');wb.recalculate();
for(const range of ['C34:J64','C66:J83']){const im=await wb.render({sheetName:'Revenue streams',range,scale:1.4,format:'png'});await fs.writeFile(TMP+'/Revenue-streams-enabled-'+range.split(':')[0]+'.png',new Uint8Array(await im.arrayBuffer()));}
put(streams.sheet,'D3','Subscriptions');wb.recalculate();
for(const[n,range]of [['National rollout','C1:J32'],['National rollout','C36:J61'],['National rollout','C64:J92'],['Town inputs','C1:J20'],['Town forecast','C1:J39'],['Revenue streams','C1:J30'],['Revenue streams','C34:J83'],['Summary','C1:J46'],['Assumptions','C1:J27'],['Assumptions','C68:D99'],['Operating model','C1:J41'],['Operating model','C43:J91'],['Ownership','C1:J42'],['Unit economics','C1:F56'],['Service mix','C1:J23'],['Service mix','C25:J48'],['Service mix','C50:J90']]){const im=await wb.render({sheetName:n,range,scale:1.4,format:'png'});await fs.writeFile(TMP+'/'+n.replaceAll(' ','-')+'-'+range.split(':')[0]+'.png',new Uint8Array(await im.arrayBuffer()));}
console.log(JSON.stringify({baseRevenue:captures.Base.rows[26],baseEbitda:captures.Base.rows[51],baseNet:captures.Base.rows[55],baseCash:captures.Base.rows[64],capital:captures.Base.rows[66],households:captures.Base.rows[10],providers:captures.Base.rows[18],serviceAreas:captures.Base.nationalRows[10],states:captures.Base.nationalRows[15],metroClusters:captures.Base.nationalRows[20],grossBookingValue:captures.Base.rows[14],down:captures.Downside.rows[51],up:captures.Upside.rows[51]},null,2));
