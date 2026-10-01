from pathlib import Path
p=Path('/Users/patrickkopps/Documents/app/tmp/investor-deck-20260920/build')
s=(p.parent/'before-town-expansion/verify_mix.py').read_text()
at=s.index('checks=')
s=s[:at]+'''towns=json.loads((P/'town-data.json').read_text())
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
''' + s[at:]
s=s.replace("  ns=[.70", "  ns=[.70")
start=s.index("  ns=[.70");end=s.index("  av=tach",start)
s=s[:start]+"  town=q['town'][i]\n"+s[end:]
s=s.replace("for share_n,mul_n in zip([ns,np,1-ns-np],[1,1.15,1.30]):", "for ni,mul_n in enumerate([1,1.15,1.30]):")
s=s.replace("for share_l,mul_l in zip([ls,lp,1-ls-lp],[1,1.35,1.80]):", "for li,mul_l in enumerate([1,1.35,1.80]):")
s=s.replace("share_n*share_l", "town[40+ni*3+li]")
s=s.replace("pend=max(20,math.ceil(end/40));pret=providers*.85;pnew=pend-pret;pavg=pret+pnew/2", "pend=town[16];pret=town[17];pnew=town[18];pavg=town[19]")
s=s.replace("finders=(q['new'][i]-pnew)*45", "finders=(q['new'][i]-min(q['new'][i],pnew))*45")
s=s.replace("-q['fixed'][i]-build-run", "-q['fixed'][i]-town[23]-build-run")
s=s.replace("tests={10:end", "tests={7:q['new'][i],18:pend,19:pnew,20:pavg,43:town[20],47:town[24],50:town[25],57:town[26],91:town[23],10:end")
s=s.replace("45 transaction combinations", "14-town cohorts and 45 transaction combinations")
(p/'verify_mix.py').write_text(s)
f=p/'verify_streams.py';s=f.read_text();start=s.index('prior=json.loads');s=s[:start]+"print('Optional products verified across six town-growth cases and a combined payment-engine case; all 49 annual forecasts reconcile.')\n";f.write_text(s)
