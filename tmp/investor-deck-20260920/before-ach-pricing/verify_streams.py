import json,math
from pathlib import Path
P=Path('/Users/patrickkopps/Documents/app/tmp/investor-deck-20260920/build')
d=json.loads((P/'model-data.json').read_text())
exec((P/'verify_mix.py').read_text())
checks=[]
for case,group in d['streamCases'].items():
 for mode,result in group.items(): checks.append((case,mode,d['captures'][case]['rows'],result,0))
checks.append(('Base','Subscriptions + sponsorship',d['engineCases']['2029']['rows'],d['mixedCase'],2029))
for case,mode,base,result,engine in checks:
 cumul=0;cash=0;peak=0
 for i,year in enumerate(d['years']):
  prov=base['20'][i];sub=year>=2028;ad=mode.endswith('sponsorship') and year>=2030
  pro=prov*[0,.08,.12,.18,.23,.27,.30][i] if sub else 0
  team=prov*[0,.02,.04,.06,.08,.10,.12][i] if sub else 0
  months=9*(pro+team);grosssub=9*(pro*49+team*99);subnet=grosssub*.98
  sponsors=prov*[0,0,0,.05,.075,.10,.12][i] if ad else 0
  eligible=base['7'][i]*[.15,.17,.19,.21,.23,.25,.27][i] if ad else 0
  inventory=eligible*[.10,.15,.20,.25,.30,.30,.30][i]
  budgetjobs=sponsors*8*150/15;sold=min(inventory,budgetjobs);grossads=sold*15;adsnet=grossads*.98
  invoices=months+min(sponsors*8,sold)-.5*min(months,sponsors*8,sold)
  delivery=9*(pro*6+team*14);adcost=grossads*.1;process=(grosssub+grossads)*.029+invoices*.30;billing=(grosssub+grossads)*.007
  cogs=delivery+adcost+process+billing;subbuild=60000 if year in [2027,2028] else 0
  subfixed=60000*1.35**(year-2028) if sub else 0
  adbuild=25000 if mode.endswith('sponsorship') and year in [2029,2030] else 0
  adfixed=30000*1.30**(year-2030) if ad else 0
  opex=subbuild+subfixed+adbuild+adfixed;ebitda=subnet+adsnet-cogs-opex;cumul+=ebitda
  expected={35:prov,43:pro,44:team,45:months,46:grosssub,47:grosssub*.02,48:subnet,50:sponsors,51:eligible,52:inventory,53:budgetjobs,54:sold,55:grossads,56:grossads*.02,57:adsnet,59:subnet+adsnet,60:delivery,61:adcost,62:process,63:billing,64:cogs,66:subbuild,67:subfixed,68:adbuild,69:adfixed,70:opex,72:ebitda,73:cumul,75:months,76:min(sponsors*8,sold),77:invoices,79:subfixed+adfixed,81:0,82:0,83:0}
  for r,v in expected.items():
   a=result['streamRows'][str(r)][i]
   assert math.isclose(a,v,rel_tol=1e-11,abs_tol=1e-6),(case,mode,r,i,a,v)
  totalebitda=base['51'][i]+ebitda;ebit=totalebitda-base['52'][i];tax=max(0,ebit)*.25;net=ebit-tax
  fcf=net+base['52'][i]-base['57'][i]-base['59'][i];cash+=fcf;peak=max(peak,-cash)
  op={26:base['26'][i]+subnet+adsnet,27:base['27'][i],28:base['28'][i],39:base['39'][i]+cogs,40:base['40'][i]+subnet+adsnet-cogs,51:totalebitda,53:ebit,54:tax,55:net,60:fcf,61:cash,62:peak,64:1475000+cash,65:base['65'][i]+.5*(subfixed+adfixed),66:peak+base['65'][i]+.5*(subfixed+adfixed),68:base['68'][i],87:subnet,88:adsnet,89:cogs,90:opex}
  for r,v in op.items():
   a=result['rows'][str(r)][i]
   assert math.isclose(a,v,rel_tol=1e-11,abs_tol=1e-6),(case,mode,engine,r,i,a,v)
  for r in [72,73,74,75,76]: assert abs(result['rows'][str(r)][i])<1e-7
print('Optional products verified across six town-growth cases and a combined payment-engine case; all 49 annual forecasts reconcile.')
