from pathlib import Path
p=Path('tmp/investor-deck-20260920/build/model.mjs')
s=p.read_text()
s=s.replace("import {Workbook,SpreadsheetFile}","import {buildServiceMix} from './service-mix.mjs';\nimport {Workbook,SpreadsheetFile}")
s=s.replace("'Ownership','Unit economics']","'Ownership','Unit economics','Service mix']")
s=s.replace("driver('ticket','Average service price',60,75,60,dec,'$60 reference ticket from partner pitch page 8. $75 downside stresses larger jobs and processing. No tax or tips assumed.');","driver('priceFactor','Service price multiplier',1,1.15,1,'0.00\"x\"','Service mix builds weighted prices from category, neighborhood, property and escalation. Downside stresses prices 15% above the common mix. No customer tax or tips assumed.');")
s=s.replace("'Scheduled visits / full season'","'Maintenance visits / full season'")
s=s.replace("No subscription, specialist cross-sell, advertising, hiring commission, customer fee, tax/tip revenue or processor volume discount. All revenue is net marketplace fees, not GMV.","No subscription, extra finder fee for project work, advertising, hiring commission, customer fee, tax/tip revenue or volume discount. Service mix adds project jobs with the same provider. Revenue excludes GMV.")
s=s.replace("const b=sheets['Operating model'];", "const mix=buildServiceMix({sheets,top,put,formula,band,note,cols,ref,ar,C,dec});\nconst mr=(c,r)=>`'Service mix'!${c}${r}`;\nconst b=sheets['Operating model'];")
s=s.replace("12:'Scheduled visits'","12:'Scheduled maintenance and project jobs'").replace("14:'Service GMV',","14:'Service GMV',15:'Weighted average service price',")
s=s.replace("12:`${c}11*${ar('visits',c)}`", "12:`${c}11*${mr(c,44)}`")
s=s.replace("14:`${c}13*${ar('ticket',c)}`", "14:`${c}13*${mr(c,46)}`,15:mr(c,46)")
s=s.replace("(${ar('ticket',c)}*${ref('cardPct')}+${ref('cardFixed')})","${mr(c,48)}")
s=s.replace("MIN(${ar('ticket',c)}*${ref('achPct')},${ref('achCap')})","${mr(c,47)}")
s=s.replace("${ar('ticket',c)}","${mr(c,46)}")
s=s.replace("${c}68*${ar('visits',c)}", "${c}68*${mr(c,44)}")
s=s.replace("[68,69])", "[15,68,69])")
s=s.replace("One new pairing per new household. No fees on repeat pairings or on additional categories with the same provider.","One new pairing per new household. $2.99 applies to every completed service. Bundles count once; project visits add fees but no new finder fee for the same pair.")
s=s.replace("9:13,11:14", "9:13,10:15,11:14")
s=s.replace("+rr===36?dec:usd", "[10,36].includes(+rr)?dec:usd")
s=s.replace("top(u,'YardMatch | Repeat-service economics',48)","top(u,'YardMatch | Repeat-service economics',59)")
s=s.replace("u.getRange('C5:F5').values=[['Per paid repeat visit','$40 job','$60 job','$100 job']];", "u.getRange('C5:I5').values=[['Per paid repeat visit','$60 job','$100 job','$250 job','$500 job','$1,000 job','$2,500 job']];")
s=s.replace("u.getRange('D6:F6').values=[[40,60,100]]", "u.getRange('D6:I6').values=[[60,100,250,500,1000,2500]]")
s=s.replace("u.getRange('D6:F6').format", "u.getRange('D6:I6').format")
s=s.replace("for(const c of ['D','E','F']){const f=", "for(const c of ['D','E','F','G','H','I']){const f=")
s=s.replace("22:`${ar('visits','H')}*", "22:`${mr('H',44)}*")
s=s.replace("u.getRange(`C${r}:F${r}`)", "u.getRange(`C${r}:I${r}`)")
needle="// Clear title treatment"
added="""band(u,45,'Weighted job mix and the fee required to cover variable costs');
u.getRange('D46:J46').values=[years];u.getRange('C46:J46').format.fill=C.sage;
for(const [r,l]of Object.entries({47:'Weighted average service price',48:'Blended processing / paid job',49:'Other variable costs / paid job',50:'Repeat contribution / paid job',51:'Break-even service fee / paid job',52:'Gap versus $2.99 provider fee'}))put(u,'C'+r,l);
for(const c of cols){const f={47:mr(c,46),48:`(1-${ar('ach',c)})*${mr(c,48)}+${ar('ach',c)}*${mr(c,47)}`,49:`('Operating model'!${c}32+'Operating model'!${c}33)/'Operating model'!${c}13+${ref('support')}+${ref('infra')}+${c}47*${ref('loss')}+(${c}47-${ref('fee')})*${ref('connectPct')}`,50:`'Operating model'!${c}68`,51:`(${c}48+${c}49+${ref('fee')}*${ref('connectPct')})/(1+${ref('connectPct')})`,52:`${c}51-${ref('fee')}`};for(const[r,v]of Object.entries(f))formula(u,c+r,'='+v);}
u.getRange('D47:J52').setNumberFormat(dec);u.getRange('C50:J52').format.fill=C.sage;
note(u,55,'Break-even fee covers modeled variable costs only. It excludes new finder fees, initial bank-link cost, acquisition and fixed overhead. This is a sensitivity result, not a pricing change. ACH caps apply to each category / neighborhood / property combination.');
"""
s=s.replace(needle,added+needle)
s=s.replace("card60:u.getRange('E14')", "card60:u.getRange('D14')").replace("ach60:u.getRange('E17')", "ach60:u.getRange('D17')")
s=s.replace("ltvCac:u.getRange('D31').values[0][0]", "ltvCac:u.getRange('D31').values[0][0],tickets:u.getRange('D6:I6').values[0],cards:u.getRange('D14:I14').values[0],achs:u.getRange('D17:I17').values[0],breakEvenFees:u.getRange('D51:J51').values[0],mixRows:Object.fromEntries([43,44,45,46,47,48,49,51,52,53,54,55,57,58,59,60,61,63,64,65,66,67,69,70].map(r=>[r,mix.sheet.getRange(`D${r}:J${r}`).values[0]]))")
needle="// Meaningful recalculation checks, with restoration."
checks="""// Price changes must move GMV and cost without inventing fee revenue.
const savedPrice=mix.sheet.getRange('D7').values[0][0],savedGMV=b.getRange('D14').values[0][0],savedFees=b.getRange('D26').values[0][0],savedProfit=b.getRange('D51').values[0][0];
put(mix.sheet,'D7',savedPrice+10);wb.recalculate();
if(b.getRange('D14').values[0][0]<=savedGMV||Math.abs(b.getRange('D26').values[0][0]-savedFees)>1e-7||b.getRange('D51').values[0][0]>=savedProfit)throw Error('Price / fee / cost linkage failed');put(mix.sheet,'D7',savedPrice);wb.recalculate();
const savedProject=mix.sheet.getRange('J22').values[0][0],savedJobs=b.getRange('J13').values[0][0],savedFinders=b.getRange('J24').values[0][0];
put(mix.sheet,'J22',savedProject+1);wb.recalculate();
if(b.getRange('J13').values[0][0]<=savedJobs||Math.abs(b.getRange('J24').values[0][0]-savedFinders)>1e-7)throw Error('Project frequency double-counted finder fees');put(mix.sheet,'J22',savedProject);wb.recalculate();
// A single $1,000 category exceeds the ACH cap. Every demographic combination stays capped.
if(Math.abs(mix.sheet.getRange('D67').values[0][0]-5)>1e-8)throw Error('Per-transaction ACH cap failed');
put(mix.sheet,'D16',.9);wb.recalculate();if(mix.sheet.getRange('D49').values[0][0]>=0)throw Error('Invalid mix not exposed');put(mix.sheet,'D16',.6);wb.recalculate();
"""
s=s.replace(needle,checks+needle)
s=s.replace("await fs.writeFile(TMP+'/model-data.json'", "for(const ca of Object.values(captures))for(const r of [49,69,70])for(const v of ca.unit.mixRows[r])if(Math.abs(v)>1e-8)throw Error('Service mix tie-out failed');\nconsole.log((await wb.inspect({kind:'table',range:'Service mix!C43:J48',include:'values,formulas',tableMaxRows:6,tableMaxCols:8})).ndjson);\nawait fs.writeFile(TMP+'/model-data.json'")
s=s.replace("['Unit economics','C1:J44']", "['Unit economics','C1:J44'],['Unit economics','C45:J57'],['Service mix','C1:J23'],['Service mix','C25:J48'],['Service mix','C50:J81']")
assert "ar('ticket'" not in s
p.write_text(s)
