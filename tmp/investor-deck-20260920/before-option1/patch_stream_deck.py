from pathlib import Path
P=Path('/Users/patrickkopps/Documents/app/tmp/investor-deck-20260920/build')
p=P/'deck.mjs';s=p.read_text()
s=s.replace("The model does not assume subscriptions, advertising or repeated finder fees from the same relationship.","Core forecasts use finder and service fees. Optional provider subscriptions and sponsorship appear as separate expansion cases.")
s=s.replace('It assumes no subscription, advertising, recruiting revenue or additional finder fees from those projects.','Core forecasts exclude optional provider products. Those expansion cases do not add extra finder fees for the same relationship.')
s=s.replace("'The forecast makes the assumptions visible'","'The core forecast makes the assumptions visible'")
s=s.replace("'2027-2033 calendar years. No historical operating results are implied.'","'2027-2033 calendar years. Optional subscriptions and sponsorship are excluded from these core cases.'")
s=s.replace("'Base revenue reaches ${m(B.rows[26][6],1)} in 2033'","'Core base revenue reaches ${m(B.rows[26][6],1)} in 2033'")
s=s.replace("'The revised base turns profitable in 2032'","'The core base turns profitable in 2032'")
idx=s.index('// 13\n')
s=s[:idx]+'''// Optional business subscriptions
{
const s=slide('Provider subscriptions add a software business','Proposed monthly prices for optional features. Transaction fees still apply.',sources.model+' Revenue streams sheet. Proposed products, not shipped features or validated demand. Market reference checked September 20, 2026: https://www.getjobber.com/pricing/ lists Core at $49/month, no commitment, one user, and Connect at $139/month, no commitment, one user. These are feature/billing references, not direct product equivalence.');
table(s,[['Plan','Provider price','Reason to pay'],['Core marketplace','$0 subscription','Booking, job details, crew assignments and essential communication'],['Pro','$49 / month','Job margin reports, quote follow-ups and advanced business reporting'],['Teams, including Pro','$99 / month','Timesheet approvals / exports, labor budgets and crew utilization']],{y:246,h:318,widths:[304,247,601],font:25});
foot(s,'Pro and Teams are mutually exclusive. Core service delivery remains accessible. The optional model allows nine paid months per year and makes no assumed retention or customer-acquisition improvement.');
}
// Crew monetization
{
const s=slide('Crew tools have a business buyer','Recommendation: the landscaping company pays for advanced team operations. Individual crew members pay $0.',sources.model+' Provider-owned crew engagement and compensation follow ROADMAP.md. Proposed optional Teams features must add value beyond essential tools already included in the core service. Worker-paid job access, wage deductions and mandatory paid credentials are excluded from the model.');
block(s,'Value for the business owner','Connect approved time to labor budgets. Compare crew utilization and job margin. Export records to existing payroll software.',66,252,536);
block(s,'Access for the crew member','View assignments, communicate about the job and submit essential service records through the core product.',674,252,536);
text(s,'A $99 Teams plan includes the $49 Pro features',66,493,1140,51,32,C.green,true);
text(s,'Later options include employer-funded recruiting or optional training partnerships. Neither contributes revenue to this forecast.',66,550,1140,67,25);
foot(s,'Basic coordination supports completion and retention. Charging workers to access required job tools would add adoption friction without a clear benefit.');
}
// Sponsored option proposal
{
const s=slide('Sponsored visibility can be a controlled pilot','Proposed fee: $15 extra after a new relationship completes a paid first job of $150 or more.',sources.model+' Primary source: https://www.zocdoc.com/provider-help/en/articles/8709753-how-much-does-sponsored-results-cost . Zocdoc charges sponsored fees above booking fees using bid-based advertising. YardMatch proposal differs: completed-first-job fee, no repeat-pair charge, one disclosed option within qualified backups. ROADMAP.md currently keeps sponsorship dormant and main recommendations quality-first. This is a commercial experiment, not an approved ranking change.');
table(s,[['Pilot rule','Customer and provider effect'],['One labeled sponsored option','More visibility within a small set of qualified backups'],['Service fit, capacity and quality gates','Payment cannot qualify an unsuitable provider'],['Quality-first main recommendation','Sponsorship does not buy the main recommendation'],['$150 monthly provider budget cap','Pay only for an attributed, completed new relationship']],{y:246,h:321,widths:[444,708],font:24});
foot(s,'Fee is additional to the $45 finder fee and recurring charges. No repeat-pair fee. Existing customers and canceled jobs are excluded. Measure incremental business with a holdout before wider rollout.');
}
// Optional revenue economics
{
const S=data.streamCases.Base['Subscriptions'],A=data.streamCases.Base['Subscriptions + sponsorship'];
const s=slide('Optional products add value after they reach scale','Illustrative 2033 results using the same base household and provider volumes. Stripe remains in place.',sources.model+' Pro-only adoption 30%, Teams adoption 12%, nine paid months, using 5,415.075 partial-year weighted providers. Subscription net revenue after 2% credits/noncollection. Sponsorship: 12% provider participation, 27% first-job eligibility, 30% sponsored selection, capped by budget. No incremental households or GMV assumed. Subscription launch 2028, $120k build, annual fixed costs start $60k grow 35%; sponsorship launch 2030, $50k build, annual costs start $30k grow 30%. Variable delivery, card processing and 0.7% Billing fees also included.');
table(s,[['2033 result','Core only','+ Subscriptions','+ Sponsorship'],['Optional annual net revenue','$0',m(S.streamRows[59][6]),m(A.streamRows[59][6])],['Total net revenue',m(B.rows[26][6]),m(S.rows[26][6]),m(A.rows[26][6])],['EBITDA',m(B.rows[51][6]),m(S.rows[51][6]),m(A.rows[51][6])],['Net income proxy',m(B.rows[55][6]),m(S.rows[55][6]),m(A.rows[55][6])],['First positive EBITDA year',firstProfit(B),firstProfit(S),firstProfit(A)]],{y:246,h:328,widths:[447,235,235,235],font:23,highlights:[3,4]});
foot(s,`Final column includes both subscriptions and sponsorship. Together they add ${whole(A.streamRows[72][6])} of 2033 EBITDA after incremental costs. Early spending still increases cash needs. Adoption is unvalidated.`);
}
''' +s[idx:]
s=s.replace("'What can increase the value of the company'","'What can increase the value of the company'")
old="['Census QuickFacts: Barnegat','https://www.census.gov/quickfacts/fact/table/barnegattownshipoceancountynewjersey/SBO010223']"
new=old+",['Jobber: software pricing','https://www.getjobber.com/pricing/'],['Zocdoc: Sponsored Results cost','https://www.zocdoc.com/provider-help/en/articles/8709753-how-much-does-sponsored-results-cost'],['Stripe Billing pricing','https://stripe.com/billing/pricing']"
assert old in s;s=s.replace(old,new)
s=s.replace("const x=i<5?66:672,y=457+(i%5)*29;const sh=text(s,label,x,y,541,28,20,C.green)","const x=i<6?66:672,y=457+(i%6)*27;const sh=text(s,label,x,y,541,26,19,C.green)")
s=s.replace('v6.pptx','v7.pptx').replace('validation-v6.json','validation-v7.json')
p.write_text(s)
p=P/'qa_pdf.py';s=p.read_text();s=s.replace("exec((TMP/'verify_mix.py').read_text())","exec((TMP/'verify_streams.py').read_text())")
s=s.replace('range(1,28)','range(1,32)').replace('range(0,27,8)','range(0,31,8)').replace('min(8,27-start)','min(8,31-start)').replace('if i==27:','if i==31:').replace('len(reader.pages)==27','len(reader.pages)==31').replace("'pdf_pages':27","'pdf_pages':31")
s=s.replace("'https://www.census.gov/quickfacts/fact/table/barnegattownshipoceancountynewjersey/SBO010223']","'https://www.census.gov/quickfacts/fact/table/barnegattownshipoceancountynewjersey/SBO010223','https://www.getjobber.com/pricing/','https://www.zocdoc.com/provider-help/en/articles/8709753-how-much-does-sponsored-results-cost','https://stripe.com/billing/pricing']")
s=s.replace('x=66 if j<5 else 672;y=457+(j%5)*29','x=66 if j<6 else 672;y=457+(j%6)*27').replace('720-y-28','720-y-26').replace("len(reader.pages[-1].get('/Annots',[]))==9","len(reader.pages[-1].get('/Annots',[]))==12").replace("'pdf_source_links':9","'pdf_source_links':12")
p.write_text(s)
print('Added 4 optional-revenue slides and linked supporting sources.')
