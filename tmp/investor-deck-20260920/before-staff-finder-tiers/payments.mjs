export function buildPayments({sheets,top,put,formula,band,note,cols,years,ref,ar,C,dec,usd}){
 const x=sheets.Payments;top(x,'YardMatch | Payment costs and build decision',82);
 put(x,'C3','Growth case');formula(x,'D3',"='Assumptions'!D3");
 put(x,'C4','Own-engine live year / 0 = retain Stripe');put(x,'D4',0);x.getRange('D4').format.font.color=C.blue;
 x.getRange('D4').dataValidation={rule:{type:'whole',operator:'between',formula1:0,formula2:2033}};
 x.getRange('D5:J5').clear({applyTo:'contents'});put(x,'D5','Assumption');
 const input=[
 [7,'Alternative card rate incl. network cost',.0235,'0.00%'],[8,'Alternative card fixed cost',.12,dec],
 [9,'Alternative ACH percentage',.001,'0.00%'],[10,'Alternative ACH fixed cost',.25,dec],[11,'Alternative ACH total cap',1.5,dec],
 [12,'Alternative payout-volume rate',.001,'0.00%'],[13,'Alternative cost / payout',.10,dec],[14,'Alternative cost / active account month',1,dec],
 [15,'Total build and migration cost',600000,usd],[16,'Annual payment operations cost at launch',300000,usd],[17,'Annual operations cost escalation',.03,'0.0%']];
 for(const[r,l,v,f]of input){put(x,'C'+r,l);put(x,'D'+r,v);x.getRange('D'+r).format.font.color=C.blue;x.getRange('D'+r).setNumberFormat(f);}
 note(x,18,'Alternative rates are unquoted planning estimates, not zero-cost rails. Build: $300k before launch + $300k at launch. Annual run cost: $200k team + $50k security/compliance + $50k bank/vendor minimums. All are incremental to payroll.');
 x.getRange('D20:J20').values=[years];x.getRange('D20:J20').setNumberFormat('0');x.getRange('C20:J20').format.fill=C.sage;
 const labs={21:'Own engine live / 1 = yes',22:'Effective card percentage',23:'Effective card fixed charge',24:'Effective ACH percentage',25:'Effective ACH fixed charge',26:'Effective ACH total cap',27:'Effective payout-volume rate',28:'Effective cost / payout',29:'Effective active-account monthly cost',30:'Build / migration expense',31:'Incremental annual payment operations',33:'Card + ACH processing expense',34:'Recovered from providers at cost',35:'Retained processing expense',36:'Payout / account expense',37:'Bank-link verification allowance',38:'Total payment vendor expense',40:'Same-volume Stripe card + ACH cost',41:'Same-volume Stripe provider proceeds',42:'Same-volume Stripe payout / account cost',43:'Provider savings passed through',44:'Payout / account savings retained',45:'Platform impact after build / run costs',46:'Cumulative platform impact before tax',48:'Retained savings cover annual run cost',49:'Cumulative build-cost recovery',51:'Payment switch input check'};
 for(const[r,l]of Object.entries(labs))put(x,'C'+r,l);
 for(const [i,c]of cols.entries()){
  const p=cols[i-1];
  const f={21:`IF(AND($D$4>=2028,${c}$20>=$D$4),1,0)`,22:`IF(${c}21=1,$D$7,${ref('cardPct')})`,23:`IF(${c}21=1,$D$8,${ref('cardFixed')})`,24:`IF(${c}21=1,$D$9,${ref('achPct')})`,25:`IF(${c}21=1,$D$10,0)`,26:`IF(${c}21=1,$D$11,${ref('achCap')})`,27:`IF(${c}21=1,$D$12,${ref('connectPct')})`,28:`IF(${c}21=1,$D$13,${ref('connectFixed')})`,29:`IF(${c}21=1,$D$14,${ref('connectActive')})`,30:`IF(AND($D$4>=2028,OR(${c}$20=$D$4-1,${c}$20=$D$4)),$D$15/2,0)`,31:`IF(${c}21=1,$D$16*(1+$D$17)^(${c}$20-$D$4),0)`,33:`SUM('Operating model'!${c}29:${c}30)`,34:`'Operating model'!${c}28`,35:`${c}33-${c}34`,36:`SUM('Operating model'!${c}31:${c}33)`,37:`'Operating model'!${c}35`,38:`${c}33+${c}36+${c}37`,40:`'Operating model'!${c}13*((1-${ar('ach',c)})*'Service mix'!${c}48+${ar('ach',c)}*'Service mix'!${c}47)`,41:`'Operating model'!${c}14-SUM('Operating model'!${c}24:${c}25)-${c}40*${ref('recoverActive')}`,42:`${c}41*${ref('connectPct')}+'Operating model'!${c}20*${ref('season')}*(${ref('payouts')}*${ref('connectFixed')}+${ref('connectActive')})`,43:`(${c}40-${c}33)*${ref('recoverActive')}`,44:`${c}42-${c}36`,45:`${c}44+(${c}40-${c}33)*(1-${ref('recoverActive')})-${c}30-${c}31`,46:`${c}45+${i?p+'46':'0'}`,48:`IF(${c}21=0,"Not live",IF(${c}44+(${c}40-${c}33)*(1-${ref('recoverActive')})>=${c}31,"Yes","No"))`,49:`IF($D$4=0,"Not selected",IF(${c}46>=0,IF(${c}$20>=$D$4,"Recovered","Before build"),"Not recovered"))`,51:`IF(OR($D$4=0,AND($D$4>=2028,$D$4<=2033)),0,1)`};
  for(const[r,v]of Object.entries(f))formula(x,c+r,'='+v);
 }
 for(const r of[22,24,27])x.getRange(`D${r}:J${r}`).setNumberFormat('0.00%');
 for(const r of[23,25,26,28,29])x.getRange(`D${r}:J${r}`).setNumberFormat(dec);
 for(const r of[30,31,33,34,35,36,37,38,40,41,42,43,44,45,46])x.getRange(`D${r}:J${r}`).setNumberFormat(usd);
 for(const r of[34,38,43,45,46])x.getRange(`C${r}:J${r}`).format.fill=C.sage;
 note(x,54,'Default is 0: retain Stripe. Enter 2028 for year-two launch or 2029 for year-three launch. Build and operations are fully expensed. Rates replace Stripe only after launch. Bank verification, payment losses and risk cash remain in the model.');
 note(x,57,'Processing savings are passed to providers when recovery is 100%. YardMatch retains only payout/account savings, less incremental build and run costs. Comparison holds volume and platform pricing constant. It is a pre-tax decision test.');
 note(x,60,'Stripe standard US processing and Connect sources: https://stripe.com/pricing and https://stripe.com/connect/pricing. Platform-controlled pricing assumed. Alternative card cost includes acquiring, network and processing estimates, not only a gateway fee.');
 note(x,63,'Interchange survives a software build: https://usa.visa.com/support/small-business/regulations-fees.html . ACH still uses financial institutions and paid rails: https://www.frbservices.org/resources/fees/ach-2026 . Federal Reserve fees are not a direct merchant quote.');
 note(x,66,'Card-data security obligations remain: https://www.pcisecuritystandards.org/standards/pci-dss/ . Before a build: obtain sponsor/acquirer quotes, security scope, migration plan and measured reliability. No licenses or production changes are assumed here.');
 return x;
}
