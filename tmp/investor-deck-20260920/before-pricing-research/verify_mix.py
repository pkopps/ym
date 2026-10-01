import json, math
from pathlib import Path
P=Path('/Users/patrickkopps/Documents/app/tmp/investor-deck-20260920/build')
d=json.loads((P/'model-data.json').read_text())
inputs={
'Base':dict(new=[500,2500,9000,25000,55000,100000,160000],ret=[.7,.7,.75,.78,.8,.8,.8],ach=[.1,.2,.3,.4,.5,.55,.6],cac=[55,50,45,40,35,30,28],fte=[3,5,8,12,18,26,36],fixed=[60000,100000,160000,250000,400000,600000,800000],capex=[15000,25000,40000,60000,90000,130000,180000],visits=20,capture=.9,complete=.95,price=1),
'Downside':dict(new=[300,1200,3500,8000,15000,25000,40000],ret=[.55,.55,.60,.60,.65,.65,.65],ach=[0,.05,.05,.10,.10,.15,.20],cac=[75,70,65,60,55,50,50],fte=[3,4,6,8,10,13,16],fixed=[60000,80000,120000,160000,200000,260000,340000],capex=[15000,25000,40000,60000,90000,130000,180000],visits=16,capture=.8,complete=.9,price=1.15),
'Upside':dict(new=[500,3000,12000,35000,85000,170000,280000],ret=[.8,.8,.82,.85,.85,.85,.85],ach=[.2,.35,.5,.6,.7,.75,.75],cac=[45,35,30,28,25,23,22],fte=[3,5,9,15,24,36,52],fixed=[60000,100000,180000,300000,500000,800000,1200000],capex=[15000,25000,45000,75000,120000,180000,260000],visits=24,capture=.95,complete=.97,price=1)}
for name,q in inputs.items():
 hh=providers=reserve=cum=0
 for i in range(7):
  basic=[.6,.575,.55,.525,.5,.475,.45][i];bundle=[.3,.317,.334,.35,.367,.384,.4][i]
  cleanup=[.6,.67,.73,.8,.87,.93,1][i];tree=[.03,.04,.05,.06,.07,.075,.08][i]
  sched=[q['visits']*basic,q['visits']*bundle,q['visits']*(1-basic-bundle),cleanup,tree]
  ns=[.70,.675,.65,.625,.60,.575,.55][i];np=[.25,.267,.283,.30,.317,.334,.35][i]
  ls=[.70,.683,.667,.65,.633,.617,.60][i];lp=[.25,.258,.267,.275,.283,.292,.30][i]
  av=tach=0
  for base,vol in zip([60,85,120,300,1000],sched):
   for share_n,mul_n in zip([ns,np,1-ns-np],[1,1.15,1.30]):
    for share_l,mul_l in zip([ls,lp,1-ls-lp],[1,1.35,1.80]):
     price=base*1.03**i*mul_n*mul_l*q['price'];weight=vol/sum(sched)*share_n*share_l
     av+=weight*price;tach+=weight*min(price*.008,5)
  retained=hh*q['ret'][i];end=retained+q['new'][i]
  jobs=(retained+q['new'][i]/2)*sum(sched)*q['capture']*q['complete'];gmv=jobs*av
  pend=max(20,math.ceil(end/40));pret=providers*.85;pnew=pend-pret;pavg=pret+pnew/2
  finders=(q['new'][i]-pnew)*45;revenue=finders+jobs*2.99
  banklinks=q['new'][i]*q['ach'][i]+retained*max(0,q['ach'][i]-(q['ach'][i-1] if i else 0))
  card=jobs*(1-q['ach'][i])*(av*.029+.30);ach=jobs*q['ach'][i]*tach
  count=pavg*8*4.33*.25;active=pavg*8*2;loss=gmv*.002
  cost=card+ach+.0025*(gmv-revenue)+count+active+banklinks*1.5+jobs*.45+loss
  gp=revenue-cost;ebitda=gp-q['new'][i]*q['cac'][i]-pnew*75-q['fte'][i]*(100000+5000*i)-q['fixed'][i]
  dep=sum(q['capex'][max(0,i-2):i+1])/3;ebit=ebitda-dep;net=ebit-max(0,ebit)*.25
  nreserve=gmv*.01;fcf=net+dep-q['capex'][i]-(nreserve-reserve);cum+=fcf
  repeat=2.99-((card+ach+count+active+jobs*.45+loss)/jobs)-(av-2.99)*.0025
  tests={10:end,13:jobs,14:gmv,15:av,24:finders,25:jobs*2.99,26:revenue,29:card,30:ach,40:gp,51:ebitda,53:ebit,55:net,60:fcf,61:cum,64:1475000+cum,68:repeat}
  for r,v in tests.items():
   actual=d['captures'][name]['rows'][str(r)][i]
   assert math.isclose(v,actual,rel_tol=1e-11,abs_tol=1e-6),(name,r,i,v,actual)
  calc_fee=(2.99-repeat+2.99*.0025)/(1+.0025)
  assert abs(calc_fee-d['captures'][name]['unit']['breakEvenFees'][i])<1e-8
  hh,providers,reserve=end,pend,nreserve
print('Independent forecasts reconciled: 3 cases x 7 years; per-transaction ACH caps and break-even fees verified.')
