from pathlib import Path
p=Path(__file__).parent
f=p/'model.mjs';s=f.read_text().replace('Insurance, legal, accounting, fixed software and facilities. Includes launch/provider agreement work.','Fully remote. Insurance, legal, accounting and fixed software remain. Office rent, utilities and facilities are zero. Detail in Town inputs rows 113-117.').replace("['Town inputs','C103:J108']","['Town inputs','C103:J108'],['Town inputs','C111:J123']")
f.write_text(s)
f=p/'verify_mix.py';s=f.read_text().replace('25:60000*1.03**i','25:42000*1.03**i')
s+='\nfor i in range(7):\n saving=18000*1.03**i\n before=d["remoteBridge"]["before"];after=d["remoteBridge"]["revised"]\n assert math.isclose(before["50"][i]-after["50"][i],saving,abs_tol=1e-7)\n assert math.isclose(after["51"][i]-before["51"][i],saving,abs_tol=1e-7)\n for row in ["26","13","43","49","91"]:assert before[row][i]==after[row][i]\nprint("Remote overhead change reconciles without changing payroll, marketing, local costs or revenue.")\n'
f.write_text(s)
f=p/'deck.mjs';s=f.read_text().replace('v13.pptx','v14.pptx').replace('validation-v13.json','validation-v14.json')
s=s.replace('Same service volume, 60% ACH share, five staff and $550,000 payroll.','Same service volume, 60% ACH share and five remote staff. All columns use the revised overhead budget.')
s=s.replace("'Previous plan','Selected 4% / 2%'","'Previous pricing','Selected 4% / 2%'")
s=s.replace('Previous plan: MAX($4.49,1%) plus processing.','Previous pricing: MAX($4.49,1%) plus processing, recalculated using the same remote overhead budget as both other columns.')
s=s.replace("'The two-year base budget tests commercial adoption and leaves a reserve for the next financing decision.'","'Fully remote team. Office rent and facilities cost $0. Legal, insurance, accounting and software remain.'")
s=s.replace('A finite pilot must validate proposed pricing and unit economics before growth funding.','Remote corporate overhead starts at $42,000: insurance $12,000, legal $12,000, accounting $6,000 and software $12,000, inflated 3% annually. The previous $60,000 allowance was unsplit, so the reduction is a planning revision, not quoted rent savings. A finite pilot must validate proposed pricing and unit economics before growth funding.')
s=s.replace("block(s,'Profit and cash'","block(s,'Remote operations and cash'")
s=s.replace('Payroll includes founder pay. Fixed costs run all year. Cash also funds equipment and a modeled risk reserve.','Five staff include the founder. Office costs are $0. The $42,000 starting overhead budget covers insurance, legal, accounting and software. Cash also funds IT equipment and risk reserves.')
f.write_text(s)
