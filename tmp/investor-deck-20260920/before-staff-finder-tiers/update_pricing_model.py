from pathlib import Path
p=Path('tmp/investor-deck-20260920/build/model.mjs')
s=p.read_text()
s=s.replace("import {buildServiceMix}","import {buildPayments} from './payments.mjs';\nimport {buildServiceMix}")
s=s.replace("'Unit economics','Service mix']","'Unit economics','Service mix','Payments']")
s=s.replace("put(a,'L5'", "put(a,'C4','Pricing recommendation');put(a,'D4','Proposed');a.getRange('D4').dataValidation={rule:{type:'list',values:['Proposed','Prior $2.99']}};a.getRange('D4').format.font.color=C.blue;\nput(a,'L5'")
s=s.replace("['fee','Provider fee / paid completed service',2.99,dec,'Patrick instruction, September 20, 2026. Applies to first and repeat jobs.']", "['fee','Minimum platform fee / paid service',2.99,dec,'Recommended floor. Proposed pricing is MAX($2.99, 1% of bill) plus card/ACH processing at cost. Prior mode reproduces the flat $2.99 inclusive model.']")
needle="const ref=k=>"
block="""band(a,113,'Recommended pricing inputs');
drivers.feePct=114;drivers.pctActive=115;drivers.recover=116;drivers.recoverActive=117;
put(a,'C114','Platform percentage above the minimum');put(a,'D114',.01);a.getRange('D114').format.font.color=C.blue;a.getRange('D114').setNumberFormat('0.0%');
put(a,'C115','Active platform percentage');formula(a,'D115','=IF(D4="Proposed",D114,0)');a.getRange('D115').setNumberFormat('0.0%');
put(a,'C116','Card / ACH cost recovered from providers');put(a,'D116',1);a.getRange('D116').format.font.color=C.blue;a.getRange('D116').setNumberFormat('0.0%');
put(a,'C117','Active processing recovery');formula(a,'D117','=IF(D4="Proposed",D116,0)');a.getRange('D117').setNumberFormat('0.0%');
put(a,'L114','Recommendation: 1% protects margin on larger jobs. $2.99 minimum covers small-job support. No recurring fee cap. Rates are a pilot recommendation, not measured willingness to pay.');
put(a,'L116','Pass only card/ACH processing through at actual cost. YardMatch covers payout/account, bank-link, support and loss allowances. Recovery is excluded from net platform revenue and offsets processing expense.');
note(a,120,'Keep the $45 finder fee at launch, charged after the first completed paid service per new customer/provider pairing. Do not raise it merely to offset recurring losses. Preserve the first-new-client finder-fee waiver for new providers.');
note(a,123,'Zocdoc publicly shows $30-$140 depending on specialty/location. That page references older licensing terms. Current help confirms variable discovery fees, charged at booking. https://www.zocdoc.com/about/understanding-your-bill/');
note(a,126,'Current Zocdoc help: no subscription to join, but Sponsored Results and Practice Solutions can cost extra. Older pages describe free Practice Solutions. Exact quotes control. https://www.zocdoc.com/provider-help/en/articles/10859404-understanding-zocdoc-pricing-and-billing');
"""
s=s.replace(needle,block+needle)
s=s.replace("const mix=buildServiceMix", "const payments=buildPayments({sheets,top,put,formula,band,note,cols,years,ref,ar,C,dec,usd});\nconst pr=(c,r)=>`'Payments'!${c}${r}`;\nconst mix=buildServiceMix")
s=s.replace("27:'Provider proceeds before business costs',", "27:'Provider proceeds before business costs',28:'Processing recovered from providers',")
s=s.replace("45:'Contribution after acquisition',", "45:'Contribution after acquisition',46:'Incremental payment build / operations',")
s=s.replace("25:`${c}13*${ref('fee')}`", "25:`${c}13*${mr(c,85)}`")
s=s.replace("27:`${c}14-${c}26`", "27:`${c}14-${c}26-${c}28`,28:`SUM(${c}29:${c}30)*${ref('recoverActive')}`")
s=s.replace("${c}13*(1-${ar('ach',c)})*${mr(c,48)}", "${c}13*(1-${ar('ach',c)})*(${mr(c,46)}*${pr(c,22)}+${pr(c,23)})")
s=s.replace("30:`${c}13*${ar('ach',c)}*${mr(c,47)}`", "30:`${c}13*${ar('ach',c)}*${mr(c,86)}`")
s=s.replace("31:`${c}27*${ref('connectPct')}`", "31:`${c}27*${pr(c,27)}`")
s=s.replace("${ref('payouts')}*${ref('connectFixed')}","${ref('payouts')}*${pr(c,28)}")
s=s.replace("33:`${c}20*${ref('season')}*${ref('connectActive')}`", "33:`${c}20*${ref('season')}*${pr(c,29)}`")
s=s.replace("39:`SUM(${c}29:${c}33)+SUM(${c}35:${c}38)`", "39:`SUM(${c}29:${c}33)+SUM(${c}35:${c}38)-${c}28`")
s=s.replace("47:ar('fte',c)", "46:`SUM('Payments'!${c}30:${c}31)`,47:ar('fte',c)")
s=s.replace("51:`${c}45-SUM(${c}49:${c}50)`", "51:`${c}45-SUM(${c}49:${c}50)-${c}46`")
s=s.replace("74:`${c}14-${c}26-${c}27`", "74:`${c}14-${c}26-${c}27-${c}28`")
s=s.replace("f[68]=`${ref('fee')}-(SUM(${c}29:${c}30)+SUM(${c}32:${c}33)+SUM(${c}36:${c}38))/${c}13-(${mr(c,46)}-${ref('fee')})*${ref('connectPct')}`", "f[68]=`${mr(c,85)}-(SUM(${c}29:${c}30)-${c}28+SUM(${c}32:${c}33)+SUM(${c}36:${c}38))/${c}13-(${mr(c,46)}-${mr(c,85)}-${c}28/${c}13)*${pr(c,27)}`")
s=s.replace("[14,24,25,26,27,29", "[14,24,25,26,27,28,29").replace("44,45,48,49", "44,45,46,48,49")
s=s.replace("20:44,21:49", "20:44,21:49")
s=s.replace("22:50,24:51", "22:50,23:46,24:51")
s=s.replace("$2.99 applies to every completed service.","Each completed service pays the selected platform fee plus any processing recovery.")
s=s.replace("Revenue includes only the $45 finder fee after waivers and $2.99 per paid completed service.","Revenue includes finder fees after waivers and platform service fees. At-cost processing recovery offsets expense and is excluded from net platform revenue. This is a management presentation, not an accounting policy opinion.")
s=s.replace("Negative repeat contribution requires improved fee economics before scaling.","Pricing and processing responsibility determine repeat contribution.")
s=s.replace("7:'Provider service fee'", "7:'Platform service fee'").replace("9:'After card processing only'", "9:'After processing and cost recovery'").replace("10:'Payout volume cost'", "10:'Payout volume cost / card payment'").replace("19:'Break-even card ticket'", "19:'Price where percentage fee overtakes floor'")
s=s.replace("const f={7:ref('fee'),8:","const f={7:`MAX(${ref('fee')},${c}6*${ref('pctActive')})`,8:")
s=s.replace("`${c}6*${ref('cardPct')}+${ref('cardFixed')}`", "`${c}6*${pr('H',22)}+${pr('H',23)}`")
s=s.replace("9:`${c}7-${c}8`", "9:`${c}7-${c}8*(1-${ref('recoverActive')})`")
s=s.replace("10:`(${c}6-${c}7)*${ref('connectPct')}`", "10:`(${c}6-${c}7-${c}8*${ref('recoverActive')})*${pr('H',27)}`")
s=s.replace("16:`MIN(${c}6*${ref('achPct')},${ref('achCap')})`,17:`${c}7-${c}16-SUM(${c}10:${c}13)`", "16:`MIN(${c}6*${pr('H',24)}+${pr('H',25)},${pr('H',26)})`,17:`${c}7-${c}16*(1-${ref('recoverActive')})-SUM(${c}11:${c}13)-(${c}6-${c}7-${c}16*${ref('recoverActive')})*${pr('H',27)}`")
start=s.index("formula(u,'D19'");end=s.index('\nconst uf=',start)
s=s[:start]+"formula(u,'D19',`=IF(${ref('pctActive')}>0,${ref('fee')}/${ref('pctActive')},0)`);"+s[end:]
s=s.replace("Ticket threshold includes variable losses and operating costs.","The tier crossover is the minimum fee divided by the platform percentage.")
s=s.replace("$2.99 provider-paid fee is deducted from the service price, so processing uses the whole service ticket, without a customer surcharge.","Platform fees and recovered processing are deducted from provider proceeds. Processing uses the full service bill. Customer surcharges are excluded.")
s=s.replace("48:'Blended processing / paid job'", "48:'Processing retained after recovery / job'").replace("52:'Gap versus $2.99 provider fee'", "52:'Average platform fee above break-even'")
start=s.index('for(const c of cols){const f={47:mr(c,46)');end=s.index("\nu.getRange('D47:J52')",start)
s=s[:start]+"""for(const c of cols){const f={47:mr(c,46),48:`(SUM('Operating model'!${c}29:${c}30)-'Operating model'!${c}28)/'Operating model'!${c}13`,49:`('Operating model'!${c}32+'Operating model'!${c}33)/'Operating model'!${c}13+${ref('support')}+${ref('infra')}+${c}47*${ref('loss')}+(${c}47-${mr(c,85)}-'Operating model'!${c}28/'Operating model'!${c}13)*${pr(c,27)}`,50:`'Operating model'!${c}68`,51:`(${c}48+${c}49+${mr(c,85)}*${pr(c,27)})/(1+${pr(c,27)})`,52:`${mr(c,85)}-${c}51`};for(const[r,v]of Object.entries(f))formula(u,c+r,'='+v);}"""+s[end:]
s=s.replace("This is a sensitivity result, not a pricing change.","Break-even holds processing recovery and vendor configuration constant. It is not a recommended selling price.")
s=s.replace("let const", "let const")
# Add pricing and payment captures from the same operating build, not duplicate sheets.
needle="put(a,'D3','Base');wb.recalculate();\n// Price changes"
replacement="""put(a,'D3','Base');wb.recalculate();
const readRows=()=>Object.fromEntries(Object.keys(labels).map(r=>[r,b.getRange(`D${r}:J${r}`).values[0]]));
const pricingCases={Proposed:readRows()};put(a,'D4','Prior $2.99');wb.recalculate();pricingCases.Prior=readRows();put(a,'D4','Proposed');wb.recalculate();
const engineCases={};for(const yr of[2028,2029]){put(payments,'D4',yr);wb.recalculate();engineCases[yr]={rows:readRows(),paymentRows:Object.fromEntries([30,31,33,34,35,36,37,38,40,41,42,43,44,45,46,48,49].map(r=>[r,payments.getRange(`D${r}:J${r}`).values[0]]))};}put(payments,'D4',0);wb.recalculate();
// Price changes"""
s=s.replace(needle,replacement)
s=s.replace("if(Math.abs(s.getRange('H14').values[0][0]-originalSummary-bookings)>1e-5)throw Error('Fee sensitivity failed');", "if(s.getRange('H14').values[0][0]<=originalSummary||s.getRange('H14').values[0][0]-originalSummary>bookings+1e-5)throw Error('Fee floor sensitivity failed');")
s=s.replace("[43,44,45,46,47,48,49,51,52,53,54,55,57,58,59,60,61,63,64,65,66,67,69,70]", "[43,44,45,46,47,48,49,51,52,53,54,55,57,58,59,60,61,63,64,65,66,67,69,70,85,86]")
s=s.replace("JSON.stringify({captures,drivers,years,labels,ownership", "JSON.stringify({captures,pricingCases,engineCases,drivers,years,labels,ownership")
s=s.replace("['Service mix','C50:J81']", "['Service mix','C50:J90'],['Payments','C1:J19'],['Payments','C20:J51']")
p.write_text(s)
# Extend the granular service mix calculations for minimum/percentage fees and alternate ACH caps.
p=Path('tmp/investor-deck-20260920/build/service-mix.mjs');s=p.read_text().replace("',82)","',92)")
start=s.index(' for(const c of cols){');s=s[:start]+" band(x,84,'Proposed pricing and effective processing');put(x,'C85','Weighted platform service fee');put(x,'C86','Effective ACH cost per transaction');\n"+s[start:]
start=s.index('  for(const[r,v]of Object.entries(f))');s=s[:start]+"""  const feeTerms=[],achTerms=[];
  for(let i=0;i<5;i++)for(let n=0;n<3;n++)for(let z=0;z<3;z++){
   const wt=`${c}${51+i}/${c}44*${c}${26+n}*${c}${34+z}`;
   const ticket=`${c}${7+i}*${n===0?'1':c+(n===1?29:30)}*${z===0?'1':c+(z===1?37:38)}*${c}41`;
   feeTerms.push(`${wt}*MAX(${ref('fee')},${ticket}*${ref('pctActive')})`);
   achTerms.push(`${wt}*MIN(${ticket}*'Payments'!${c}24+'Payments'!${c}25,'Payments'!${c}26)`);
  }
  f[85]=feeTerms.join('+');f[86]=achTerms.join('+');
"""+s[start:]
s=s.replace("[45,46,47,48,57", "[85,86,45,46,47,48,57")
s=s.replace("Fees remain $45 once per new pair plus $2.99 per completed service.","Recommended fees: $45 once per new pair, plus MAX($2.99, 1% of bill) and processing at cost per service.")
p.write_text(s)
