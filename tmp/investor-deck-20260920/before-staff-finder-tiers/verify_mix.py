import json, math
from pathlib import Path
P=Path('/Users/patrickkopps/Documents/app/tmp/investor-deck-20260920/build')
d=json.loads((P/'model-data.json').read_text())
inputs={
'Base':dict(new=[500,2500,9000,25000,55000,100000,160000],ret=[.7,.7,.75,.78,.8,.8,.8],ach=[.1,.2,.3,.4,.5,.55,.6],cac=[55,50,45,40,35,30,28],fte=[3,5,8,12,18,26,36],fixed=[60000,100000,160000,250000,400000,600000,800000],capex=[15000,25000,40000,60000,90000,130000,180000],visits=20,capture=.9,complete=.95,price=1),
'Downside':dict(new=[300,1200,3500,8000,15000,25000,40000],ret=[.55,.55,.60,.60,.65,.65,.65],ach=[0,.05,.05,.10,.10,.15,.20],cac=[75,70,65,60,55,50,50],fte=[3,4,6,8,10,13,16],fixed=[60000,80000,120000,160000,200000,260000,340000],capex=[15000,25000,40000,60000,90000,130000,180000],visits=16,capture=.8,complete=.9,price=1.15),
'Upside':dict(new=[500,3000,12000,35000,85000,170000,280000],ret=[.8,.8,.82,.85,.85,.85,.85],ach=[.2,.35,.5,.6,.7,.75,.75],cac=[45,35,30,28,25,23,22],fte=[3,5,9,15,24,36,52],fixed=[60000,100000,180000,300000,500000,800000,1200000],capex=[15000,25000,45000,75000,120000,180000,260000],visits=24,capture=.95,complete=.97,price=1)}
towns=json.loads((P/'town-data.json').read_text())
def forecast_towns(case,q):
 demand,acquire,supply,cacmult={'Base':(1,1,1,1),'Downside':(.8,.6,.8,1.35),'Upside':(1.15,1.5,1.25,.8)}[case]
 histories=[]
 for town in towns:
  history=[];hh=ever=active=0
  for i in range(7):
   year=2027+i;age=max(0,year-town['launch']+1)
   pool=town['households']*town['owner']*town['lawn']*min(1,town['outsource']*demand) if age else 0
   retained=hh*q['ret'][i]
   qualified=min(math.ceil(town['maxProviders']*supply),math.ceil((town['launchProviders']+(age-1)*town['annualRecruit'])*supply)) if age else 0
   capacity=qualified*40
   desired=max(0,pool-ever)*min(1,min(.16,.08+max(0,age-1)*.02)*acquire)
   new=min(desired,max(0,capacity-retained));end=retained+new;fse=retained+new*.5
   aend=min(qualified,math.ceil(end/40));aret=active*.85;anew=max(0,aend-aret);avg=aret+anew*.5
   cashcac=new*town['cac']*.95**i*cacmult
   launch=town['launchCost']*1.03**i if age==1 else 0
   local=town['localCost']*1.03**i*(.5 if age==1 else 1) if age else 0
   vals={1:age,2:pool,3:hh,4:retained,5:ever,6:qualified,7:capacity,8:desired,9:new,10:end,11:fse,12:ever+new,13:aend,14:aret,15:anew,16:avg,17:cashcac,18:launch,19:local}
   history.append(vals);hh=end;ever+=new;active=aend
  histories.append(history)
 out=[]
 for i in range(7):
  agg=lambda r:sum(h[i][r] for h in histories)
  active=agg(10);fse=agg(11);joint=[0]*9
  for town,h in zip(towns,histories):
   for z,weight in enumerate([1-town['large']-town['estate'],town['large'],town['estate']]):
    joint[(town['tier']-1)*3+z]+=h[i][11]*weight/fse
  fte=3+math.ceil(max(0,active-1000)/2500)
  vals={7:sum(h[i][1]>0 for h in histories),8:agg(2),9:agg(9),10:agg(4),11:active,12:fse,13:agg(12),14:agg(7),15:agg(6),16:agg(13),17:agg(14),18:agg(15),19:agg(16),20:agg(17),21:agg(18),22:agg(19),23:agg(18)+agg(19),24:fte,25:60000*1.03**i,26:fte*5000,27:agg(17)/agg(9),29:active/agg(2),31:0,32:0,33:0,34:0}
  vals.update({40+j:v for j,v in enumerate(joint)})
  for r,v in vals.items():
   assert math.isclose(v,d['captures'][case]['townRows'][str(r)][i],abs_tol=1e-7,rel_tol=1e-11),(case,'town sum',r,i,v)
  for k,h in enumerate(histories):
   for r,v in h[i].items():
    assert math.isclose(v,d['captures'][case]['townDetails'][k][str(r)][i],abs_tol=1e-7,rel_tol=1e-11),(case,towns[k]['name'],r,i,v)
  out.append(vals)
 q.update(new=[v[9] for v in out],cac=[v[27] for v in out],fte=[v[24] for v in out],fixed=[v[25] for v in out],capex=[v[26] for v in out],town=out)
