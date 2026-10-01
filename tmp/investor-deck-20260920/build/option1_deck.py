from pathlib import Path
p=Path('/Users/patrickkopps/Documents/app/tmp/investor-deck-20260920/build');f=p/'deck.mjs';s=f.read_text()
s=s.replace('Math.max(2.99,','Math.max(4.49,').replace('$2.99','$4.49').replace('above $299','above $449')
s=s.replace('yAxis:{min:0,max:1.2,majorUnit:.3','yAxis:{min:0,max:1.5,majorUnit:.3')
s=s.replace("slide('The regional base remains loss-making'", "slide(`Base EBITDA turns positive in ${firstProfit(B)}`")
s=s.replace('No positive EBITDA year appears through 2033. Staffing, acquisition and local coverage exceed contribution at this scale.', 'Positive EBITDA depends on the approved fee, payroll and CAC targets. Free cash flow also funds equipment and restricted risk cash.')
start=s.index("const before=data.changeBridge.before");end=s.index('// 17',start)
s=s[:start]+'''const before=data.changeBridge.before,fees=data.changeBridge.feeOnly,after=B.rows;
const s=slide('Pricing and cost targets close the gap','Option 1: $4.49 or 1% per service, five staff with $550,000 payroll, and $40 customer acquisition cost by 2033.',sources.model+' Recurring fee is the greater of $4.49 or 1% plus actual processing. Property finder fees remain $45 / $65 / $90. Compensation grows from $100,000 per employee in 2027 to $110,000 in 2033; five includes founder. Extra CAC efficiency phases in through 2033, maintaining town differentials. No change to household counts, provider supply or booking volume is assumed. Fee-only comparison preserves the former payroll and CAC assumptions.');
table(s,[['2033 base comparison','Previous plan','Fee change only','Full option 1'],['Recurring minimum','$2.99','$4.49','$4.49'],['Annual payroll',whole(before[49][6]),whole(fees[49][6]),whole(after[49][6])],['Cost per new household',money(before[43][6]/before[7][6]),money(fees[43][6]/fees[7][6]),money(after[43][6]/after[7][6])],['Total revenue',m(before[26][6]),m(fees[26][6]),m(after[26][6])],['EBITDA',whole(before[51][6]),whole(fees[51][6]),whole(after[51][6])]],{y:246,h:329,widths:[441,237,237,237],font:23,highlights:[5]});
foot(s,`The fee improves EBITDA by ${whole(fees[51][6]-before[51][6])}; payroll saves ${whole(before[49][6]-after[49][6])}; CAC saves ${whole(before[43][6]-after[43][6])}. Provider acceptance, staffing capacity and acquisition efficiency remain to be validated.`);
}
''' + s[end:]
s=s.replace("Pilot CAC around $55; test a path below $50", "Pilot CAC around $55; validate a path to $40 by 2033")
s=s.replace('Deck-v11.pptx','Deck-v12.pptx').replace('validation-v11.json','validation-v12.json')
f.write_text(s)
