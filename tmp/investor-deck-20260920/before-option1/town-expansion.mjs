import fs from 'node:fs';
export const towns=JSON.parse(fs.readFileSync(new URL('./town-data.json',import.meta.url)));
export function buildTowns({sheets,top,put,formula,band,note,cols,years,ref,ar,C,usd}){
 const a=sheets['Town inputs'], b=sheets['Town forecast'];
 top(a,'YardMatch | Named town expansion inputs',108);top(b,'YardMatch | Town demand and capacity',375);
 a.getRange('H:H').format.columnWidth=19;a.getRange('H7:H20').format.horizontalAlignment='center';
 const blue=(addr,v)=>{put(a,addr,v);a.getRange(addr).format.font.color=C.blue;};
 const hdr=(r,values)=>{a.getRange(`C${r}:J${r}`).values=[values];a.getRange(`C${r}:J${r}`).format={fill:C.sage,font:{bold:true,size:10},wrapText:true,rowHeight:38};};
 hdr(5,['Observed geography','Households','Owner share','Median income','Home value','Census FIPS','Period','County']);
 hdr(24,['Planning / editable','Launch year','Lawn eligible','Hire service','Price tier 1-3','Large lots','Very large lots','Launch supply']);
 hdr(43,['Planning / editable','Recruit / year','Supply ceiling','2027 cash CAC','Launch spend','Annual local ops','Typical lots','Eligible pool']);
 for(const[t,ix]of towns.map((t,i)=>[t,i])){
  let r=7+ix, p=26+ix, q=45+ix;
  a.getRange(`C${r}:J${r}`).values=[[t.name,t.households,t.owner,t.income,t.value,t.fips,'2020-2024',t.county]];
  put(a,'L'+r,'https://www.census.gov/quickfacts/fact/table/'+t.slug+'/PST045225');
  a.getRange(`D${r}:J${r}`).format.font.color=C.blue;a.getRange('E'+r).setNumberFormat('0.0%');a.getRange(`F${r}:G${r}`).setNumberFormat(usd);a.getRange('H'+r).setNumberFormat('@');
  if(t.incomeCapped){a.getRange('F'+r).setNumberFormat('$#,##0"+"');put(a,'L'+p,'Census income is top-coded at $250,000+. Numeric value is the lower bound; it is not an exact median.');}
  a.getRange(`C${p}:J${p}`).values=[[t.name,t.launch,t.lawn,t.outsource,t.tier,t.large,t.estate,t.launchProviders]];
  a.getRange(`D${p}:J${p}`).format.font.color=C.blue;a.getRange(`E${p}:F${p}`).setNumberFormat('0%');a.getRange(`H${p}:I${p}`).setNumberFormat('0%');a.getRange('D'+p).setNumberFormat('0');
  a.getRange(`C${q}:H${q}`).values=[[t.name,t.annualRecruit,t.maxProviders,t.cac,t.launchCost,t.localCost]];
  a.getRange(`D${q}:H${q}`).format.font.color=C.blue;a.getRange(`F${q}:H${q}`).setNumberFormat(usd);
  formula(a,'I'+q,`=1-H${p}-I${p}`);a.getRange('I'+q).setNumberFormat('0%');
  formula(a,'J'+q,`=D${r}*E${r}*E${p}*F${p}`);
 }
 band(a,61,'Acquisition and supply settings / editable');put(a,'C81','Maximum paid employees');blue('D81',5);a.getRange('D81').setNumberFormat('0');
 const settings={63:['First-year share of remaining pool',.08,'0%'],64:['Annual increase in acquisition rate',.02,'0%'],65:['Maximum share of remaining pool / year',.16,'0%'],66:['Calendar-year CAC improvement',.05,'0%'],67:['Local cost inflation',.03,'0%'],68:['Core employee floor',3,'0'],69:['Households covered by employee floor',1000,'#,##0'],70:['Extra households per added employee',2500,'#,##0'],71:['Corporate overhead at launch',60000,usd],72:['Equipment per employee / year',5000,usd],73:['Downside demand multiplier',.80,'0%'],74:['Upside demand multiplier',1.15,'0%'],75:['Downside acquisition multiplier',.60,'0%'],76:['Upside acquisition multiplier',1.50,'0%'],77:['Downside supply multiplier',.80,'0%'],78:['Upside supply multiplier',1.25,'0%'],79:['Downside cash CAC multiplier',1.35,'0%'],80:['Upside cash CAC multiplier',.80,'0%']};
 for(const[r,[label,v,fmt]]of Object.entries(settings)){put(a,'C'+r,label);blue('D'+r,v);a.getRange('D'+r).setNumberFormat(fmt);}
 note(a,83,'Census facts: occupied households, owner occupancy, median income and home value. Held constant; no population growth or vacant/seasonal homes added. Municipalities are distinct. Ocean / Waretown means Ocean township in Ocean County, not Monmouth.');
 note(a,86,'All lawn eligibility, willingness to hire, lot sizes, price tiers, launch dates and costs are planning assumptions. Higher income informs a hypothesis; Census does not measure lawn-care purchasing or yard size. Excludes renters, HOA-provided care and commercial demand.');
 note(a,89,'Eligible pool = households × owner share × lawn eligibility × assumed outsourcing. New customers come only from the never-acquired pool. Lost customers are not recycled into finder-fee revenue. No national market is silently added.');
 note(a,92,'Each provider is allocated once to a primary-town capacity pool. Shared providers must split their capacity, not be counted twice. Qualified supply is a plan, not signed providers. Active providers reflect demand; idle planned capacity does not incur payout-account costs.');
 note(a,95,'Cash CAC covers customer media, referrals and incentives. Launch spend covers local setup / events; local ops covers travel and coverage. Provider onboarding and founder-inclusive payroll are separate. Annual recruiting inputs are net supply-growth targets; replacements are additionally funded.');
 note(a,98,'Scenario multipliers alter outsourcing, acquisition and supply. Core staffing scales with active households, capped at five paid employees including founder. This cap assumes operational capacity is sufficient; no demand lift or extra outsourcing is added. No assumed income-based retention lift. Same seasonal service schedule across towns; category and job capture inputs remain in Service mix and Assumptions.');
 const ti=(c,r)=>`'Town inputs'!$${c}$${r}`, setting=r=>ti('D',r);
 const mult=(down,up)=>`IF('Assumptions'!$D$3="Downside",${setting(down)},IF('Assumptions'!$D$3="Upside",${setting(up)},1))`;
 const rows={7:'Launched towns',8:'Outsourcing pool in launched towns',9:'New first-time households',10:'Retained households',11:'Ending active households',12:'Full-season equivalent households',13:'Cumulative ever-acquired households',14:'Qualified household capacity',15:'Planned qualified providers',16:'Ending payout-active providers',17:'Retained active providers',18:'New / replacement active providers',19:'Average payout-active providers',20:'Cash customer acquisition',21:'Local launch spend',22:'Recurring local coverage costs',23:'Total local operating spend',24:'Core paid employees',25:'Corporate overhead',26:'Equipment capex',27:'Weighted customer CAC',29:'Share of launched pool active',31:'Households above qualified capacity',32:'Ever-acquired above outsourcing pool',33:'Invalid input count',34:'Joint mix sum check',35:'Gross property-tier finder fees',36:'Welcome finder-fee discounts',37:'Net property-tier finder revenue',38:'Average finder fee before waivers',39:'Welcome pair count'};
 for(const[r,l]of Object.entries(rows))put(b,'C'+r,l);
 const bases=towns.map((_,i)=>62+i*22);
 towns.forEach((t,i)=>{
  const r=bases[i], p=26+i, q=45+i, obs=7+i;
  band(b,r,t.name+' | '+t.county+' County');
  const labels=['Years since launch','Assumed outsourcing pool','Opening active households','Retained households','Previously acquired households','Qualified provider capacity plan','Household capacity','Unconstrained new demand','New first-time households','Ending active households','Full-season equivalent households','Cumulative ever-acquired households','Ending payout-active providers','Retained active providers','New / replacement active providers','Average payout-active providers','Cash acquisition spend','Launch spend','Annual local coverage'];
  labels.forEach((l,j)=>put(b,'C'+(r+1+j),l));
  cols.forEach((c,k)=>{
   const prev=cols[k-1], yr=years[k], age=`${c}${r+1}`, pool=`${c}${r+2}`, retained=`${c}${r+4}`, prior=`${c}${r+5}`;
   const fs={1:`MAX(0,${yr}-${ti('D',p)}+1)`,2:`IF(${age}>0,${ti('D',obs)}*${ti('E',obs)}*${ti('E',p)}*MIN(1,${ti('F',p)}*${mult(73,74)}),0)`,3:k?`${prev}${r+10}`:'0',4:`${c}${r+3}*${ar('ret',c)}`,5:k?`${prev}${r+12}`:'0',6:`IF(${age}=0,0,MIN(ROUNDUP(${ti('E',q)}*${mult(77,78)},0),ROUNDUP((${ti('J',p)}+(${age}-1)*${ti('D',q)})*${mult(77,78)},0)))`,7:`${c}${r+6}*${ref('capacity')}`,8:`MAX(0,${pool}-${prior})*MIN(1,MIN(${setting(65)},${setting(63)}+MAX(0,${age}-1)*${setting(64)})*${mult(75,76)})`,9:`MIN(${c}${r+8},MAX(0,${c}${r+7}-${retained}))`,10:`${retained}+${c}${r+9}`,11:`${retained}+${c}${r+9}*${ref('newWeight')}`,12:`${prior}+${c}${r+9}`,13:`MIN(${c}${r+6},ROUNDUP(${c}${r+10}/${ref('capacity')},0))`,14:k?`${prev}${r+13}*${ref('providerRet')}`:'0',15:`MAX(0,${c}${r+13}-${c}${r+14})`,16:`${c}${r+14}+${c}${r+15}*${ref('newWeight')}`,17:`${c}${r+9}*${ti('F',q)}*(1-${setting(66)})^${k}*${mult(79,80)}`,18:`IF(${age}=1,${ti('G',q)}*(1+${setting(67)})^${k},0)`,19:`IF(${age}>0,${ti('H',q)}*(1+${setting(67)})^${k}*IF(${age}=1,${ref('newWeight')},1),0)`};
   for(const[j,v]of Object.entries(fs))formula(b,c+(r+Number(j)),'='+v);
  });
  b.getRange(`D${r+17}:J${r+19}`).setNumberFormat(usd);
 });
 for(const[c,k]of cols.map((c,i)=>[c,i])){
  const sum=offset=>bases.map(r=>`${c}${r+offset}`).join('+');
  const f={7:bases.map(r=>`IF(${c}${r+1}>0,1,0)`).join('+'),8:sum(2),9:sum(9),10:sum(4),11:sum(10),12:sum(11),13:sum(12),14:sum(7),15:sum(6),16:sum(13),17:sum(14),18:sum(15),19:sum(16),20:sum(17),21:sum(18),22:sum(19),23:`SUM(${c}21:${c}22)`,24:`MIN(${setting(81)},${setting(68)}+ROUNDUP(MAX(0,${c}11-${setting(69)})/${setting(70)},0))`,25:`${setting(71)}*(1+${setting(67)})^${k}`,26:`${c}24*${setting(72)}`,27:`IFERROR(${c}20/${c}9,0)`,29:`IFERROR(${c}11/${c}8,0)`,31:bases.map(r=>`MAX(0,${c}${r+10}-${c}${r+7})`).join('+'),32:bases.map(r=>`MAX(0,${c}${r+12}-${c}${r+2})`).join('+'),34:`SUM(${c}40:${c}48)-1`};
  const invalid=towns.map((t,i)=>{let p=26+i,q=45+i;return `IF(OR(${ti('E',p)}<0,${ti('E',p)}>1,${ti('F',p)}<0,${ti('F',p)}>1,${ti('H',p)}<0,${ti('I',p)}<0,${ti('I',q)}<0,${ti('G',p)}<1,${ti('G',p)}>3,MOD(${ti('G',p)},1)<>0,${ti('D',p)}<2027,MOD(${ti('D',p)},1)<>0,${ti('J',p)}<0,${ti('D',q)}<0,${ti('E',q)}<0),1,0)`;});
  f[33]=invalid.join('+');
  for(let tier=1;tier<=3;tier++)for(let lot=0;lot<3;lot++){
   const r=40+(tier-1)*3+lot;put(b,'C'+r,`Tier ${tier} / ${['typical','large','very large'][lot]} property weight`);
   const terms=towns.map((t,i)=>`IF(${ti('G',26+i)}=${tier},${c}${bases[i]+11}*${lot===0?ti('I',45+i):ti(lot===1?'H':'I',26+i)},0)`);
   f[r]=`IF(${c}12>0,(${terms.join('+')})/${c}12,${tier===1&&lot===0?1:0})`;
  }
  // Finder fees use the NEW household mix, not full-season repeat-job weights.
  const averages=towns.map((t,i)=>`(${ti('I',45+i)}*${ref('finder')}+${ti('H',26+i)}*${ref('largeFinderActive')}+${ti('I',26+i)}*${ref('veryLargeFinderActive')})`);
  const waivers=towns.map((t,i)=>`MIN(${c}${bases[i]+9},${c}${bases[i]+15}*${ref('waive')})`);
  f[35]=towns.map((t,i)=>`${c}${bases[i]+9}*${averages[i]}`).join('+');
  f[36]=towns.map((t,i)=>`${waivers[i]}*${averages[i]}`).join('+');
  f[37]=`${c}35-${c}36`;f[38]=`IFERROR(${c}35/${c}9,0)`;f[39]=waivers.join('+');
  for(const[r,v]of Object.entries(f))formula(b,c+r,'='+v);
 }
 for(const r of[20,21,22,23,25,26,27,35,36,37,38])b.getRange(`D${r}:J${r}`).setNumberFormat(usd);
 b.getRange('D29:J29').setNumberFormat('0.0%');b.getRange('D40:J48').setNumberFormat('0.0%');
 for(const r of[7,11,23,24])b.getRange(`C${r}:J${r}`).format.fill=C.sage;
 note(b,51,'Acquisition ramp: 8% of remaining never-acquired outsourcing households in launch year, +2 percentage points per year up to 16%, subject to scenario multipliers and local supply. No returns of lost customers or second finder fee are assumed. Finder waivers follow the new-property mix within each town.');
 note(b,54,'Joint town / property weights use full-season household exposure. Price tiers and lot sizes stay correlated within towns. They replace the old independent demographic mixes; standard service frequency and retention remain explicit shared assumptions.');
 note(b,57,'Launch schedule is illustrative and conditional on service quality, retention and repeat contribution. Capacity is town-specific; 40 year-end households per provider. Route times, acreage and service-specific certifications require pilot validation.');
 return {inputs:a,sheet:b,bases,rows:[...Object.keys(rows).map(Number),40,41,42,43,44,45,46,47,48]};
}
