export function buildServiceMix({sheets,top,put,formula,band,note,cols,ref,ar,C,dec}) {
 const joint=(c,n,z)=>`'Town forecast'!${c}${40+n*3+z}`;
 const mult=(c)=>Array.from({length:9},(_,i)=>`${joint(c,Math.floor(i/3),i%3)}*${Math.floor(i/3)===0?'1':c+(Math.floor(i/3)===1?29:30)}*${i%3===0?'1':c+(i%3===1?37:38)}`).join('+');
 const x=sheets['Service mix'];top(x,'YardMatch | Service prices and job mix',92);
 put(x,'C3','Active case');formula(x,'D3',"='Assumptions'!D3");
 const categories=['Basic mowing','Mowing + edging / trimming','Expanded maintenance bundle','Mulch / seasonal cleanup','Tree / larger property project'];
 const inputs=(r,label,vs,fmt='0.0%')=>{put(x,'C'+r,label);x.getRange(`D${r}:J${r}`).values=[Array.isArray(vs)?vs:Array(7).fill(vs)];x.getRange(`D${r}:J${r}`).format.font.color=C.blue;x.getRange(`D${r}:J${r}`).setNumberFormat(fmt);};
 band(x,6,'Service price at standard location / property');
 [60,85,120,300,1000].forEach((v,i)=>{const r=7+i;put(x,'C'+r,categories[i]);put(x,'D'+r,v);x.getRange('D'+r).format.font.color=C.blue;for(let j=1;j<7;j++)formula(x,cols[j]+r,`=${cols[j-1]}${r}*(1+${cols[j]}$13)`);x.getRange(`D${r}:J${r}`).setNumberFormat(dec);});
 inputs(13,'Annual service-price escalation',[0,.03,.03,.03,.03,.03,.03]);
 band(x,15,'Share of scheduled maintenance visits');
 inputs(16,'Basic mowing',[.60,.575,.55,.525,.50,.475,.45]);
 inputs(17,'Mowing + edging / trimming',[.30,.317,.334,.35,.367,.384,.40]);
 put(x,'C18','Expanded maintenance / remainder');
 band(x,21,'Additional scheduled jobs / full-season household');
 inputs(22,'Mulch / seasonal cleanup',[.60,.67,.73,.80,.87,.93,1.0],'0.00');
 inputs(23,'Tree / larger property project',[.03,.04,.05,.06,.07,.075,.08],'0.000');
 band(x,25,'Neighborhood price adjustment');
 inputs(26,'Standard neighborhood / town mix',[.70,.675,.65,.625,.60,.575,.55]);
 inputs(27,'Higher-cost neighborhood / town mix',[.25,.267,.283,.30,.317,.334,.35]);
 put(x,'C28','Highest-cost neighborhood / remainder');
 inputs(29,'Higher-cost neighborhood multiplier',1.15,'0.00"x"');
 inputs(30,'Highest-cost neighborhood multiplier',1.30,'0.00"x"');
 put(x,'C31','Weighted neighborhood multiplier');
 band(x,33,'Property-size adjustment');
 inputs(34,'Typical property / town mix',[.70,.683,.667,.65,.633,.617,.60]);
 inputs(35,'Large property / town mix',[.25,.258,.267,.275,.283,.292,.30]);
 put(x,'C36','Very large property / remainder');
 inputs(37,'Large property multiplier',1.35,'0.00"x"');
 inputs(38,'Very large property multiplier',1.80,'0.00"x"');
 put(x,'C39','Weighted property multiplier');
 put(x,'C41','Selected-case price multiplier');
 for(const [r,l] of Object.entries({43:'Scheduled maintenance visits / household',44:'All scheduled jobs / household',45:'Maintenance weighted average price',46:'All-job weighted average price',47:'ACH cost / job, cap per transaction',48:'Card cost / job',49:'Invalid mix remainder check',69:'Scheduled-job total check',70:'Neighborhood / property mix check'}))put(x,'C'+r,l);
 band(x,50,'Scheduled jobs by category / household');
 band(x,56,'Weighted service price by category');
 band(x,62,'ACH cost by category / transaction');
 for(let i=0;i<5;i++)for(const start of [51,57,63])put(x,'C'+(start+i),categories[i]);
 band(x,84,'Proposed pricing and effective processing');put(x,'C85','Weighted platform service fee');put(x,'C86','Effective ACH cost per transaction');
 for(const c of cols){
  const f={18:`1-SUM(${c}16:${c}17)`,28:`1-SUM(${c}26:${c}27)`,31:`${c}26+${c}27*${c}29+${c}28*${c}30`,36:`1-SUM(${c}34:${c}35)`,39:`${c}34+${c}35*${c}37+${c}36*${c}38`,41:ar('priceFactor',c),43:ar('visits',c),44:`${c}43+SUM(${c}22:${c}23)`,45:`SUMPRODUCT(${c}7:${c}9,${c}16:${c}18)*${c}31*${c}39*${c}41`,46:`SUMPRODUCT(${c}51:${c}55,${c}57:${c}61)/${c}44`,47:`SUMPRODUCT(${c}51:${c}55,${c}63:${c}67)/${c}44`,48:`${c}46*${ref('cardPct')}+${ref('cardFixed')}`,49:`MIN(0,${c}16:${c}18,${c}26:${c}28,${c}34:${c}36)`,69:`SUM(${c}51:${c}55)-${c}44`,70:`SUM(${c}26:${c}28)+SUM(${c}34:${c}36)-2`};
  f[26]=`SUM('Town forecast'!${c}40:${c}42)`;f[27]=`SUM('Town forecast'!${c}43:${c}45)`;f[34]=[40,43,46].map(r=>`'Town forecast'!${c}${r}`).join('+');f[35]=[41,44,47].map(r=>`'Town forecast'!${c}${r}`).join('+');
  f[45]=`SUMPRODUCT(${c}7:${c}9,${c}16:${c}18)*(${mult(c)})*${c}41`;
  for(let i=0;i<5;i++){
   f[51+i]=i<3?`${c}43*${c}${16+i}`:`${c}${i===3?22:23}`;
   f[57+i]=`${c}${7+i}*(${mult(c)})*${c}41`;
   const terms=[];
   // Sum 9 location/property combinations so the ACH cap applies before averaging.
   for(let n=0;n<3;n++)for(let z=0;z<3;z++)terms.push(`${joint(c,n,z)}*MIN(${c}${7+i}*${n===0?'1':c+(n===1?29:30)}*${z===0?'1':c+(z===1?37:38)}*${c}41*${ref('achPct')},${ref('achCap')})`);
   f[63+i]=terms.join('+');
  }
  const feeTerms=[],achTerms=[];
  for(let i=0;i<5;i++)for(let n=0;n<3;n++)for(let z=0;z<3;z++){
   const wt=`${c}${51+i}/${c}44*${joint(c,n,z)}`;
   const ticket=`${c}${7+i}*${n===0?'1':c+(n===1?29:30)}*${z===0?'1':c+(z===1?37:38)}*${c}41`;
   feeTerms.push(`${wt}*MAX(${ref('fee')},${ticket}*${ref('pctActive')})`);
   achTerms.push(`${wt}*MIN(${ticket}*'Payments'!${c}24+'Payments'!${c}25,'Payments'!${c}26)`);
  }
  f[85]=feeTerms.join('+');f[86]=achTerms.join('+');
  for(const[r,v]of Object.entries(f))formula(x,c+r,'='+v);
 }
 for(const r of[18,28,36])x.getRange(`D${r}:J${r}`).setNumberFormat('0.0%');
 for(const r of[31,39,41])x.getRange(`D${r}:J${r}`).setNumberFormat('0.00"x"');
 for(const r of[43,44,49,51,52,53,54,55,69,70])x.getRange(`D${r}:J${r}`).setNumberFormat('0.00');
 for(const r of[85,86,45,46,47,48,57,58,59,60,61,63,64,65,66,67])x.getRange(`D${r}:J${r}`).setNumberFormat(dec);
 for(const r of[44,46,47,48])x.getRange(`C${r}:J${r}`).format.fill=C.sage;
 for(const r of[49,69,70])x.getRange(`D${r}:J${r}`).conditionalFormats.addCustom(`ABS(D${r})>0.000001`,{fill:'#FDE5DD',font:{color:C.red}});
 note(x,73,'Planning assumptions only, September 2026. $60 basic mowing starts the price ladder. Prices include materials in the total service bill. Replace estimates with provider quotes. Proposed fees: $45 / $65 / $90 once per new pair, by property scope, plus MAX($4.49, 1% of bill) and processing at cost per service.');
 note(x,76,'Maintenance shares split existing visits. A bundle is one service / payment. Projects add separate visits, not additional finder fees. A 0.60 project frequency means 0.60 scheduled jobs per full-season household-year.');
 note(x,79,'Town exposure weights link neighborhood price tiers and property sizes jointly. Income and yard-size assumptions are not counted as independent growth uplifts. Same capture, completion and ACH share apply to all categories. Town provider capacity is explicit; quote distribution and service-specific capacity still need calibration.');
 return {sheet:x,categories};
}