for case,q in inputs.items():forecast_towns(case,q)
checks=[(name,q,True,0,d['captures'][name]['rows'],None) for name,q in inputs.items()]
checks += [('Prior',inputs['Base'],False,0,d['pricingCases']['Prior'],None)]
checks += [('Engine '+yr,inputs['Base'],True,int(yr),v['rows'],v['paymentRows']) for yr,v in d['engineCases'].items()]
for name,q,proposed,engine,actual_rows,payment_rows in checks:
 hh=providers=reserve=cum=peak=engine_cum=0
 for i in range(7):
  year=2027+i;live=engine>0 and year>=engine
  cardpct,cardfixed=(.0235,.12) if live else (.029,.30)
  achpct,achfixed,achcap=(.001,.25,1.5) if live else (.008,0,5)
  payoutpct,payoutfixed,activecost=(.001,.10,1) if live else (.0025,.25,2)
  build=300000 if engine and year in [engine-1,engine] else 0
  run=300000*1.03**(year-engine) if live else 0
  basic=[.6,.575,.55,.525,.5,.475,.45][i];bundle=[.3,.317,.334,.35,.367,.384,.4][i]
  cleanup=[.6,.67,.73,.8,.87,.93,1][i];tree=[.03,.04,.05,.06,.07,.075,.08][i]
  sched=[q['visits']*basic,q['visits']*bundle,q['visits']*(1-basic-bundle),cleanup,tree]
  town=q['town'][i]
  av=tach=stripeach=fee=0
  for base,vol in zip([60,85,120,300,1000],sched):
   for ni,mul_n in enumerate([1,1.15,1.30]):
    for li,mul_l in enumerate([1,1.35,1.80]):
     price=base*1.03**i*mul_n*mul_l*q['price'];weight=vol/sum(sched)*town[40+ni*3+li]
     av+=weight*price;tach+=weight*min(price*achpct+achfixed,achcap)
     stripeach+=weight*min(price*.008,5)
     fee+=weight*(max(2.99,price*.01) if proposed else 2.99)
  retained=hh*q['ret'][i];end=retained+q['new'][i]
  jobs=(retained+q['new'][i]/2)*sum(sched)*q['capture']*q['complete'];gmv=jobs*av
  pend=town[16];pret=town[17];pnew=town[18];pavg=town[19]
  finders=(q['new'][i]-min(q['new'][i],pnew))*45;revenue=finders+jobs*fee
  banklinks=q['new'][i]*q['ach'][i]+retained*max(0,q['ach'][i]-(q['ach'][i-1] if i else 0))
  card=jobs*(1-q['ach'][i])*(av*cardpct+cardfixed);ach=jobs*q['ach'][i]*tach
  recovery=(card+ach) if proposed else 0;proceeds=gmv-revenue-recovery
  count=pavg*8*4.33*payoutfixed;active=pavg*8*activecost;loss=gmv*.002
  payout=proceeds*payoutpct
  cost=card+ach-recovery+payout+count+active+banklinks*1.5+jobs*.45+loss
  gp=revenue-cost;ebitda=gp-q['new'][i]*q['cac'][i]-pnew*75-q['fte'][i]*(100000+5000*i)-q['fixed'][i]-town[23]-build-run
  dep=sum(q['capex'][max(0,i-2):i+1])/3;ebit=ebitda-dep;net=ebit-max(0,ebit)*.25
  nreserve=gmv*.01;fcf=net+dep-q['capex'][i]-(nreserve-reserve);cum+=fcf
  peak=max(peak,-cum)
  repeat=fee-((card+ach-recovery+count+active+jobs*.45+loss)/jobs)-(av-fee-recovery/jobs)*payoutpct
  tests={7:q['new'][i],18:pend,19:pnew,20:pavg,43:town[20],47:town[24],50:town[25],57:town[26],91:town[23],10:end,13:jobs,14:gmv,15:av,24:finders,25:jobs*fee,26:revenue,27:proceeds,28:recovery,29:card,30:ach,31:payout,32:count,33:active,39:cost,40:gp,46:build+run,51:ebitda,53:ebit,55:net,60:fcf,61:cum,62:peak,64:1475000+cum,68:repeat}
  for r,v in tests.items():
   actual=actual_rows[str(r)][i]
   assert math.isclose(v,actual,rel_tol=1e-11,abs_tol=1e-6),(name,r,i,v,actual)
  if name in inputs:
   calc_fee=(fee-repeat+fee*payoutpct)/(1+payoutpct)
   assert abs(calc_fee-d['captures'][name]['unit']['breakEvenFees'][i])<1e-8
   need=max(0,fee-ebitda/(jobs*(1+payoutpct))); actual_need=d['captures'][name]['unit']['companyBreakEvenFees'][i]
   if need>(gmv-recovery-finders)/jobs:assert actual_need=='Not feasible'
   else:assert abs(need-actual_need)<1e-8
  if payment_rows:
   stripeproc=jobs*((1-q['ach'][i])*(av*.029+.30)+q['ach'][i]*stripeach)
   stripeproceeds=gmv-revenue-stripeproc
   stripecost=stripeproceeds*.0025+pavg*8*(4.33*.25+2)
   retained=stripecost-payout-count-active
   impact=retained-build-run;engine_cum+=impact
   for r,v in {30:build,31:run,33:card+ach,34:recovery,35:0,36:payout+count+active,37:banklinks*1.5,38:card+ach+payout+count+active+banklinks*1.5,40:stripeproc,41:stripeproceeds,42:stripecost,43:stripeproc-card-ach,44:retained,45:impact,46:engine_cum}.items():
    assert math.isclose(v,payment_rows[str(r)][i],rel_tol=1e-11,abs_tol=1e-6),(name,r,i,v,payment_rows[str(r)][i])
  hh,providers,reserve=end,pend,nreserve
print('Independent forecasts reconciled: 3 growth cases, prior pricing, and both engine launch years; 14-town cohorts and 45 transaction combinations, fee floors, ACH caps, recovery, cash and build savings verified.')
