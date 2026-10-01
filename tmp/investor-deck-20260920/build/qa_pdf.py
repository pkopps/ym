from pathlib import Path
import json, math, zipfile, re
from xml.etree import ElementTree as ET
from reportlab.pdfgen import canvas
from reportlab.lib.utils import ImageReader
from PIL import Image, ImageDraw
from pypdf import PdfReader
ROOT=Path('/Users/patrickkopps/Documents/app')
TMP=ROOT/'tmp/investor-deck-20260920/build'
d=json.loads((TMP/'model-data.json').read_text())
exec((TMP/'verify_national_model.py').read_text())
with zipfile.ZipFile(ROOT/'outputs/investor-deck-20260920/YardMatch-Investor-Model.xlsx') as z:
    bad=[]
    for p in z.namelist():
        if p.startswith('xl/worksheets/') and p.endswith('.xml'):
            xml=ET.fromstring(z.read(p))
            for cell in xml.iter('{http://schemas.openxmlformats.org/spreadsheetml/2006/main}c'):
                if cell.get('t')=='e': bad.append((p,cell.get('r')))
    assert not bad,bad
with zipfile.ZipFile(ROOT/'output/presentations/YardMatch-Investor-Deck.pptx') as z:
    count=sum(bool(re.fullmatch(r'ppt/slides/slide[0-9]+.xml',n)) for n in z.namelist())
assert count==27
slides=[TMP/'slides'/f'slide-{i}.png' for i in range(1,count+1)]
assert all(p.exists() for p in slides)
out=ROOT/'output/pdf/YardMatch-Investor-Deck.pdf'
c=canvas.Canvas(str(out),pagesize=(960,540))
c.setTitle('YardMatch Investor Deck - National Plan')
c.setAuthor('YardMatch')
c.setSubject('Investor discussion draft with illustrative 2027-2033 national expansion forecast')
urls=['https://www.zocdoc.com/provider-help/en/articles/10859404-understanding-zocdoc-pricing-and-billing','https://www.zocdoc.com/about/understanding-your-bill/','https://www.zocdoc.com/provider-help/en/articles/8709753-how-much-does-sponsored-results-cost','https://www.getjobber.com/pricing/','https://stripe.com/billing/pricing','https://www.census.gov/quickfacts/fact/table/barnegattownshipoceancountynewjersey/PST045225']
for i,p in enumerate(slides,1):
    c.drawImage(ImageReader(str(p)),0,0,960,540)
    c.bookmarkPage(f'slide{i}');c.addOutlineEntry(f'Slide {i}',f'slide{i}',0,False)
    if i==25:
        for j,url in enumerate(urls):
            x=66 if j<3 else 672;y=462+(j%3)*38
            c.linkURL(url,(x*.75,(720-y-29)*.75,(x+540)*.75,(720-y)*.75),relative=0,thickness=0)
    if i in (26,27):
        batch=i-26
        for j,t in enumerate(d['towns'][batch*7:batch*7+7]):
            y=242+(j+1)*44
            c.linkURL('https://www.census.gov/quickfacts/fact/table/'+t['slug']+'/PST045225',(64*.75,(720-y-44)*.75,518*.75,(720-y)*.75),relative=0,thickness=0)
    c.showPage()
c.save()
reader=PdfReader(out)
links=sum(len(pg.get('/Annots',[])) for pg in reader.pages)
assert len(reader.pages)==27
assert links==20,links
result={'national_forecast_reconciled':True,'saved_xlsx_formula_errors':0,'pptx_slides':27,'pdf_pages':27,'pdf_source_links':20,'base_2033_revenue':d['captures']['Base']['rows']['26'][-1],'base_2033_ebitda':d['captures']['Base']['rows']['51'][-1]}
(TMP/'qa-results.json').write_text(json.dumps(result,indent=2))
print(json.dumps(result,indent=2))
