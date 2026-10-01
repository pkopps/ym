from pathlib import Path
p=Path('/Users/patrickkopps/Documents/app/tmp/investor-deck-20260920/build')
f=p/'model.mjs';s=f.read_text()
s=s.replace("[100000,105000,110000,115000,120000,125000,130000]","Array.from({length:7},(_,i)=>100000+10000*i/6)")
s=s.replace("Includes founder pay, payroll taxes and benefits. Variable support vendors appear in cost of revenue.","Option 1 planning budget: average loaded cost increases from $100,000 in 2027 to $110,000 in 2033, including founder pay, taxes and benefits. Five staff cost $550,000 in 2033. Roles and compensation need validation; variable support vendors remain separate.")
s=s.replace("['fee','Minimum platform fee / paid service',2.99", "['fee','Minimum platform fee / paid service',4.49")
s=s.replace('Proposed pricing is MAX($2.99, 1% of bill)', 'Proposed pricing is MAX($4.49, 1% of bill)')
s=s.replace('Reccommended floor','Recommended floor')
at=s.index('const ref=k=>')
s=s[:at]+"drivers.feeActive=118;put(a,'C118','Active recurring fee minimum');formula(a,'D118','=IF(D4=\"Proposed\",D70,2.99)');a.getRange('D118').setNumberFormat(dec);\n"+s[at:]
s=s.replace('const ref=k=>`\'Assumptions\'!$D$${drivers[k]}`', 'const ref=k=>`\'Assumptions\'!$D$${drivers[k===\'fee\'?\'feeActive\':k]}`')
start=s.index('const changeBridge=');end=s.index('const pricingCases=',start)
s=s[:start]+"""const previousOption=JSON.parse(await fs.readFile(ROOT+'/tmp/investor-deck-20260920/before-option1/model-data.json','utf8'));
const changeBridge={before:previousOption.captures.Base.rows,revised:readRows()};
// Isolate the fee change for the investor comparison, then restore the full selected plan.
const salaryInputs=a.getRange('D53:J53').values;
a.getRange('D53:J53').values=[[100000,105000,110000,115000,120000,125000,130000]];put(town.inputs,'D103',previousOption.captures.Base.townRows[27][6]);wb.recalculate();changeBridge.feeOnly=readRows();
a.getRange('D53:J53').values=salaryInputs;put(town.inputs,'D103',40);wb.recalculate();
"""+s[end:]
s=s.replace('put(a,feeCell,3.99);','put(a,feeCell,5.49);').replace('put(a,feeCell,2.99);','put(a,feeCell,4.49);')
s=s.replace("['Town inputs','C61:D81']","['Town inputs','C61:D81'],['Town inputs','C103:J108']")
s=s.replace("for(const ca of Object.values(captures))for(const r of[31,32,33,34])", "if(Math.abs(captures.Base.rows[43][6]/captures.Base.rows[7][6]-40)>1e-8||Math.abs(captures.Base.rows[49][6]-550000)>1e-8)throw Error('Option 1 endpoint targets failed');\nfor(const ca of Object.values(captures))for(const r of[31,32,33,34])")
f.write_text(s)
f=p/'town-expansion.mjs';s=f.read_text()
s=s.replace(" const ti=(c,r)=>", " put(a,'C103','2033 base blended CAC target');blue('D103',40);a.getRange('D103').setNumberFormat(usd);put(a,'C104','Previous 2033 base CAC / calibration');blue('D104',45.39186952765409);a.getRange('D104').setNumberFormat('$0.00');\n note(a,106,'Option 1: an extra acquisition-efficiency factor phases in from 2027 to 2033, calibrated from the previous $45.39 base CAC to a $40 target. Relative town costs and scenario multipliers remain. Changing town mix can change the blended result. No extra household growth is assumed.');\n const ti=(c,r)=>")
s=s.replace("*${mult(79,80)}`,18:","*${mult(79,80)}*(1+(${setting(103)}/${setting(104)}-1)*${k}/6)`,18:")
f.write_text(s)
f=p/'service-mix.mjs';s=f.read_text().replace('MAX($2.99, 1% of bill)','MAX($4.49, 1% of bill)');f.write_text(s)
f=p/'verify_mix.py';s=f.read_text()
s=s.replace("cashcac=new*town['cac']*.95**i*cacmult", "cashcac=new*town['cac']*.95**i*cacmult*(1+(40/45.39186952765409-1)*i/6)")
s=s.replace('max(2.99,price*.01) if proposed else 2.99','max(4.49,price*.01) if proposed else 2.99')
s=s.replace('(100000+5000*i)','(100000+10000*i/6)')
f.write_text(s)
