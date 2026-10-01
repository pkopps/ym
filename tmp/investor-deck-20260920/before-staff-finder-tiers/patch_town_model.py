from pathlib import Path
p=Path('/Users/patrickkopps/Documents/app/tmp/investor-deck-20260920/build')
f=p/'model.mjs';s=f.read_text()
s=s.replace("import {buildPayments}","import {buildTowns,towns} from './town-expansion.mjs';\nimport {buildPayments}")
s=s.replace("'Payments','Revenue streams']","'Payments','Revenue streams','Town inputs','Town forecast']")
start=s.index("driver('new'");end=s.index("driver('ret'",start)
s=s[:start]+"driver('new','Town acquisition-rate multiplier',1,.60,1.50,'0.00\\\"x\\\"','Superseded by Town inputs case settings; household forecast is built from individual towns, not this display.');\n"+s[end:]
start=s.index("const payments=buildPayments")
s=s[:start]+"const town=buildTowns({sheets,top,put,formula,band,note,cols,years,ref,ar,C,usd});\nconst tr=(c,r)=>`'Town forecast'!${c}${r}`;\n// Town formulas replace the old unconstrained growth and national spending curves.\nfor(const [key,r] of [['new',9],['cac',27],['fte',24],['overhead',25],['capex',26]]){\n put(a,'C'+drivers[key],{new:'New households / town forecast',cac:'Customer CAC / town forecast',fte:'Employees / household coverage',overhead:'Corporate overhead / town forecast',capex:'Equipment / staffing'}[key]);\n for(const c of cols)formula(a,c+drivers[key],'='+tr(c,r));\n a.getRange(`C${drivers[key]+1}:J${drivers[key]+3}`).clear({applyTo:'contents'});\n put(a,'L'+drivers[key],'Formula from Town forecast. Change town launch, demand, supply and cost inputs on Town inputs.');\n}\na.getRange('D7:J7').setNumberFormat(num);\n"+s[start:]
s=s.replace("Object.assign(labels,{26:","Object.assign(labels,{91:'Local launch and coverage spend',26:")
s=s.replace("[26,87,88,89,90]","[26,87,88,89,90,91]")
s=s.replace(" f[52]=", " f[8]=tr(c,10);f[10]=tr(c,11);f[11]=tr(c,12);f[17]=tr(c,17);f[18]=tr(c,16);f[19]=tr(c,18);f[20]=tr(c,19);f[43]=tr(c,20);f[91]=tr(c,23);\n f[51]+=`-${c}91`;\n f[52]=",1)
s=s.replace("+${sr(c,79)})*", "+${sr(c,79)}+${tr(c,22)})*")
s=s.replace("`${c}60-(${c}51-${c}54-${c}57-${c}59)`","`${c}60-(${c}51-${c}54-${c}57-${c}59)`")
s=s.replace("b.getRange('D87:J90')","b.getRange('D87:J91')")
s=s.replace("captures[cas]={years,rows:out,unit:","captures[cas]={years,rows:out,townRows:Object.fromEntries(town.rows.map(r=>[r,town.sheet.getRange(`D${r}:J${r}`).values[0]])),townDetails:town.bases.map(r=>Object.fromEntries(Array.from({length:19},(_,j)=>j+1).map(j=>[j,town.sheet.getRange(`D${r+j}:J${r+j}`).values[0]]))),unit:")
start=s.index("const later='J'");end=s.index("wb.recalculate();",start)+len("wb.recalculate();")
# Entire old single-line input test is removed, including its tail.
end=s.index('\n',end)
s=s[:start]+"""// Geography sensitivities: new-town timing, outsourcing and provider capacity.
const base2028=b.getRange('E10').values[0][0], base2033=b.getRange('J10').values[0][0];
put(town.inputs,'D27',2029);wb.recalculate();if(b.getRange('E10').values[0][0]>=base2028)throw Error('Delayed town launch did not lower adoption');put(town.inputs,'D27',2028);wb.recalculate();
const outRate=town.inputs.getRange('F26').values[0][0], initialHH=b.getRange('D10').values[0][0];put(town.inputs,'F26',outRate*.5);wb.recalculate();if(b.getRange('D10').values[0][0]>=initialHH)throw Error('Outsourcing demand link failed');put(town.inputs,'F26',outRate);wb.recalculate();
put(town.inputs,'J26',1);wb.recalculate();if(b.getRange('D10').values[0][0]>40.000001)throw Error('Town supply cap failed');put(town.inputs,'J26',6);wb.recalculate();
if(Math.abs(b.getRange('J10').values[0][0]-base2033)>1e-6)throw Error('Town inputs not restored');
for(const ca of Object.values(captures))for(const r of[31,32,33,34])for(const v of ca.townRows[r])if(Math.abs(v)>1e-7)throw Error('Town balance / bounds failed');
if(new Set(towns.map(t=>t.fips)).size!==towns.length)throw Error('Duplicate geography');
"""+s[end:]
s=s.replace("mixedCase,drivers,years,labels,ownership:","mixedCase,drivers,years,labels,towns,ownership:")
s=s.replace("for(const[n,range]of [[", "for(const[n,range]of [['Town inputs','C1:J20'],['Town inputs','C24:J39'],['Town inputs','C43:J58'],['Town inputs','C61:D80'],['Town forecast','C1:J34'],['Town forecast','C62:J81'],[")
f.write_text(s)
f=p/'service-mix.mjs';s=f.read_text()
s=s.replace(" const x=sheets", " const joint=(c,n,z)=>`'Town forecast'!${c}${40+n*3+z}`;\n const mult=(c)=>Array.from({length:9},(_,i)=>`${joint(c,Math.floor(i/3),i%3)}*${Math.floor(i/3)===0?'1':c+(Math.floor(i/3)===1?29:30)}*${i%3===0?'1':c+(i%3===1?37:38)}`).join('+');\n const x=sheets")
s=s.replace("  for(let i=0;i<5;i++){", "  f[26]=`SUM('Town forecast'!${c}40:${c}42)`;f[27]=`SUM('Town forecast'!${c}43:${c}45)`;f[34]=[40,43,46].map(r=>`'Town forecast'!${c}${r}`).join('+');f[35]=[41,44,47].map(r=>`'Town forecast'!${c}${r}`).join('+');\n  f[45]=`SUMPRODUCT(${c}7:${c}9,${c}16:${c}18)*(${mult(c)})*${c}41`;\n  for(let i=0;i<5;i++){")
s=s.replace("`${c}${7+i}*${c}31*${c}39*${c}41`", "`${c}${7+i}*(${mult(c)})*${c}41`")
s=s.replace("${c}${26+n}*${c}${34+z}","${joint(c,n,z)}")
s=s.replace("Neighborhood and property multipliers compound, with independent mixes across services.","Town exposure weights link neighborhood price tiers and property sizes jointly. Income and yard-size assumptions are not counted as independent growth uplifts.")
s=s.replace("No quote distribution or provider capacity by service is yet calibrated.","Town provider capacity is explicit; quote distribution and service-specific capacity still need calibration.")
s=s.replace("inputs(26,'Standard neighborhood share'","inputs(26,'Standard neighborhood / town mix'")
s=s.replace("inputs(27,'Higher-cost neighborhood share'","inputs(27,'Higher-cost neighborhood / town mix'")
s=s.replace("inputs(34,'Typical property share'","inputs(34,'Typical property / town mix'")
s=s.replace("inputs(35,'Large property share'","inputs(35,'Large property / town mix'")
f.write_text(s)
