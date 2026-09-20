from reportlab.pdfgen import canvas
from reportlab.lib.colors import HexColor, Color
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.styles import ParagraphStyle
from reportlab.platypus import Paragraph
from pathlib import Path
import re
from reportlab.graphics.barcode.qr import QrCodeWidget
from reportlab.graphics.shapes import Drawing
from reportlab.graphics import renderPDF
from PIL import Image

ROOT=Path('/Users/patrickkopps/Documents/app')
OUT=ROOT/'output/pdf'
for name,file in [('Body','Arial.ttf'),('Bold','Arial Bold.ttf'),('Italic','Arial Italic.ttf'),('Display','Georgia.ttf')]:
    pdfmetrics.registerFont(TTFont(name,'/System/Library/Fonts/Supplemental/'+file))
pdfmetrics.registerFontFamily('Body',normal='Body',bold='Bold',italic='Italic',boldItalic='Bold')
INK='#14281d'; GREEN='#2f7d4c'; DEEP='#205938'; PAPER='#f7f5ef'; SAND='#f0eadc'; GOLD='#72976c'; MUTED='#66756a'; WHITE='#ffffff'; LINE='#d9dfd5'
W,H=612,792
c=canvas.Canvas(str(OUT/'YardMatch-Barnegat-Partner-Pitch.pdf'),pagesize=(W,H))
c.setTitle('YardMatch | Customer, Provider and Crew Apps')
c.setAuthor('YardMatch')
c.setSubject('Barnegat area landscaping partner concept: customer, provider and crew apps')
copy=[]

def rect(x,y,w,h,color,r=0):
    c.setFillColor(HexColor(color))
    if r: c.roundRect(x,H-y-h,w,h,r,fill=1,stroke=0)
    else: c.rect(x,H-y-h,w,h,fill=1,stroke=0)

def line(x,y,x2,y2,col=LINE,width=1):
    c.setStrokeColor(HexColor(col));c.setLineWidth(width);c.line(x,H-y,x2,H-y2)

def text(s,x,y,size=10,font='Body',color=INK,record=False):
    c.setFillColor(HexColor(color));c.setFont(font,size);c.drawString(x,H-y-size,s)
    if record: copy.append(s+'\n')

def para(s,x,y,w,size=11,leading=None,font='Body',color=INK,record=True,maxh=None):
    st=ParagraphStyle('p',fontName=font,fontSize=size,leading=leading or size*1.42,textColor=HexColor(color))
    p=Paragraph(s,st);_,h=p.wrap(w,800)
    if maxh is not None and h>maxh: raise ValueError(f'Overflow {h}>{maxh}: {s[:70]}')
    if y+h>731: raise ValueError(f'Footer overlap: {s[:70]} at {y+h}')
    p.drawOn(c,x,H-y-h)
    if record: copy.append(re.sub('<[^>]+>','',s).replace('&amp;','&')+'\n')
    return h

def label(s,x,y,color=GREEN): text(s.upper(),x,y,9,'Bold',color)

def brand_logo(x,y,w,icon=False):
    source=OUT/'assets'/'yardmatch-logo-approved-board.png'
    # Layout crops only: preserve the selected logo pixels without recreating the mark.
    sx,sy,sw,sh=(1229,730,239,235) if icon else (103,229,1320,274)
    iw,ih=Image.open(source).size
    scale=w/sw; h=sh*scale
    c.saveState()
    c.setBlendMode('Darken')
    clip=c.beginPath()
    if icon: clip.roundRect(x,H-y-h,w,h,w*0.18)
    else: clip.rect(x,H-y-h,w,h)
    c.clipPath(clip,stroke=0,fill=0)
    c.drawImage(str(source),x-sx*scale,H-y-(ih-sy)*scale,iw*scale,ih*scale,mask='auto')
    c.restoreState()
    return h

def footer(n):
    line(44,749,568,749)
    text('YARDMATCH  /  THREE APPS. ONE CONNECTED SERVICE.',44,761,8,'Bold',MUTED)
    text(f'{n:02d} / 03',528,761,8,'Body',MUTED)

def page(n,kicker,title,subtitle=None):
    rect(0,0,W,H,PAPER);brand_logo(44,22,130);text(kicker.upper(),338,31,8,'Bold',MUTED)
    copy.append('\n## '+title+'\n')
    h=para(title,44,76,525,29,35,'Display',record=False)
    if subtitle: para(subtitle,44,88+h,514,11.2,color=MUTED)
    footer(n)

def block(title,body,x,y,w=244):
    para(title,x,y,w,14,19,'Bold')
    h=para(body,x,y+28,w,11,16)
    return y+28+h


