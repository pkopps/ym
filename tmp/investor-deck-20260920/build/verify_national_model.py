import json, math
from pathlib import Path
ROOT=Path('/Users/patrickkopps/Documents/app')
d=json.loads((ROOT/'tmp/investor-deck-20260920/build/model-data.json').read_text())
years=d['years']
assert years == [2027,2028,2029,2030,2031,2032,2033]
ret={'Downside':[.55,.55,.60,.60,.65,.65,.65],'Base':[.70,.70,.75,.78,.80,.80,.80],'Upside':[.80,.80,.82,.85,.85,.85,.85]}
area_sched={'Downside':[1,4,12,35,90,200,400],'Base':[1,6,25,70,175,400,750],'Upside':[1,8,35,110,300,700,1200]}
state_end={'Downside':25,'Base':40,'Upside':48}
for name,ca in d['captures'].items():
    r=ca['rows']; n=ca['nationalRows']
    assert n['10']==area_sched[name]
    assert n['15'][-1]==state_end[name]
    for i in range(7):
        opening=0 if i==0 else n['69'][i-1]
        retained=opening*ret[name][i]
        assert math.isclose(n['67'][i],retained,abs_tol=1e-6)
        assert math.isclose(n['68'][i],n['69'][i]-retained,abs_tol=1e-6)
        assert n['72'][i]==math.ceil(n['69'][i]/40)
        assert math.isclose(n['85'][i],(n['68'][i]-n['84'][i])*(.65*75+.25*110+.10*150),abs_tol=1e-5)
        assert math.isclose(r['24'][i],n['85'][i],abs_tol=1e-6)
        assert math.isclose(r['26'][i],r['24'][i]+r['87'][i]+r['88'][i],abs_tol=1e-6)
        expected_ebitda=r['26'][i]-r['39'][i]-r['43'][i]-r['44'][i]-r['49'][i]-r['50'][i]-r['90'][i]-r['91'][i]
        assert math.isclose(r['51'][i],expected_ebitda,abs_tol=1e-5)
        for row in ['28','29','30','31','32','33','34','35','38','46','58','59']:
            assert abs(r[row][i])<1e-7
        for row in ['72','73','74','75','76']:
            assert abs(r[row][i])<1e-6
b=d['captures']['Base']
assert b['rows']['10'][-1]==380000
assert b['rows']['18'][-1]==9500
assert math.isclose(b['rows']['26'][-1],24180450.1064,abs_tol=.01)
assert math.isclose(b['rows']['51'][-1],3375119.62892,abs_tol=.01)
assert math.isclose(b['rows']['55'][-1],2375089.72169,abs_tol=.01)
assert b['rows']['51'][5] < 0 < b['rows']['51'][6]
print(json.dumps({'national_forecast_reconciled':True,'base_2033_revenue':b['rows']['26'][-1],'base_2033_ebitda':b['rows']['51'][-1],'base_2033_net_income_proxy':b['rows']['55'][-1]},indent=2))
