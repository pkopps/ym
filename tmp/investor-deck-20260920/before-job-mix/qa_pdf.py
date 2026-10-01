from pathlib import Path
import json, math, zipfile, re
from xml.etree import ElementTree as ET
from reportlab.pdfgen import canvas
from reportlab.lib.utils import ImageReader
from PIL import Image, ImageOps, ImageDraw
from pypdf import PdfReader

ROOT=Path('/Users/patrickkopps/Documents/app')
TMP=ROOT/'tmp/investor-deck-20260920/build'
d=json.loads((TMP/'model-data.json').read_text())
new=[500,2500,9000,25000,55000,100000,160000]
ret=[.7,.7,.75,.78,.8,.8,.8]
ach=[.1,.2,.3,.4,.5,.55,.6]
cac=[55,50,45,40,35,30,28]
fte=[3,5,8,12,18,26,36]
pay=[100000,105000,110000,115000,120000,125000,130000]
fixed=[60000,100000,160000,250000,400000,600000,800000]
capex=[15000,25000,40000,60000,90000,130000,180000]
hh=providers=reserve=cum=0
for i in range(7):
    retained=hh*ret[i]; end=retained+new[i]
    jobs=(retained+new[i]/2)*20*.9*.95; gmv=jobs*60
    pend=max(20,math.ceil(end/40)); pret=providers*.85; pnew=pend-pret
    pavg=pret+pnew/2
    finders=(new[i]-pnew)*45
    service=jobs*2.99; revenue=finders+service
    banklinks=new[i]*ach[i]+retained*max(0,ach[i]-(ach[i-1] if i else 0))
    cost=jobs*((1-ach[i])*2.04+ach[i]*.48)+(.0025*(gmv-revenue))+pavg*8*(4.33*.25+2)+banklinks*1.5+jobs*(.35+.1)+gmv*.002
    gp=revenue-cost; ebitda=gp-new[i]*cac[i]-pnew*75-fte[i]*pay[i]-fixed[i]
    dep=sum(capex[max(0,i-2):i+1])/3; ebit=ebitda-dep
    net=ebit-max(0,ebit)*.25
    nreserve=gmv*.01; fcf=net+dep-capex[i]-(nreserve-reserve); cum+=fcf
    tests={10:end,13:jobs,14:gmv,24:finders,25:service,26:revenue,40:gp,51:ebitda,53:ebit,55:net,60:fcf,61:cum,64:1500000-25000+cum}
    for r,v in tests.items():
        assert abs(v-d['captures']['Base']['rows'][str(r)][i])<.000001,(r,i,v)
    hh,providers,reserve=end,pend,nreserve
assert abs(.7*.8*.8-.448)<1e-12
assert abs((2.99-(60*.029+.3))-.95)<1e-12
with zipfile.ZipFile(ROOT/'outputs/investor-deck-20260920/YardMatch-Investor-Model.xlsx') as z:
    bad=[]
    for p in z.namelist():
        if p.startswith('xl/worksheets/') and p.endswith('.xml'):
            xml=ET.fromstring(z.read(p))
            for cell in xml.iter('{http://schemas.openxmlformats.org/spreadsheetml/2006/main}c'):
                if cell.get('t')=='e':bad.append((p,cell.get('r')))
    assert not bad,bad

slides=[TMP/'slides'/f'slide-{i}.png' for i in range(1,23)]
assert all(p.exists() for p in slides)
# Review montage only. Individual full-size slides are reviewed separately.
thumbs=[]
for i,p in enumerate(slides,1):
    im=Image.open(p).convert('RGB');im.thumbnail((512,288))
    panel=Image.new('RGB',(532,324),'#e7e7e7');panel.paste(im,((532-im.width)//2,10))
    ImageDraw.Draw(panel).text((12,302),f'{i:02d}',fill='#14281d')
    thumbs.append(panel)
for start in range(0,22,8):
    count=min(8,22-start);sheet=Image.new('RGB',(1064,324*math.ceil(count/2)),'white')
    for j,im in enumerate(thumbs[start:start+count]):sheet.paste(im,((j%2)*532,(j//2)*324))
    sheet.save(TMP/f'montage-{start+1}.png')

out=ROOT/'output/pdf/YardMatch-Investor-Deck.pdf'
c=canvas.Canvas(str(out),pagesize=(960,540))
c.setTitle('YardMatch Investor Deck - September 2026')
c.setAuthor('YardMatch')
c.setSubject('Investor discussion draft with illustrative 2027-2033 financial forecasts')
urls=['https://stripe.com/pricing','https://stripe.com/connect/pricing','https://stripe.com/financial-connections','https://www.zocdoc.com/provider-help/en/articles/10859404-understanding-zocdoc-pricing-and-billing','https://www.census.gov/quickfacts/fact/table/barnegattownshipoceancountynewjersey/SBO010223']
for i,p in enumerate(slides,1):
    c.drawImage(ImageReader(str(p)),0,0,960,540)
    c.bookmarkPage(f'slide{i}');c.addOutlineEntry(f'Slide {i}',f'slide{i}',0,False)
    if i==22:
        for j,url in enumerate(urls):
            y=457+j*29
            c.linkURL(url,(66*.75,(720-y-28)*.75,900*.75,(720-y)*.75),relative=0,thickness=0)
    c.showPage()
c.save()
reader=PdfReader(out)
assert len(reader.pages)==22
assert len(reader.pages[-1].get('/Annots',[]))==5
(TMP/'qa-results.json').write_text(json.dumps({'independent_base_forecast_reconciled':True,'saved_xlsx_formula_errors':0,'pdf_pages':22,'pdf_source_links':5},indent=2))
print(json.dumps({'independent_base_forecast_reconciled':True,'pdf':str(out),'pages':len(reader.pages)}))
