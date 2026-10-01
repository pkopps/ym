from pathlib import Path
p=Path('/Users/patrickkopps/Documents/app/tmp/investor-deck-20260920/build/deck.mjs')
s=p.read_text()
def replace(old,new):
 global s
 assert old in s,old[:100]
 s=s.replace(old,new)
replace("The broader service mix exposes a pricing gap at $2.99. A local pilot must validate contribution before the company funds expansion.","A $45 finder fee and size-aware service fee can fund ongoing care. Providers also cover payment processing at cost. A pilot must validate acceptance and retention.")
start=s.index('// 06\n');end=s.index('// 07\n',start)
s=s[:start]+'''// Recommended pricing
{
const s=slide('Keep the finder fee. Repair the recurring fee.','Recommendation for the launch pilot. All charges are paid by the provider.',sources.pricing+' '+sources.model+' This is proposed investor-model pricing, not a live product change. $45 after the first completed paid service in each new relationship; first-client welcome waiver remains. Recurring platform fee is MAX($2.99,1% of service bill), plus actual card/ACH processing. YardMatch absorbs Connect account/payout, bank verification, support and loss allowances.');
text(s,'$45',68,244,460,86,70,C.green,true);text(s,'Once per new customer/provider pair,\\nafter the first paid completed job',68,340,507,87,26);
text(s,'$2.99 minimum',671,244,535,86,53,C.green,true);text(s,'Or 1% of the service bill, if higher,\\nplus actual card / ACH processing',671,340,540,87,26);
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
''' +s[end:]
replace('No new finder fee. $2.99 service fee applies.','No new finder fee. Service + processing fees apply.')
start=s.index('// 08\n');end=s.index('// Service mix',start)
s=s[:start]+'''// Provider bill and retained margin
{
const s=slide('A larger job pays a proportionate service fee','Recurring provider charges include the platform fee and payment processing, with no finder fee on repeats.',sources.pricing+' '+sources.model+' Standard US card rate 2.9% + $0.30. ACH 0.8% capped at $5. Platform fee max($2.99,1% of job price). Initial bank-link cost and Connect account/payout fees borne by YardMatch. Repeat contribution uses 2031 volume allocation. No provider labor or equipment expense deducted.');
table(s,[['Service bill','Platform fee','Total if card','Total if ACH'],...[60,100,300,1000,2500].map(v=>[whole(v),money(Math.max(2.99,v*.01)),money(Math.max(2.99,v*.01)+v*.029+.30),money(Math.max(2.99,v*.01)+Math.min(v*.008,5))])],{x:64,y:251,w:860,h:327,widths:[230,190,220,220],font:24});
text(s,money(B.rows[68][4]),963,269,247,67,48,C.green,true);text(s,'Average repeat contribution in the 2031 base mix',965,347,245,133,25);
foot(s,'Recurring platform pricing changes above $299. A bundle on one invoice counts once. Processing recovery is excluded from net platform revenue. Fees still require provider acceptance testing.');
}
''' +s[end:]
replace('Project visits add $2.99, with no extra finder fee for the same provider.','Project visits pay the service fee plus processing, with no new finder fee for the same provider.')
replace('All cases keep $45 plus $2.99 fees.','All cases use the recommended $45 finder fee and recurring fee plus processing.')
replace('Revenue is finder fees after welcome waivers plus completed paid jobs * $2.99.','Revenue is finder fees after welcome waivers plus per-transaction MAX($2.99,1% of price). Processing recovery offsets expense and is excluded from net marketplace revenue.')
replace('Larger prices lift GMV. Extra completed jobs lift fee revenue.','Revenue excludes GMV and processing passed through at cost.')
replace("'The revised base remains loss-making','US$ millions. The broader job mix exposes the cost of retaining a flat $2.99 service fee.'","'The revised base turns profitable in 2032','US$ millions. Recommended pricing; Stripe retained throughout. Growth and fee acceptance are assumptions.'")
replace('`2033 net loss is ${m(-B.rows[55][6])}. Cash use is ${m(-B.rows[60][6])}. Revenue growth does not fix negative repeat contribution. Pricing or payment-cost responsibility must improve before scaling.`','`2033 net income proxy: ${m(B.rows[55][6])}. Free cash flow: ${m(B.rows[60][6])}. Annual cash remains negative through 2032 because growth also funds equipment and the risk reserve.`')
replace('None of these cases reaches positive EBITDA by 2033. More ACH use helps, but fee economics still need improvement before expansion is financially supported.','Positive EBITDA arrives in 2031 in the upside and 2032 in the base; the downside remains negative through 2033. Provider fee acceptance and paid retention are critical.')
replace('A finite pilot must repair unit economics before growth funding.','A finite pilot must validate proposed pricing and unit economics before growth funding.')
replace('Repair repeat economics before financing expansion.','Validate fee acceptance and retention before financing expansion.')
replace('Cash deficit through 2033 if growth continues without fixing pricing.','Peak cumulative cash deficit before financing under the revised base case.')
replace('`Including the ${m(B.rows[65][6])} buffer implies ${m(B.rows[66][6])}. This is an unrepaired forecast, not a recommended raise. The illustrative $1.5m pilot round and valuation remain unapproved.`','`Adding the ${m(B.rows[65][6])} 2033 fixed-cost buffer gives ${m(B.rows[66][6])}, before financing fees. The $1.5m round is an initial pilot illustration; follow-on capital would be needed.`')
replace("'Repeat visits continue with a $2.99 provider fee'","'Repeat bookings persist under the proposed total fees'")
replace("block(s,'The fee gap',`The 2031 base mix needs about ${money(B.unit.breakEvenFees[4])} per service to cover variable costs, before acquisition and fixed overhead. $2.99 remains the modeled fee.`,673,249,530);","block(s,'Retained service economics',`The 2031 base mix retains ${money(B.rows[68][4])} per repeat job after variable costs. Processing is recovered at cost; acquisition and fixed overhead remain separate.`,673,249,530);")
replace('The assumed repeat losses undermine retention value.','This assumes retention and unchanged cohort economics.')
idx=s.index('// 18\n')
s=s[:idx]+'''// Payment ownership
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
foot(s,'Annual retained savings first cover run costs in 2032; neither option recovers the full investment by 2033. Gate a build on quoted costs and payback, not a calendar date.');
}
''' +s[idx:]
replace("v5.pptx","v6.pptx");replace("validation-v5.json","validation-v6.json")
# Replace final source layout with two columns; keep links editable in the deck.
start=s.index("const refs=[");end=s.index("foot(s,'External references",start)
s=s[:start]+'''const refs=[['Stripe Payments pricing','https://stripe.com/pricing'],['Stripe Connect pricing','https://stripe.com/connect/pricing'],['Stripe Financial Connections','https://stripe.com/financial-connections'],['Zocdoc: current pricing help','https://www.zocdoc.com/provider-help/en/articles/10859404-understanding-zocdoc-pricing-and-billing'],['Zocdoc: published booking-fee range','https://www.zocdoc.com/about/understanding-your-bill/'],['Visa: interchange and merchant fees','https://usa.visa.com/support/small-business/regulations-fees.html'],['Federal Reserve: ACH fees','https://www.frbservices.org/resources/fees/ach-2026'],['PCI Security Standards Council','https://www.pcisecuritystandards.org/standards/pci-dss/'],['Census QuickFacts: Barnegat','https://www.census.gov/quickfacts/fact/table/barnegattownshipoceancountynewjersey/SBO010223']];
refs.forEach(([label,url],i)=>{const x=i<5?66:672,y=457+(i%5)*29;const sh=text(s,label,x,y,541,28,20,C.green);sh.text.get(label).link={uri:url,isExternal:true};});
''' +s[end:]
p.write_text(s)
print('Deck updated: recommended pricing, Zocdoc research, profitability and payment-build decision.')
