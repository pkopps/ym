from pathlib import Path
p=Path('/Users/patrickkopps/Documents/app/tmp/investor-deck-20260920/build');f=p/'deck.mjs';s=f.read_text()
s=s.replace('A $45 finder fee and size-aware service fee can fund ongoing care.','Property-based finder fees and recurring service fees can fund ongoing care.')
start=s.index('// Recommended pricing');end=s.index('// Zocdoc price research',start)
s=s[:start]+'''// Property-based finder fee
{
const s=slide('Finder fees increase with property scope','Proposed acquisition fees, paid by the provider once per new customer/provider relationship.',sources.model+' Typical $45, large $65, very large $90. Planning tiers based on serviceable property scope, not income or ZIP code. Classify at first match and disclose the fee before acceptance. Thresholds require provider quote validation. New-customer town/lot mix determines finder revenue; waivers are proportional within each town. No later service or size change with the same provider generates another finder fee.');
table(s,[['Property tier','Finder fee','Example first bill','Provider proceeds'],...[[ 'Typical',45,60],['Large',65,81],['Very large',90,108]].map(([name,fee,bill])=>[name,whole(fee),whole(bill),money(bill-fee-Math.max(2.99,bill*.01)-bill*.029-.30)])],{y:245,h:244,widths:[316,209,298,329],font:25});
text(s,'Recurring fee: $2.99 minimum or 1% of the bill',66,512,1140,49,31,C.green,true);
text(s,'Providers also cover actual card / ACH processing on each service.',66,568,1140,43,25);
foot(s,'First-job examples use basic mowing, property factors of 1.00 / 1.35 / 1.80, and card processing. Proceeds exclude provider labor and materials. First-client finder waiver remains. Validate acceptance and actual yard-size bands.');
}
''' + s[end:]
s=s.replace('Our $45 is earned after a paid completed job','Our finder fee follows a paid completed job')
s=s.replace('Fee is additional to the $45 finder fee and recurring charges.','Fee is additional to the applicable $45 / $65 / $90 finder fee and recurring charges.')
s=s.replace('3 to 10 paid staff in the base','3 to 5 paid staff in the base').replace('recommended $45 finder fee','proposed property-tier finder fees')
s=s.replace("foot(s,'All three named-town cases remain EBITDA-negative through 2033. Higher adoption alone does not cover the current cost structure. Pricing, acquisition efficiency and staffing need validation.');", "foot(s,`First positive EBITDA: downside ${firstProfit(D)}, base ${firstProfit(B)}, upside ${firstProfit(U)}. All cases cap staffing at five. The model assumes fee acceptance and sufficient team capacity; validate both.`);")
start=s.index("{\nconst s=slide('The next proof");end=s.index('// 17',start)
s=s[:start]+'''{
const before=data.changeBridge.before,staff=data.changeBridge.staffingOnly,after=B.rows;
const s=slide('Five staff and property fees narrow the loss','The comparison holds customer growth, service volume, salaries and other cost assumptions constant.',sources.model+' User requested maximum five staff. Original household-based staffing schedule is retained below that cap. Founder is included. $130,000 fully loaded cost per person in 2033. Property fees are $45 / $65 / $90, with no assumed acquisition or retention improvement. Fee uplift also slightly reduces payout costs.');
table(s,[['2033 base comparison','Before','Five staff only','+ Property fees'],['Paid employees',n(before[47][6]),n(staff[47][6]),n(after[47][6])],['Payroll',whole(before[49][6]),whole(staff[49][6]),whole(after[49][6])],['Finder-fee revenue',whole(before[24][6]),whole(staff[24][6]),whole(after[24][6])],['Total revenue',m(before[26][6]),m(staff[26][6]),m(after[26][6])],['EBITDA',whole(before[51][6]),whole(staff[51][6]),whole(after[51][6])]],{y:246,h:329,widths:[441,237,237,237],font:23,highlights:[5]});
foot(s,`Payroll saves ${whole(before[49][6]-staff[49][6])} per year. Property fees add ${whole(after[24][6]-staff[24][6])} in annual finder revenue. The base still needs better economics; no efficiency gain or price acceptance is treated as proven.`);
}
''' + s[end:]
s=s.replace('ten paid employees','five paid employees')
s=s.replace('Deck-v10.pptx','Deck-v11.pptx').replace('validation-v10.json','validation-v11.json')
f.write_text(s)
# Update lingering labels in source notes.
f=p/'service-mix.mjs';s=f.read_text().replace('Recommended fees: $45 once per new pair','Proposed fees: $45 / $65 / $90 once per new pair, by property scope');f.write_text(s)
