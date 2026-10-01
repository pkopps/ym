from pathlib import Path
P=Path('/Users/patrickkopps/Documents/app/tmp/investor-deck-20260920/build')
p=P/'model.mjs';s=p.read_text()
s=s.replace("No subscription, extra finder fee for project work, advertising, hiring commission, customer fee, tax/tip revenue or volume discount. Service mix adds project jobs with the same provider. Revenue excludes GMV.","Core forecast excludes optional subscriptions and advertising. Revenue streams has separate switches and incremental costs. No worker fees, hiring commissions, customer fees, tax/tip revenue or volume discounts. Projects with the same provider add no new finder fee.")
s=s.replace('Only finder fee waived. $2.99 service fee applies.','Only finder fee waived. Selected recurring service and processing charges apply.')
s=s.replace("note(s,39,'All years", "put(s,'C15','Optional provider products / included above');put(s,'C18','Optional product cost of revenue');put(s,'C23','Incremental builds / product operations');\nfor(const c of cols){formula(s,c+'15',`=SUM('Operating model'!${c}87:${c}88)`);formula(s,c+'18',`='Operating model'!${c}89`);formula(s,c+'23',`='Operating model'!${c}46+'Operating model'!${c}90`);}\ns.getRange('D15:J15').setNumberFormat(usd);s.getRange('D18:J18').setNumberFormat(usd);\nput(s,'C4','Optional revenue case');formula(s,'D4',\"='Revenue streams'!D3\");\nnote(s,39,'All years")
s=s.replace('Revenue includes finder fees after waivers and platform service fees.','Revenue includes finder/service fees and selected optional provider products. Optional products are billed outside service GMV.')
key='// Price changes must move GMV and cost without inventing fee revenue.'
insert='''const streamCases={};
const readStreamRows=()=>Object.fromEntries(streams.rows.map(r=>[r,streams.sheet.getRange(`D${r}:J${r}`).values[0]]));
for(const cas of ['Downside','Base','Upside']){put(a,'D3',cas);streamCases[cas]={};for(const mode of ['Subscriptions','Subscriptions + sponsorship']){put(streams.sheet,'D3',mode);wb.recalculate();streamCases[cas][mode]={rows:readRows(),streamRows:readStreamRows()};}}
put(a,'D3','Base');put(payments,'D4',2029);wb.recalculate();const mixedCase={rows:readRows(),streamRows:readStreamRows()};
put(payments,'D4',0);put(streams.sheet,'D3','Off');wb.recalculate();
for(const group of Object.values(streamCases))for(const v of Object.values(group)){for(const r of [72,73,74,75,76])for(const z of v.rows[r])if(Math.abs(z)>1e-7)throw Error('Optional revenue cash/settlement check failed');for(const r of [81,82,83])for(const z of v.streamRows[r])if(Math.abs(z)>1e-7)throw Error('Optional revenue input check failed');}
'''
assert key in s;s=s.replace(key,insert+key)
s=s.replace('captures,pricingCases,engineCases,drivers','captures,pricingCases,engineCases,streamCases,mixedCase,drivers')
s=s.replace("['Summary','C1:J46']","['Revenue streams','C1:J30'],['Revenue streams','C34:J64'],['Revenue streams','C66:J83'],['Summary','C1:J46']")
p.write_text(s)
p=P/'payments.mjs';s=p.read_text();old="'Operating model'!${c}14-'Operating model'!${c}26-${c}40*${ref('recoverActive')}";new="'Operating model'!${c}14-SUM('Operating model'!${c}24:${c}25)-${c}40*${ref('recoverActive')}";assert old in s;s=s.replace(old,new);p.write_text(s)
print('Optional revenue integrated; core case and provider settlement retained.')
