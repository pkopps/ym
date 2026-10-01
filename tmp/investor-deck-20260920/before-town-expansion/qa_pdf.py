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
exec((TMP/'verify_streams.py').read_text())
with zipfile.ZipFile(ROOT/'outputs/investor-deck-20260920/YardMatch-Investor-Model.xlsx') as z:
    bad=[]
    for p in z.namelist():
        if p.startswith('xl/worksheets/') and p.endswith('.xml'):
            xml=ET.fromstring(z.read(p))
            for cell in xml.iter('{http://schemas.openxmlformats.org/spreadsheetml/2006/main}c'):
                if cell.get('t')=='e':bad.append((p,cell.get('r')))
    assert not bad,bad

slides=[TMP/'slides'/f'slide-{i}.png' for i in range(1,32)]
assert all(p.exists() for p in slides)
# Review montage only. Individual full-size slides are reviewed separately.
thumbs=[]
for i,p in enumerate(slides,1):
    im=Image.open(p).convert('RGB');im.thumbnail((512,288))
    panel=Image.new('RGB',(532,324),'#e7e7e7');panel.paste(im,((532-im.width)//2,10))
    ImageDraw.Draw(panel).text((12,302),f'{i:02d}',fill='#14281d')
    thumbs.append(panel)
for start in range(0,31,8):
    count=min(8,31-start);sheet=Image.new('RGB',(1064,324*math.ceil(count/2)),'white')
    for j,im in enumerate(thumbs[start:start+count]):sheet.paste(im,((j%2)*532,(j//2)*324))
    sheet.save(TMP/f'montage-{start+1}.png')

out=ROOT/'output/pdf/YardMatch-Investor-Deck.pdf'
c=canvas.Canvas(str(out),pagesize=(960,540))
c.setTitle('YardMatch Investor Deck - September 2026')
c.setAuthor('YardMatch')
c.setSubject('Investor discussion draft with illustrative 2027-2033 financial forecasts')
urls=['https://stripe.com/pricing','https://stripe.com/connect/pricing','https://stripe.com/financial-connections','https://www.zocdoc.com/provider-help/en/articles/10859404-understanding-zocdoc-pricing-and-billing','https://www.zocdoc.com/about/understanding-your-bill/','https://usa.visa.com/support/small-business/regulations-fees.html','https://www.frbservices.org/resources/fees/ach-2026','https://www.pcisecuritystandards.org/standards/pci-dss/','https://www.census.gov/quickfacts/fact/table/barnegattownshipoceancountynewjersey/SBO010223','https://www.getjobber.com/pricing/','https://www.zocdoc.com/provider-help/en/articles/8709753-how-much-does-sponsored-results-cost','https://stripe.com/billing/pricing']
for i,p in enumerate(slides,1):
    c.drawImage(ImageReader(str(p)),0,0,960,540)
    c.bookmarkPage(f'slide{i}');c.addOutlineEntry(f'Slide {i}',f'slide{i}',0,False)
    if i==31:
        for j,url in enumerate(urls):
            x=66 if j<6 else 672;y=457+(j%6)*27
            c.linkURL(url,(x*.75,(720-y-26)*.75,(x+541)*.75,(720-y)*.75),relative=0,thickness=0)
    c.showPage()
c.save()
reader=PdfReader(out)
assert len(reader.pages)==31
assert len(reader.pages[-1].get('/Annots',[]))==12
(TMP/'qa-results.json').write_text(json.dumps({'independent_all_scenario_forecasts_reconciled':True,'saved_xlsx_formula_errors':0,'pdf_pages':31,'pdf_source_links':12},indent=2))
print(json.dumps({'independent_all_scenario_forecasts_reconciled':True,'pdf':str(out),'pages':len(reader.pages)}))
