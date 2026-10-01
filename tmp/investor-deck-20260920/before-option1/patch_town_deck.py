from pathlib import Path
p=Path('/Users/patrickkopps/Documents/app/tmp/investor-deck-20260920/build')
f=p/'deck.mjs';s=f.read_text()
s=s.replace("const C={ink:","const T=B.townRows, towns=data.towns;\nconst totalHH=towns.reduce((v,t)=>v+t.households,0);\nconst censusNotes=towns.map(t=>t.name+': https://www.census.gov/quickfacts/fact/table/'+t.slug+'/PST045225').join(' ; ');\nconst C={ink:")
s=s.replace("Households with lawn-care demand are a subset, not measured here.","Lawn eligibility and outsourcing propensities are separate planning assumptions in Town inputs.")
s=s.replace("SBO010223","PST045225")
s=s.replace("Mix shifts, larger properties and 3% annual price escalation lift the weighted average over time.","Named town launches, service mix and 3% annual price escalation determine the weighted average.")
start=s.index("sources.model+' Neighborhood multipliers");end=s.index(");",start)
s=s[:start]+"sources.model+' Town forecast weights are based on full-season household exposure. Town-specific price tiers use 1.00 / 1.15 / 1.30, with lot factors 1.00 / 1.35 / 1.80. Correlated joint weights replace the former independent demographic mixes. All town price and lot assumptions are unvalidated. Income is not proof of lot size or willingness to pay.'"+s[end:]
s=s.replace("Mix and pricing assumptions are editable in the workbook.","Town / lot weights stay correlated. Pricing assumptions are editable and need provider quotes.")
start=s.index("// 09\n{");end=s.index("// 10\n{",start)
s=s[:start]+'''// Geographic demand and launch plan
{
const s=slide('Barnegat demand now has a defined funnel','Census facts anchor the denominator. Lawn eligibility and willingness to hire are assumptions.',sources.census+' '+sources.model+' '+censusNotes);
table(s,[['Barnegat launch funnel','Households'],['Census occupied households','10,265'],['Owner-occupied estimate: 88%','9,033'],['Assumed lawn-care eligibility: 75%','6,775'],['Assumed propensity to hire: 45%',n(T[8][0])],['2027 active customers after supply cap',n(B.rows[10][0])]],{y:245,h:331,widths:[862,290],font:25,highlights:[5]});
foot(s,`Base acquisition starts at 8% of the never-acquired outsourcing pool. Six planned providers × 40 households cap launch at ${n(B.rows[10][0])}. No provider commitments or measured hiring propensity are claimed.`);
}
{
const s=slide('A named rollout from Ocean to Monmouth County','Illustrative launch years. Each town has its own demand pool, provider plan, acquisition cost and local budget.',sources.model+' '+censusNotes);
table(s,[['Year','New towns','Total towns'],['2027','Barnegat','1'],['2028','Stafford, Lacey, Ocean / Waretown','4'],['2029','Berkeley, Toms River','6'],['2030','Brick, Jackson','8'],['2031','Howell, Wall','10'],['2032','Middletown, Holmdel','12'],['2033','Colts Neck, Rumson','14']],{y:245,h:355,widths:[154,805,193],font:24});
foot(s,'Municipal boundaries avoid overlapping CDPs or county totals. Ocean / Waretown refers to Ocean township in Ocean County. Launches remain conditional on supply, paid retention and service reliability.');
}
{
const s=slide('Affluent towns affect demand and job value','Income and home values are observed. Outsourcing, yard sizes and price tiers remain explicit hypotheses.',sources.model+' '+censusNotes+' Census ACS 2020-2024; income in 2024 dollars. Rumson median income is top-coded at $250,000+. Higher house value does not itself establish turf area.');
table(s,[['Town','Median income','Assumed hiring','Large / very large lots'],...['Barnegat','Stafford','Wall','Holmdel','Colts Neck','Rumson'].map(name=>{const t=towns.find(t=>t.name===name);return[t.name,whole(t.income)+(t.incomeCapped?'+':''),pct(t.outsource),pct(t.large)+' / '+pct(t.estate)];})],{y:245,h:343,widths:[270,250,230,402],font:23});
foot(s,'Hiring share applies only to eligible owner households. Lot shares apply to modeled customers, not all housing. Premium towns also have higher cash CAC assumptions; no automatic retention improvement is assumed.');
}
{
const s=slide('The regional plan is bounded by demand and supply','The household curve is now a sum of town cohorts, with launch timing and local capacity enforced.',sources.model+' '+censusNotes);
table(s,[['Base regional forecast','2027','2030','2033'],['Launched towns',...[0,3,6].map(i=>n(T[7][i]))],['Assumed outsourcing households',...[0,3,6].map(i=>n(T[8][i]))],['Active YardMatch households',...[0,3,6].map(i=>n(B.rows[10][i]))],['Qualified household capacity',...[0,3,6].map(i=>n(T[14][i]))],['Local launch + annual coverage',...[0,3,6].map(i=>whole(T[23][i]))]],{y:245,h:326,widths:[489,221,221,221],font:24,highlights:[3]});
foot(s,`${n(totalHH)} Census households across 14 towns support an assumed ${n(T[8][6])}-household outsourcing pool. The base captures ${pct(T[29][6])} as active customers by 2033. No unnamed national expansion is included.`);
}
''' + s[end:]
s=s.replace("Optional products add value after they reach scale","Optional products need more scale to pay back")
s=s.replace("using 5,415.075 partial-year weighted providers","using the active-provider totals in the town forecast")
s=s.replace("Together they add ${whole(A.streamRows[72][6])} of 2033 EBITDA after incremental costs.","Their combined 2033 EBITDA impact is ${whole(A.streamRows[72][6])} after incremental costs.")
s=s.replace("['New paying households, 2027 / 2033','300 / 40,000','500 / 160,000','500 / 280,000']","['New households, 2027 / 2033',...[D,B,U].map(c=>n(c.rows[7][0])+' / '+n(c.rows[7][6]))]")
s=s.replace("['Cash CAC, 2027 / 2033','$75 / $50','$55 / $28','$45 / $22']","['Cash CAC, 2027 / 2033',...[D,B,U].map(c=>whole(c.townRows[27][0])+' / '+whole(c.townRows[27][6]))]")
s=s.replace("3 to 36 staff","3 to 10 paid staff in the base")
s=s.replace("yAxis:{min:0,max:20,majorUnit:5","yAxis:{min:0,max:1.2,majorUnit:.3")
s=s.replace("The core base turns profitable in 2032","The regional base remains loss-making")
s=s.replace("Annual cash remains negative through 2032 because growth also funds equipment and the risk reserve.","No positive EBITDA year appears through 2033. Staffing, acquisition and local coverage exceed contribution at this scale.")
s=s.replace("Positive EBITDA arrives in 2031 in the upside and 2032 in the base; the downside remains negative through 2033. Provider fee acceptance and paid retention are critical.","All three named-town cases remain EBITDA-negative through 2033. Higher adoption alone does not cover the current cost structure. Pricing, acquisition efficiency and staffing need validation.")
s=s.replace("['Fixed overhead',whole(sum2(50))]","['Corporate + local operating costs',whole(sum2(50)+sum2(91))]")
s=s.replace("Annual retained savings first cover run costs in 2032; neither option recovers the full investment by 2033.","Neither build option covers annual run costs or recovers the investment by 2033 at the modeled regional scale.")
s=s.replace("500 paying households and measured second-season retention","240 launch households; measure second-season paid retention")
s=s.replace("Cash CAC of $50 or less in year two","Pilot CAC around $55; test a path below $50")
s=s.replace("versus $35 CAC, or", "versus ${whole(T[27][4])} CAC, or")
# Explain the change in the investment case, before finance and ownership.
at=s.index("// 17\n{")
s=s[:at]+'''{
const s=slide('The next proof is company-level economics','The named-town model replaces an unbounded expansion curve. It does not support the former profitability claim.',sources.model+' Prior build used 160,000 new households in 2033 without a local-market denominator. Revised forecast only includes the named municipalities. Fee sensitivity is arithmetic at unchanged volume, staffing, retention and acquisition, not a price recommendation.');
const requiredFee=B.unit.mixRows[85][6]-B.rows[51][6]/(B.rows[13][6]*1.0025);
block(s,'Positive repeat contribution',`About ${money(B.rows[68][6])} per paid repeat job in 2033, before customer acquisition and company overhead.`,66,250,532);
block(s,'A company-level funding gap',`${m(B.rows[26][6])} of annual revenue does not cover ten paid employees, acquisition and regional operations. EBITDA is ${m(B.rows[51][6])}.`,674,250,532);
block(s,'A pricing sensitivity',`At unchanged volume and costs, average service-fee revenue would need to rise from ${money(B.unit.mixRows[85][6])} to about ${money(requiredFee)} per job to reach EBITDA break-even.`,66,450,532);
block(s,'Evidence before faster expansion','Test provider fee acceptance, a leaner staffing plan and durable paid retention. Add new markets only with their own demand and launch budgets.',674,450,532);
foot(s,'The fee sensitivity includes the small payout-cost reduction from retaining a higher fee. It assumes no customer or provider response and is not a validated price.');
}
''' + s[at:]
# Append geographic source slides, preserving 12 existing external links.
at=s.index('await fs.mkdir(OUT')
s=s[:at]+'''for(let batch=0;batch<2;batch++){
 const group=towns.slice(batch*7,batch*7+7);
 const s=slide('Geographic evidence and planning inputs',`Census QuickFacts sources ${batch*7+1}–${batch*7+group.length}. All links open the underlying municipal table.`,censusNotes+' ACS 2020-2024 occupied-household and owner-occupancy estimates. Income in 2024 dollars. Figures are held constant through the forecast; no Census prediction is implied.');
 table(s,[['Municipality','Households','Owner share','Median income'],...group.map(t=>[t.name,n(t.households), (t.owner*100).toFixed(1)+'%',whole(t.income)+(t.incomeCapped?'+':'')])],{y:244,h:350,widths:[454,215,215,268],font:23});
 group.forEach((t,i)=>{const sh=text(s,'Source',73,244+(i+1)*43.75+21,72,21,13,C.green);sh.text.get('Source').link={uri:'https://www.census.gov/quickfacts/fact/table/'+t.slug+'/PST045225',isExternal:true};});
 foot(s,'Lawn eligibility, outsourcing, lot size, price premiums, launch timing and capacity are YardMatch assumptions, not Census findings. Editable sources and inputs appear in the workbook.');
}
''' + s[at:]
s=s.replace('Deck-v8.pptx','Deck-v9.pptx').replace('validation-v8.json','validation-v9.json')
f.write_text(s)
