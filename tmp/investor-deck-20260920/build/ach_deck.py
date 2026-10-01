from pathlib import Path
p=Path(__file__).parent/'deck.mjs';s=p.read_text()
s=s.replace('prepared September 20, 2026','prepared September 21, 2026').replace('Prepared September 20, 2026','Prepared September 21, 2026').replace('Investor discussion draft. September 20, 2026','Investor discussion draft. September 21, 2026')
s=s.replace("pricing:'Sources checked September 20, 2026:","pricing:'Payments pricing rechecked September 21, 2026, other payment sources checked September 20:")
s=s.replace('Math.max(4.49,bill*.01)','bill*.04')
s=s.replace('Provider proceeds\'],...[[','Provider proceeds / card\'],...[[')
s=s.replace('Recurring fee: $4.49 minimum or 1% of the bill','Recurring fee: 4% card or 2% ACH, no minimum')
s=s.replace('Platform fee max($4.49,1% of job price).','Platform fee 4% for card or 2% for ACH, no minimum.')
s=s.replace("['Service bill','Platform fee','Total if card','Total if ACH']","['Service bill','Fee card / ACH','Total if card','Total if ACH']")
s=s.replace("money(Math.max(4.49,v*.01)),money(Math.max(4.49,v*.01)+v*.029+.30),money(Math.max(4.49,v*.01)+Math.min(v*.008,5))","money(v*.04)+' / '+money(v*.02),money(v*.04+v*.029+.30),money(v*.02+Math.min(v*.008,5))")
s=s.replace('widths:[230,190,220,220],font:24','widths:[160,260,220,220],font:23')
s=s.replace('Recurring platform pricing changes above $449. A bundle on one invoice counts once. Processing recovery is excluded from net platform revenue. Fees still require provider acceptance testing.','The homeowner must pay by ACH to qualify. Processing savings already go to providers. The lower platform fee is an additional YardMatch-funded discount. No automatic adoption lift is assumed.')
s=s.replace('plus per-transaction MAX($4.49,1% of price).','plus 4% of card-paid service GMV and 2% of ACH-paid service GMV, with no minimum.')
s=s.replace('`Base EBITDA turns positive in ${firstProfit(B)}`',"B.rows[51][6]>0?`Base EBITDA turns positive in ${firstProfit(B)}`:'Base approaches EBITDA break-even in 2033'")
s=s.replace('Positive EBITDA depends on the approved fee, payroll and CAC targets.','The selected 4% card / 2% ACH plan remains below EBITDA break-even through 2033.')
start=s.index('const before=data.changeBridge.before');end=s.index('//',s.index('\n}',start)+2)
s=s[:start]+"""const before=data.changeBridge.before,after=B.rows,alternative=data.changeBridge.ach25;
const s=slide('The ACH discount changes the profit outlook','2033 base comparison. Same service volume, 60% ACH share, five staff and $550,000 payroll.',sources.model+' Previous plan: MAX($4.49,1%) plus processing. Selected: 4% card / 2% ACH, no minimum. Alternative: 4% card / 2.5% ACH, no minimum. Alternative is a comparison, not selected pricing. Processing recovered at cost in all columns. $40 CAC and property finder tiers remain. No adoption lift.');
table(s,[['2033 base comparison','Previous plan','Selected 4% / 2%','Alternative 4% / 2.5%'],['Minimum platform fee','$4.49','$0','$0'],['Total revenue',m(before[26][6]),m(after[26][6]),m(alternative[26][6])],['EBITDA',whole(before[51][6]),whole(after[51][6]),whole(alternative[51][6])],['Free cash flow',whole(before[60][6]),whole(after[60][6]),whole(alternative[60][6])]],{y:246,h:329,widths:[384,230,260,278],font:22,highlights:[3]});
foot(s,`At 60% ACH share, the modeled ACH rate for zero EBITDA is ${(data.achBreakEven[6]*100).toFixed(2)}%, holding the 4% card fee and all other assumptions constant. Provider acceptance still needs testing.`);
}
// ACH migration sensitivity
{
const s=slide('More ACH adoption lowers platform revenue','2033 sensitivity under the selected 4% card / 2% ACH fees. All service and customer volumes stay fixed.',sources.model+' One operating model is recalculated for each snapshot. Only 2033 ACH share changes, keeping earlier years unchanged. Same share applies to every service category, so share of jobs equals share of GMV. Processing cost recovery, payout cost and new bank-link allowance recalculate. No customer incentives or growth benefit assumed. ACH requires homeowner authorization: https://docs.stripe.com/payments/ach-direct-debit/accept-a-payment . ACH can fail or be disputed after an apparent success; loss and risk allowances remain.');
table(s,[['ACH share of jobs','Blended platform rate','Net revenue','EBITDA'],...data.achSensitivity.map(v=>[pct(v.share),((.04*(1-v.share)+.02*v.share)*100).toFixed(1)+'%',m(v.rows[26][6]),whole(v.rows[51][6])])],{y:246,h:325,widths:[300,330,261,261],font:24,highlights:[3]});
foot(s,'Providers benefit when homeowners switch to bank debit. Show the savings and offer a consent-based bank setup prompt. Budget any homeowner reward separately. Measure repeat use and failed payments before expanding the incentive.');
}
"""+s[end:]
s=s.replace("v12.pptx","v13.pptx").replace('validation-v12.json','validation-v13.json')
p.write_text(s)
print('Updated payment pricing, forecasts and ACH comparison slides.')
