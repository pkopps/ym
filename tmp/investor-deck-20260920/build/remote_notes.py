from pathlib import Path
import json
p=Path(__file__).parent
f=p/'ach_notes.py';s=f.read_text().replace("start=s.index('## Selected option 1 results')","start=s.index('## Selected 4% card / 2% ACH results')")
s=s.replace('Previous $4.49 / 1% plan','Previous pricing, same remote costs')
s=s.replace('Five staff, including the founder, cost $550,000 fully loaded in 2033.','Five fully remote staff, including the founder, cost $550,000 fully loaded in 2033. Office costs are zero. The revised corporate overhead budget starts at $42,000 and inflates 3% annually.')
s=s.replace('The core uses 4% card / 2% ACH without a minimum, plus actual processing.','The core uses 4% card / 2% ACH without a minimum, plus actual processing. The team is fully remote with zero office costs and $42,000 starting corporate overhead, rising 3% annually.')
s=s.replace('Corporate overhead starts at $60,000 with 3% annual inflation.','Corporate overhead starts at $42,000 with 3% annual inflation.')
f.write_text(s)
exec(compile(s,str(f),'exec'))
out=Path('/Users/patrickkopps/Documents/app/output/presentations')
d=json.loads((p/'model-data.json').read_text());r=d['captures']['Base']['rows'];br=d['remoteBridge']
section='''## Fully remote operating budget

Office rent, utilities, facilities and coworking cost **$0**. The earlier model had a single $60,000 starting overhead allowance that mentioned facilities but did not assign rent a separate amount. The new $42,000 total is a revised planning budget, not a measured $18,000 rent saving.

| Corporate overhead | 2027 annual budget |
|---|---:|
| Office rent, utilities and facilities | $0 |
| Business insurance | $12,000 |
| Legal and compliance | $12,000 |
| Accounting and tax preparation | $6,000 |
| Fixed team software | $12,000 |
| Total | $42,000 |

All non-office amounts are editable estimates, not vendor quotes. Costs increase 3% annually. Town inputs D113:D117 contains the detail and D71 sums it. Local launch events, travel/coverage and employee IT equipment are separate from office facilities. These retain their existing assumptions and need their own budget review.

'''
section+=f'By 2033 corporate overhead falls from ${br["before"]["50"][6]:,.0f} to ${r["50"][6]:,.0f}. EBITDA improves by ${r["51"][6]-br["before"]["51"][6]:,.0f}, to ${r["51"][6]:,.0f}. Revenue remains ${r["26"][6]:,.0f}. All pricing comparison columns now use the same remote operating budget.\n\n'
f=out/'YardMatch-Pricing-Research.md';s=f.read_text().replace('## Provider economics',section+'## Provider economics');f.write_text(s)
f=out/'YardMatch-Expansion-Assumptions.md';s=f.read_text().replace('Corporate overhead starts at $60,000 with 3% annual inflation.','Corporate overhead starts at $42,000 with 3% annual inflation. The team is fully remote, with office rent, utilities and facilities explicitly zero.').replace('## Selected 4% card / 2% ACH results',section+'## Selected 4% card / 2% ACH results');f.write_text(s)
print({k:round(r[k][6],2) for k in ['26','50','51','55','60','66']})
