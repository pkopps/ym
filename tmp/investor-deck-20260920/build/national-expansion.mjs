export function buildNationalExpansion({sheets,top,put,formula,band,note,cols,years,ref,ar,C,usd}){
 const x=sheets['National rollout'];
 top(x,'YardMatch | National service-area rollout',92);
 const blue=(addr,v,fmt)=>{put(x,addr,v);x.getRange(addr).format.font.color=C.blue;if(fmt)x.getRange(addr).setNumberFormat(fmt);};
 const row=(r,label,values,fmt='0')=>{put(x,'C'+r,label);x.getRange(`D${r}:J${r}`).values=[values];x.getRange(`D${r}:J${r}`).format.font.color=C.blue;x.getRange(`D${r}:J${r}`).setNumberFormat(fmt);};
 const select=(target,base,down,up)=>{put(x,'C'+target,'Selected case');for(const c of cols)formula(x,c+target,`=IF('Assumptions'!$D$3="Base",${c}${base},IF('Assumptions'!$D$3="Downside",${c}${down},${c}${up}))`);};
 band(x,6,'National footprint / editable planning cases');
 row(7,'Base service areas',[1,6,25,70,175,400,750]);
 row(8,'Downside service areas',[1,4,12,35,90,200,400]);
 row(9,'Upside service areas',[1,8,35,110,300,700,1200]);
 select(10,7,8,9);put(x,'C10','Active service areas / selected case');
 row(12,'Base states',[1,1,2,4,10,25,40]);
 row(13,'Downside states',[1,1,1,3,6,12,25]);
 row(14,'Upside states',[1,2,4,8,18,35,48]);
 select(15,12,13,14);put(x,'C15','Active states / selected case');
 row(17,'Base metro clusters',[1,1,3,6,14,30,50]);
 row(18,'Downside metro clusters',[1,1,2,4,9,18,32]);
 row(19,'Upside metro clusters',[1,2,5,10,22,45,70]);
 select(20,17,18,19);put(x,'C20','Active metro clusters / selected case');
 band(x,23,'Cohort ramp / active households per service area by age');
 const ages=[240,550,850,1100,1300,1450,1550];
 ages.forEach((v,i)=>{put(x,'C'+(24+i),`Age ${i+1} active households / area`);blue('D'+(24+i),v,'#,##0');});
 note(x,32,'A service area may be one municipality, several small neighboring municipalities, or a group of suburban neighborhoods. Cohorts open during the year. Age 1 represents an initial partial season; full maturity requires multiple seasons.');
 band(x,36,'Operating assumptions / editable');
 row(37,'Base customer CAC',[55,50,45,40,35,32,30],usd);
 row(38,'Downside customer CAC',[70,65,60,55,50,45,40],usd);
 row(39,'Upside customer CAC',[45,40,35,32,28,25,22],usd);
 select(40,37,38,39);put(x,'C40','Customer CAC / selected case');x.getRange('D40:J40').setNumberFormat(usd);
 row(42,'Base paid employees',[3,5,8,15,25,40,60]);
 row(43,'Downside paid employees',[3,4,7,12,20,32,48]);
 row(44,'Upside paid employees',[3,6,10,18,32,55,85]);
 select(45,42,43,44);put(x,'C45','Paid employees / selected case');
 row(47,'Base corporate overhead',[42000,70000,120000,200000,300000,420000,550000],usd);
 row(48,'Downside corporate overhead',[42000,65000,100000,160000,240000,340000,450000],usd);
 row(49,'Upside corporate overhead',[42000,80000,140000,240000,380000,550000,750000],usd);
 select(50,47,48,49);put(x,'C50','Corporate overhead / selected case');x.getRange('D50:J50').setNumberFormat(usd);
 const settings=[[52,'Launch spend / new service area',5000,usd],[53,'Annual coverage / active service area',2000,usd],[54,'Annual regional operations / metro cluster',20000,usd],[55,'Equipment / paid employee',5000,usd],[56,'Households / active provider',40,'#,##0'],[57,'Provider annual retention',.85,'0.0%'],[58,'Welcome finder waivers / new provider',1,'0'],[59,'Typical-property share of new relationships',.65,'0.0%'],[60,'Large-property share of new relationships',.25,'0.0%'],[61,'Very-large-property share of new relationships',.10,'0.0%']];
 for(const[r,label,value,fmt]of settings){put(x,'C'+r,label);blue('D'+r,value,fmt);}
 band(x,64,'National cohort forecast');
 const labels={65:'New service areas',66:'Opening active households',67:'Retained households',68:'New first-time households',69:'Ending active households',70:'Full-season equivalent households',71:'Churned households',72:'Ending active providers',73:'Retained providers',74:'New / replacement providers',75:'Average active providers',76:'Customer acquisition spend',77:'Launch spend',78:'Service-area coverage',79:'Regional cluster operations',80:'Total local operating spend',81:'Equipment capex',82:'Weighted customer CAC',83:'Average finder fee before waiver',84:'Welcome pair count',85:'Net finder-fee revenue',87:'Service areas above prior year / check',88:'Household balance check',89:'Provider balance check'};
 for(const[r,label]of Object.entries(labels))put(x,'C'+r,label);
 for(const[i,c]of cols.entries()){
  const p=cols[i-1];
  const newAreas=`${c}10-${i?p+'10':'0'}`;
  const cohortTerms=[];
  for(let launch=0;launch<=i;launch++){
   const launchCol=cols[launch],age=i-launch+1;
   cohortTerms.push(`(${launchCol}10-${launch?cols[launch-1]+'10':'0'})*$D$${23+Math.min(age,7)}`);
  }
  const end=cohortTerms.join('+');
  const opening=i?`${p}69`:'0';
  const retained=`${opening}*${ar('ret',c)}`;
  const newHH=`MAX(0,${end}-${retained})`;
  const endProviders=`ROUNDUP((${end})/$D$56,0)`;
  const retainedProviders=i?`${p}72*$D$57`:'0';
  const newProviders=`MAX(0,${endProviders}-${retainedProviders})`;
  const avgFee=`$D$59*${ref('finder')}+$D$60*${ref('largeFinderActive')}+$D$61*${ref('veryLargeFinderActive')}`;
  const f={65:newAreas,66:opening,67:retained,68:newHH,69:end,70:`${retained}+${newHH}*${ref('newWeight')}`,71:`${opening}-${retained}`,72:endProviders,73:retainedProviders,74:newProviders,75:`${retainedProviders}+${newProviders}*${ref('newWeight')}`,76:`${newHH}*${c}40`,77:`(${newAreas})*$D$52`,78:`${c}10*$D$53`,79:`${c}20*$D$54`,80:`SUM(${c}77:${c}79)`,81:`${c}45*$D$55`,82:`IFERROR(${c}76/${newHH},0)`,83:avgFee,84:`MIN(${newHH},${newProviders}*$D$58)`,85:`(${newHH}-${c}84)*(${avgFee})`,87:`MAX(0,-(${newAreas}))`,88:`(${retained})+(${newHH})-(${end})`,89:`${retainedProviders}+${newProviders}-${endProviders}`};
  for(const[r,v]of Object.entries(f))formula(x,c+r,'='+v);
 }
 for(const r of[76,77,78,79,80,81,82,83,85])x.getRange(`D${r}:J${r}`).setNumberFormat(usd);
 for(const r of[10,15,20,69,80,85])x.getRange(`C${r}:J${r}`).format.fill=C.sage;
 x.getRange('D87:J89').setNumberFormat('0.00');
 note(x,91,'Base case reaches 750 service areas across 40 states and 50 metro clusters in 2033. The launch sequence is conditional on market-level liquidity and contribution gates. Detailed New Jersey towns remain as pilot evidence; national cohorts drive the consolidated financial forecast.');
 return {sheet:x,rows:[10,15,20,...Object.keys(labels).map(Number)],ageRows:[24,25,26,27,28,29,30]};
}
