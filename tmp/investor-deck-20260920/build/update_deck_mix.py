from pathlib import Path
p=Path('tmp/investor-deck-20260920/build/deck.mjs');s=p.read_text()
s=s.replace("const pct=v=>Math.round(v*100)+'%';", "const pct=v=>Math.round(v*100)+'%';\nconst whole=v=>(v<0?'(':'')+'$'+n(Math.abs(v))+(v<0?')':'');\nconst firstProfit=ca=>{const i=ca.rows[51].findIndex(v=>v>0);return i<0?'None by 2033':String(data.years[i]);};\nconst sum2=r=>B.rows[r][0]+B.rows[r][1];")
s=s.replace("The opportunity depends on profitable repeat use","The opportunity depends on profitable repeat use")
s=s.replace("Local density can lower acquisition and operating costs. Each expansion must demonstrate those savings before it earns more capital.","The broader service mix exposes a pricing gap at $2.99. A local pilot must validate contribution before the company funds expansion.")
a=s.index('// 08\n');z=s.index('// 09\n',a)
s=s[:a]+"""// 08
{
const s=slide('Larger jobs increase costs under a flat fee','Repeat contribution after processing and variable costs, before acquisition and fixed overhead.',sources.pricing+' '+sources.model+' Uses 2031 Base volume to allocate account and payout-count costs. Includes payout volume fees, support, infrastructure and loss allowance. ACH cap applied per transaction. No first-job finder fee included.');
table(s,[['Completed service price','Card contribution','ACH contribution'],...[0,1,2,4].map(i=>[whole(B.unit.tickets[i]),money(B.unit.cards[i]),money(B.unit.achs[i])])],{x:64,y:250,w:860,h:302,widths:[310,275,275],font:26});
text(s,money(B.rows[68][4]),963,269,247,67,48,C.red,true);text(s,'Average repeat contribution in the 2031 base mix',965,346,245,136,25);
text(s,'A larger bill does not increase the $2.99 fee',66,569,1139,46,29,C.red,true);
foot(s,'ACH reduces payment costs, but does not make every large job profitable. Figures exclude initial bank-link setup. Processing and payout costs use the full service bill.');
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
"""+s[z:]
s=s.replace("The model assigns no revenue to subscriptions, provider recruiting fees, advertising or specialist cross-sell. These remain optional future tests.","The model includes completed project fees with existing providers. It assumes no subscription, advertising, recruiting revenue or additional finder fees from those projects.")
s=s.replace("'Scheduled visits per full season'","'Maintenance visits per full season'")
s=s.replace("Base: $60 service ticket, 95% completion/collection, eight payout-active months, 3 to 36 paid employees. All cases retain $45 plus $2.99 pricing.","Service mix adds project visits. Base: 95% completion, eight payout-active months, 3 to 36 staff. Downside prices are 15% higher. All cases keep $45 plus $2.99 fees.")
s=s.replace("'Base revenue reaches $17.9m in 2033'", "`Base revenue reaches ${m(B.rows[26][6],1)} in 2033`")
s=s.replace("foot(s,'Base 2033: 292,448 year-end paying households, 3.63m paid visits and $218.0m GMV. The $218.0m is service volume, not YardMatch revenue.');", "foot(s,`Base 2033: ${n(B.rows[10][6])} year-end paying households, ${(B.rows[13][6]/1e6).toFixed(2)}m paid jobs and ${m(B.rows[14][6],1)} GMV. Larger prices lift GMV. Extra completed jobs lift fee revenue.`);")
s=s.replace("'Base operating profitability arrives in 2033','US$ millions. The company funds several loss-making years before reaching this scale.'", "'The revised base remains loss-making','US$ millions. The broader job mix exposes the cost of retaining a flat $2.99 service fee.'")
s=s.replace("foot(s,'2033 net income is $0.48m, while free cash flow is ($0.56m) because growth requires more risk cash and equipment. Profit and cash generation differ.');", "foot(s,`2033 net loss is ${m(-B.rows[55][6])}; cash use is ${m(-B.rows[60][6])}. Revenue growth does not fix negative repeat contribution. Pricing or payment-cost responsibility must improve before scaling.`);")
s=s.replace("'Retention, acquisition and payment mix change the outcome.'","'Retention, acquisition and payment mix change the outcome.'")
s=s.replace("['First positive EBITDA year','None through 2033','2033','2031']", "['First positive EBITDA year',firstProfit(D),firstProfit(B),firstProfit(U)]")
s=s.replace("In the downside case, larger service tickets and low ACH use make repeat contribution negative through 2032. More such transactions deepen the loss.","None of these cases reaches positive EBITDA by 2033. More ACH use helps, but fee economics still need improvement before expansion is financially supported.")
s=s.replace("'An illustrative $1.5m first round funds validation'","'Illustrative funding for a pricing pilot'")
s=s.replace("2027-2028 projected FCF burn $1.053m and ending cash $421,907.","2027-2028 budget recalculates from the revised job mix. A finite pilot must repair unit economics before growth funding.")
s=s.replace("['Payroll','$825,000']","['Payroll',whole(sum2(49))]")
s=s.replace("['Customer and provider acquisition','$158,125']","['Customer and provider acquisition',whole(sum2(43)+sum2(44))]")
s=s.replace("['Fixed overhead','$160,000']","['Fixed overhead',whole(sum2(50))]")
s=s.replace("['Capex and risk cash','$56,416']","['Capex and risk cash',whole(sum2(57)+sum2(59))]")
s=s.replace("['Less gross profit generated','($146,448)']","['Less gross profit generated',whole(-sum2(40))]")
s=s.replace("['Net cash used','$1,053,093']","['Net cash used',whole(-sum2(60))]")
s=s.replace("['Remaining cash from $1.5m','$421,907']","['Remaining cash from $1.5m',whole(B.rows[64][1])]")
s=s.replace("'The base case needs further funding from 2029.'","'Repair repeat economics before financing expansion.'")
s=s.replace("text(s,'$7.30m',", "text(s,m(B.rows[62][6]),")
s=s.replace("Cumulative base cash deficit through 2033, before a liquidity buffer.","Cash deficit through 2033 if growth continues without fixing pricing.")
s=s.replace("foot(s,'A six-month 2033 fixed-cost buffer adds $2.74m, for $10.04m in the model. Financing amounts and valuation are illustrative, not agreed terms.');", "foot(s,`Including the ${m(B.rows[65][6])} buffer implies ${m(B.rows[66][6])}. This is an unrepaired forecast, not a recommended raise. The illustrative $1.5m pilot round and valuation remain unapproved.`);")
s=s.replace("'Payment mix supports at least $0.50 per paid repeat visit'","'At least $0.50 per repeat job across the actual service mix'")
s=s.replace("'A cohort check','Base 2031 economics imply about $89 of five-year contribution per acquired household versus $35 CAC, or 2.6x. This is an assumption test.'", "'A cohort check',`Base 2031 economics imply ${money(B.unit.ltv,0)} of five-year contribution versus $35 CAC, or ${B.unit.ltvCac.toFixed(1)}x. The assumed repeat losses undermine retention value.`")
s=s.replace("'Retained households plus half of new households form the season’s service base. Visits then reflect platform capture and completion.'","'Retained households plus half of new households form the season’s base. Maintenance and separate projects then reflect capture and completion.'")
s=s.replace("'Revenue and cost','$45 per new pairing after waivers, plus $2.99 per paid visit. Processing uses the whole service ticket. Crew costs stay with the provider.'", "'The fee gap',`The 2031 base mix needs about ${money(B.unit.breakEvenFees[4])} per service to cover variable costs, before acquisition and fixed overhead. $2.99 remains the modeled fee.`")
s=s.replace("Deck-v3.pptx","Deck-v4.pptx").replace("validation-v3.json","validation-v4.json")
p.write_text(s)
