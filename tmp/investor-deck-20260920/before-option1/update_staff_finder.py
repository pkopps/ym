from pathlib import Path
p=Path('/Users/patrickkopps/Documents/app/tmp/investor-deck-20260920/build')
f=p/'town-expansion.mjs';s=f.read_text()
s=s.replace("band(a,61,'Acquisition and supply settings / editable');","band(a,61,'Acquisition and supply settings / editable');put(a,'C81','Maximum paid employees');blue('D81',5);a.getRange('D81').setNumberFormat('0');")
s=s.replace("Core staffing scales with active households.","Core staffing scales with active households, capped at five paid employees including founder. This cap assumes operational capacity is sufficient; no demand lift or extra outsourcing is added.")
s=s.replace("24:`${setting(68)}+ROUNDUP(MAX(0,${c}11-${setting(69)})/${setting(70)},0)`", "24:`MIN(${setting(81)},${setting(68)}+ROUNDUP(MAX(0,${c}11-${setting(69)})/${setting(70)},0))`")
s=s.replace("34:'Joint mix sum check'", "34:'Joint mix sum check',35:'Gross property-tier finder fees',36:'Welcome finder-fee discounts',37:'Net property-tier finder revenue',38:'Average finder fee before waivers',39:'Welcome pair count'")
at="  for(const[r,v]of Object.entries(f))formula(b,c+r,'='+v);"
insert="""  // Finder fees use the NEW household mix, not full-season repeat-job weights.
  const averages=towns.map((t,i)=>`(${ti('I',45+i)}*${ref('finder')}+${ti('H',26+i)}*${ref('largeFinderActive')}+${ti('I',26+i)}*${ref('veryLargeFinderActive')})`);
  const waivers=towns.map((t,i)=>`MIN(${c}${bases[i]+9},${c}${bases[i]+15}*${ref('waive')})`);
  f[35]=towns.map((t,i)=>`${c}${bases[i]+9}*${averages[i]}`).join('+');
  f[36]=towns.map((t,i)=>`${waivers[i]}*${averages[i]}`).join('+');
  f[37]=`${c}35-${c}36`;f[38]=`IFERROR(${c}35/${c}9,0)`;f[39]=waivers.join('+');
"""
s=s.replace(at,insert+at)
s=s.replace("[20,21,22,23,25,26,27]","[20,21,22,23,25,26,27,35,36,37,38]")
s=s.replace("No returns of lost customers or second finder fee are assumed.","No returns of lost customers or second finder fee are assumed. Finder waivers follow each town's new-property mix.")
f.write_text(s)
f=p/'model.mjs';s=f.read_text()
s=s.replace("['finder','Finder fee / new relationship'","['finder','Finder fee / typical property'")
at=s.index('const ref=k=>')
s=s[:at]+"""band(a,129,'Property-based finder fee / once per new relationship');
put(a,'C130','Finder fee policy');put(a,'D130','Property tiers');a.getRange('D130').dataValidation={rule:{type:'list',values:['Property tiers','Flat $45']}};a.getRange('D130').format.font.color=C.blue;
for(const[k,r,l,v]of [['largeFinder',131,'Large-property finder fee',65],['veryLargeFinder',132,'Very-large-property finder fee',90]]){drivers[k]=r;put(a,'C'+r,l);put(a,'D'+r,v);a.getRange('D'+r).format.font.color=C.blue;a.getRange('D'+r).setNumberFormat(dec);}
drivers.largeFinderActive=133;drivers.veryLargeFinderActive=134;
for(const[r,input,l]of [[133,131,'Active large-property finder fee'],[134,132,'Active very-large-property finder fee']]){put(a,'C'+r,l);formula(a,'D'+r,`=IF(AND(D130="Property tiers",D4="Proposed"),D${input},D69)`);a.getRange('D'+r).setNumberFormat(dec);}
note(a,136,'Planning tiers: $45 typical, $65 large, $90 very large. Classify the serviceable property scope at first match; no income or postcode surcharge. Exact size boundaries require provider quote validation. A new service or bigger later job with the same provider creates no second finder fee.');
note(a,139,'Provider pays after first completed paid job; first-client waiver remains. New-customer property mix, with proportional waivers within each town, determines revenue. Prior $2.99 mode also restores a flat finder fee. No automatic adoption lift from higher pricing.');
"""+s[at:]
s=s.replace("f[8]=tr(c,10);", "f[24]=tr(c,37);f[22]=tr(c,39);f[8]=tr(c,10);")
s=s.replace("const pricingCases={Proposed:readRows()};", "const changeBridge={before:JSON.parse(await fs.readFile(ROOT+'/tmp/investor-deck-20260920/before-staff-finder-tiers/model-data.json','utf8')).captures.Base.rows,revised:readRows()};put(a,'D130','Flat $45');wb.recalculate();changeBridge.staffingOnly=readRows();put(a,'D130','Property tiers');wb.recalculate();\nconst pricingCases={Proposed:readRows()};")
s=s.replace("mixedCase,drivers,years,labels,towns,ownership:", "mixedCase,changeBridge,drivers,years,labels,towns,ownership:")
s=s.replace("const errors=await wb.inspect", "if(captures.Base.rows[47].some(v=>v>5))throw Error('Five-person staffing cap failed');\nconst baseFinder=b.getRange('J24').values[0][0], paidServices=b.getRange('J25').values[0][0];put(a,'D131',75);wb.recalculate();if(b.getRange('J24').values[0][0]<=baseFinder||Math.abs(b.getRange('J25').values[0][0]-paidServices)>1e-7)throw Error('Finder tiers leaked into recurring revenue');put(a,'D131',65);wb.recalculate();\nconst errors=await wb.inspect")
s=s.replace("['Town forecast','C1:J34']","['Town forecast','C1:J39'],['Assumptions','C129:J140']").replace("['Town inputs','C61:D80']","['Town inputs','C61:D81']")
s=s.replace("Keep the $45 finder fee at launch, charged", "Use $45 / $65 / $90 property-tier finder fees, charged")
s=s.replace("Do not raise it merely to offset recurring losses.", "Larger serviceable properties pay more once at acquisition.")
s=s.replace("Core forecast excludes optional subscriptions", "Five-person staffing cap applies in all cases. Core forecast excludes optional subscriptions")
f.write_text(s)
# Independently reproduce staffing and new-customer finder-fee weighting.
f=p/'verify_mix.py';s=f.read_text().replace('fte=3+math.ceil(max(0,active-1000)/2500)','fte=min(5,3+math.ceil(max(0,active-1000)/2500))')
s=s.replace("vals.update({40+j:v for j,v in enumerate(joint)})", """gross=discount=waivers=0
  for town,h in zip(towns,histories):
   fee=(1-town['large']-town['estate'])*45+town['large']*65+town['estate']*90
   gross+=h[i][9]*fee;waived=min(h[i][9],h[i][15]);waivers+=waived;discount+=waived*fee
  vals.update({35:gross,36:discount,37:gross-discount,38:gross/agg(9),39:waivers})
  vals.update({40+j:v for j,v in enumerate(joint)})""")
s=s.replace("finders=(q['new'][i]-min(q['new'][i],pnew))*45;revenue=finders+jobs*fee", "finders=town[37] if proposed else (q['new'][i]-town[39])*45;revenue=finders+jobs*fee")
f.write_text(s)