def downloads(role):
    line(44,661,568,661)
    qr=QrCodeWidget(f'YardMatch {role}: download placeholder',barLevel='M',barBorder=4)
    x0,y0,x1,y1=qr.getBounds(); side=63
    d=Drawing(side,side,transform=[side/(x1-x0),0,0,side/(y1-y0),0,0]);d.add(qr)
    renderPDF.draw(d,c,44,H-669-side)
    label(role+' app',123,674)
    ad=OUT/'assets';im=Image.open(ad/'app-store-badge.png');aw=30*im.width/im.height
    c.drawImage(str(ad/'app-store-badge.png'),123,H-730,aw,30,mask='auto')
    g=Image.open(ad/'google-play-badge.png');b=g.getbbox();sc=30/(b[3]-b[1])
    c.drawImage(str(ad/'google-play-badge.png'),aw+140-b[0]*sc,H-700-(g.height-b[1])*sc,g.width*sc,g.height*sc,mask='auto')
    para('Mobile + iPad apps<br/>Desktop access on the web',406,679,162,9.2,13,color=MUTED)
    para('QR and store badges are download placeholders.',406,708,162,8.2,11,color=MUTED)
    copy.append(f'{role} app: QR and store badges are download placeholders. Mobile + iPad apps; desktop access on the web.\n')

def phone(asset):
    c.drawImage(str(OUT/'assets'/asset),300,H-602,268,402,mask='auto')
    para('Illustrative screen and sample data.',310,611,248,8.3,11,color=MUTED)

page(1,'01 / Customer app','Book with confidence.<br/>Follow your crew\'s arrival.','Find local lawn care, get a recommended business and see when the crew is on the way.')
phone('yardmatch-live-gps-concept.png')
for title,body,y in [
    ('A simpler way to book','Choose your service, property and timing. YardMatch recommends a qualified local business so you can review the quote and confirm your visit.',205),
    ('Live GPS arrival tracking','See the shared route location, estimated arrival, distance remaining and route progress. The last-update indicator helps you know how current the location is.',337),
    ('Less guessing. More confidence.','An on-my-way update signals the route has started. Follow the arrival from your booking, then review the completed service record or get help.',468)
]:
    para(title,44,y,239,13.2,18,'Bold')
    para(body,44,y+28,234,11,16,maxh=94)
para('Live GPS requires location permission, a connection and the sharing app open. Estimated or paused updates are labeled; arrival times are estimates.',44,593,236,9.1,12.5,color=MUTED)
downloads('Customer');c.showPage()

page(2,'02 / Service provider app','Find new clients and grow your landscaping business.','Keep bookings, available time and crew assignments together in a clear calendar and schedule.')
im=Image.open(OUT/'assets'/'yardmatch-provider-calendar.png');ih=524*im.height/im.width
c.drawImage(str(OUT/'assets'/'yardmatch-provider-calendar.png'),44,H-197-ih,524,ih,mask='auto')
para('Illustrative provider calendar. The cleanup job also appears on the crew page.',44,499,524,8.3,11,color=MUTED)
for i,(title,body) in enumerate([
    ('Plan the week','Review scheduled visits and available time. Set your service area and capacity around the work your business can reliably handle.'),
    ('Assign the work','Review crew matches, approve assignments and name a route lead. Share the property notes and work needed for each visit.'),
    ('Keep jobs moving','Check arrival progress, communicate changes and review completion evidence. Follow customer history, fees and payout status.')
]):
    x=44+179*i
    para(title,x,531,166,12.3,17,'Bold')
    para(body,x,557,157,10.2,14.2,maxh=73)
para('<b>Provider fees:</b> $45 after the first completed job per customer/business pairing, plus $3.99 per completed job. YardMatch absorbs processing cost; your business pays its crew.',44,629,524,8.6,11.5,color=MUTED)
downloads('Provider');c.showPage()

page(3,'03 / Crew member app','Your next job.<br/>The details you need.','Know when to report, where to meet and what work is assigned before you head out.')
phone('yardmatch-crew-assignment.png')
rect(44,206,235,130,DEEP,12)
label('Example assignment',59,220,color='#c9e5cf')
para('25 minutes to report.<br/>5 miles away.',59,247,209,20,26,'Display',WHITE)
para('Oak Lane property | Barnegat, NJ',59,311,207,9,12,color=WHITE)
para('Get to the right place',44,365,238,13.2,18,'Bold')
para('It is 9:35 AM. Report by 10:00 AM at the driveway entrance and check in with your route lead. Open directions from the assignment.',44,393,234,11,16,maxh=84)
para('Know the work before arrival',44,478,240,13,18,'Bold')
para('<b>Your tasks: leaf blowing and raking.</b> Review the job notes, coordinate with the business and report delays or access issues through the assigned job.',44,506,234,11,16,maxh=84)
para('Crew members work under the provider business. The business handles supervision, equipment and compensation.',44,602,236,9.1,12.5,color=MUTED)
downloads('Crew');c.showPage()
c.save()
(OUT/'YardMatch-Barnegat-Partner-Pitch.md').write_text('# YardMatch | Three apps. One connected service.\n\n'+'\n'.join(copy)+'\n\n---\nThree-page finished-service concept presentation. Screen layouts, maps, job details and example times are illustrative. Customer tracking uses the previously approved GPS screen. Provider calendar and crew assignment depict the same sample cleanup job. Provider-funded pricing updated for this pitch to a $45 one-time finder fee per customer/business pairing and $3.99 per completed job. Application pricing has not been changed by this document edit.\n',encoding='utf-8')
print(OUT/'YardMatch-Barnegat-Partner-Pitch.pdf')
