from pathlib import Path
P=Path(__file__).parent
p=P/'model.mjs';s=p.read_text()
s=s.replace("Forecast assumptions',140", "Forecast assumptions',150")
s=s.replace("'Minimum platform fee / paid service',4.49", "'Minimum platform fee / paid service',0")
s=s.replace('Recommended floor. Proposed pricing is MAX($4.49, 1% of bill) plus card/ACH processing at cost.', 'Selected pricing: 4% card / 2% ACH with no minimum, plus actual processing. Zero is intentional.')
s=s.replace("'Platform percentage above the minimum');put(a,'D114',.01)","'Card platform percentage');put(a,'D114',.04)")
s=s.replace('Active platform percentage','Active card platform percentage')
s=s.replace('Recommendation: 1% protects margin on larger jobs. $2.99 minimum covers small-job support. No recurring fee cap. Rates are a pilot recommendation, not measured willingness to pay.','Selected September 21, 2026: 4% card / 2% ACH, no minimum or cap. Providers also cover actual processing. The homeowner payment method determines the rate. No additional adoption is assumed.')
anchor="const ref=k=>"
pos=s.index(anchor)
s=s[:pos]+"""band(a,143,'ACH platform pricing');drivers.achFeePct=144;drivers.achFeeActive=145;
put(a,'C144','ACH platform percentage');put(a,'D144',.02);a.getRange('D144').format.font.color=C.blue;a.getRange('D144').setNumberFormat('0.0%');
put(a,'C145','Active ACH platform percentage');formula(a,'D145','=IF(D4="Proposed",D144,0)');a.getRange('D145').setNumberFormat('0.0%');
note(a,147,'ACH discount applies to a successfully collected homeowner bank debit, not the provider payout method. Provider pays the platform fee and actual processing. ACH share remains an assumption. No automatic retention or collection benefit is modeled.');
"""+s[pos:]
s=s.replace("Repeat-service economics',59","Repeat-service economics',70")
s=s.replace("7:'Platform service fee'","7:'Platform fee / card payment'")
s=s.replace("19:'Price where percentage fee overtakes floor'","19:'Platform fee / ACH payment'")
s=s.replace("17:`${c}7-${c}16*(1-${ref('recoverActive')})-SUM(${c}11:${c}13)-(${c}6-${c}7-${c}16*${ref('recoverActive')})*${pr('H',27)}`", "17:`${c}19-${c}16*(1-${ref('recoverActive')})-SUM(${c}11:${c}13)-(${c}6-${c}19-${c}16*${ref('recoverActive')})*${pr('H',27)}`,19:`MAX(${ref('fee')},${c}6*${ref('achFeeActive')})`")
s=s.replace("formula(u,'D19',`=IF(${ref('pctActive')}>0,${ref('fee')}/${ref('pctActive')},0)`);",'')
s=s.replace("formula(u,c+'18',`=${c}7+${c}16*${ref('recoverActive')}`)","formula(u,c+'18',`=${c}19+${c}16*${ref('recoverActive')}`)")
s=s.replace('The tier crossover is the minimum fee divided by the platform percentage.','Card and ACH use different platform rates. Zero minimum allows a discount on small jobs.')
s=s.replace("threshold:u.getRange('D19').values[0][0]", "achPlatform60:u.getRange('D19').values[0][0]")
s=s.replace('69,70,85,86].map','69,70,85,86,87,88].map')
start=s.index('const previousOption=');end=s.index('const pricingCases=',start)
s=s[:start]+"""const previousOption=JSON.parse(await fs.readFile(ROOT+'/tmp/investor-deck-20260920/before-ach-pricing/model-data.json','utf8'));
const changeBridge={before:previousOption.captures.Base.rows,revised:readRows()};
put(a,'D144',.025);wb.recalculate();changeBridge.ach25=readRows();put(a,'D144',.02);wb.recalculate();
// Snapshot comparisons use this same model. Only 2033 ACH share changes; earlier years stay fixed.
const achSensitivity=[];
for(const share of [0,.3,.6,.8,1]){put(a,'J38',share);wb.recalculate();achSensitivity.push({share,rows:readRows()});}
put(a,'J38',.6);wb.recalculate();
"""+s[end:]
s=s.replace("// Price changes must move GMV and cost without inventing fee revenue.","// Percentage fees must respond to price without changing the number of jobs.")
s=s.replace("Math.abs(b.getRange('D26').values[0][0]-savedFees)>1e-7||b.getRange('D51').values[0][0]>=savedProfit", "b.getRange('D26').values[0][0]<=savedFees||b.getRange('D51').values[0][0]<=savedProfit")
start=s.index("const feeCell=");end=s.index('// Geography sensitivities',start)
s=s[:start]+"""const savedRevenue=s.getRange('H14').values[0][0];put(a,'D114',.05);wb.recalculate();if(s.getRange('H14').values[0][0]<=savedRevenue)throw Error('Card fee sensitivity failed');put(a,'D114',.04);wb.recalculate();
put(a,'D144',.025);wb.recalculate();if(s.getRange('H14').values[0][0]<=savedRevenue)throw Error('ACH fee sensitivity failed');put(a,'D144',.02);wb.recalculate();
if(Math.abs(u.getRange('D7').values[0][0]-2.4)>1e-8||Math.abs(u.getRange('D19').values[0][0]-1.2)>1e-8)throw Error('No-minimum payment-method pricing failed');
"""+s[end:]
s=s.replace('mixedCase,changeBridge,drivers','mixedCase,changeBridge,achSensitivity,drivers')
s=s.replace("['Assumptions','C129:J140']","['Assumptions','C129:J149'],['Assumptions','C113:J118']")
p.write_text(s)
p=P/'verify_mix.py';s=p.read_text().replace("fee+=weight*(max(4.49,price*.01) if proposed else 2.99)","fee+=weight*(price*(.04*(1-q['ach'][i])+.02*q['ach'][i]) if proposed else 2.99)")
s=s.replace('fee floors, ACH caps','card/ACH platform rates, ACH caps');p.write_text(s)
