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
from workflow_icons import draw_workflow_icon
from lifetime_value_chart import customer_lifetime_chart
from reportlab.graphics import renderSVG

ROOT=Path('/Users/patrickkopps/Documents/app')
OUT=ROOT/'output/pdf'
for name,file in [('Body','Arial.ttf'),('Bold','Arial Bold.ttf'),('Italic','Arial Italic.ttf'),('Display','Georgia.ttf')]:
    pdfmetrics.registerFont(TTFont(name,'/System/Library/Fonts/Supplemental/'+file))
pdfmetrics.registerFontFamily('Body',normal='Body',bold='Bold',italic='Italic',boldItalic='Bold')
INK='#14281d'; GREEN='#2f7d4c'; DEEP='#205938'; PAPER='#f7f5ef'; SAND='#f0eadc'; GOLD='#72976c'; MUTED='#66756a'; WHITE='#ffffff'; LINE='#d9dfd5'
W,H=612,792
c=canvas.Canvas(str(OUT/'YardMatch-Barnegat-Partner-Pitch.pdf'),pagesize=(W,H))
c.setTitle('YardMatch | A growth partner for your landscaping business')
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
    source=OUT/'assets'/'yardmatch-mower-logo.png'
    # Layout crops only: preserve the selected logo pixels without recreating the mark.
    sx,sy,sw,sh=(156,157,625,346) if icon else (156,157,1848,346)
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

def header(kicker):
    rect(0,0,W,59,'#edf1e8')
    brand_logo(44,18,130)
    heading=kicker.upper()
    heading_width=pdfmetrics.stringWidth(heading,'Bold',8)
    text(heading,568-heading_width,27,8,'Bold',DEEP)
    line(44,59,568,59,'#c4d0bf',0.8)

def footer(n):
    line(44,749,568,749)
    source=OUT/'assets'/'yardmatch-ym-mower-logo.png'
    # Clip source whitespace in PDF layout; keep original artwork unchanged.
    sx,sy,sw,sh=215,250,824,769
    iw,ih=Image.open(source).size
    x,y,w=44,755,28
    scale=w/sw; h=sh*scale
    c.saveState()
    c.setBlendMode('Darken')
    clip=c.beginPath();clip.rect(x,H-y-h,w,h)
    c.clipPath(clip,stroke=0,fill=0)
    c.drawImage(str(source),x-sx*scale,H-y-(ih-sy)*scale,iw*scale,ih*scale,mask='auto')
    c.restoreState()
    text('BARNEGAT AREA PARTNER BRIEF',84,764,8,'Bold',MUTED)
    text(f'{n:02d} / 09',528,764,8,'Body',MUTED)

def page(n,kicker,title,subtitle=None,title_size=29,title_leading=35):
    rect(0,0,W,H,PAPER);header(kicker)
    copy.append('\n## '+title+'\n')
    h=para(title,44,76,525,title_size,title_leading,'Display',record=False)
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


# 1 - cover
rect(0,0,W,H,PAPER)
header('Local business partner brief')
brand_logo(44,78,294)
text('Barnegat, NJ + surrounding area',44,144,10,'Body',MUTED)
copy.append('# YardMatch\n\nBarnegat, NJ + surrounding area\n')
text('LET NEW CUSTOMERS FIND YOU',44,174,11,'Bold',GREEN)
para('Acquire new clients and grow your landscaping business.',44,202,524,32,39,'Display')
para('YardMatch finds new clients for you while connecting the customer, the landscape business owner, and the hires you need to meet the demand, all in one service experience.',44,295,485,12.3,18)
rect(44,373,524,140,DEEP,16)
label('How YardMatch works',64,392,color='#c9e5cf')
para('YardMatch helps homeowners book lawn and property care with a qualified local business. It recommends a provider based on the job, location, property size, availability and service fit, then connects the pieces of the puzzle: booking, crew coordination, live arrival tracking, payment and CRM.',64,417,481,11.7,17.5,color=WHITE)
label('Built around the way you already operate',44,533)
for i,(title,body) in enumerate([
 ('Attain more work','Free advertising to make it easier for new homeowners to find and book your business.'),
 ('Keep customers','Turn a good first visit into a recurring customer for seasons and years thereafter.'),
 ('Stay connected','Per job with real-time GPS tracking and notifications, as well as long term for the duration of your business relationship.')]):
    x=44+i*179
    rect(x,562,7,7,GOLD,2)
    para(title,x,584,162,13,17,'Bold')
    para(body,x,614,157,10.5,15,maxh=81)
text('PARTNER PRESENTATION  /  SEPTEMBER 2026',44,714,8.5,'Bold',MUTED)
copy.append('Partner concept. Written as a finished-service presentation; illustrative scenarios are not results or guarantees.\n')
footer(1);c.showPage()

# 3 - devices and download concept
page(2,'On every screen','At your desk and in your pocket.','Three role-specific apps for desktop, mobile, and tablet.')
asset_dir=OUT/'assets'
c.drawImage(str(asset_dir/'yardmatch-device-branded-mower.png'),62,H-484,488,488*2/3,mask='auto')
for i,(role,appname) in enumerate([('Customer','Customer'),('Service provider','Provider'),('Crew member','Crew')]):
    x=44+179*i
    para(role,x,520,166,11,15,'Bold')
    payload=f'YardMatch {appname}: download placeholder'
    qr=QrCodeWidget(payload,barLevel='M',barBorder=4)
    x0,y0,x1,y1=qr.getBounds(); side=78
    drawing=Drawing(side,side,transform=[side/(x1-x0),0,0,side/(y1-y0),0,0])
    drawing.add(qr)
    renderPDF.draw(drawing,c,x+42,H-540-side)
    para('QR placeholder',x+35,620,120,8.5,12,color=MUTED)
    copy.append('QR payload: '+payload+'\n')
# Official badges use their original proportions. Google asset includes clear space.
a=Image.open(asset_dir/'app-store-badge.png'); aw=32*a.width/a.height
c.drawImage(str(asset_dir/'app-store-badge.png'),181,H-684,aw,32,mask='auto')
g=Image.open(asset_dir/'google-play-badge.png'); box=g.getbbox()
visible_h=box[3]-box[1]; visible_w=box[2]-box[0]; scale=32/visible_h
# Retain all supplied transparent padding and align the visible black badges.
c.drawImage(str(asset_dir/'google-play-badge.png'),aw+201-box[0]*scale,H-652-(g.height-box[1])*scale,g.width*scale,g.height*scale,mask='auto')
para('Download preview: QR codes and store badges are placeholders; no live app-store listings are linked. Desktop users access YardMatch in a web browser.',44,700,524,9,12.5,color=MUTED)
copy.append('Store artwork: Download on the App Store / Get it on Google Play. Download placeholders only.\n')
c.showPage()

page(3,'Customer app','Book with confidence<br/>and follow your crew\'s arrival.','Find local lawn care, get a recommended business and see when the crew is on the way.')
phone('yardmatch-live-gps-concept-mower.png')
for title,body,y in [
    ('A simpler way to book','Add your address, choose your service, and pick a time window. YardMatch recommends a qualified local business, all in a few clicks.',205),
    ('Live GPS arrival tracking','Know when your service provider is on the way, nearby or running late, and stay updated on work in progress and completed service.',337),
    ('Need help after a visit?','If something is not right, open the booking to report a service issue and share details or photos. Keep follow-up with the business and support team connected to the job.',468)
]:
    para(title,44,y,239,13.2,18,'Bold')
    para(body,44,y+28,234,11,16,maxh=94)
para('Live GPS requires location permission, a connection and the sharing app open. Estimated or paused updates are labeled; arrival times are estimates.',44,593,236,9.1,12.5,color=MUTED)
downloads('Customer');c.showPage()

page(4,'Service provider app','Take on new clients where and when<br/>it makes sense.','Keep bookings, available time and crew assignments together in a clear calendar and schedule.',title_size=24,title_leading=28)
im=Image.open(OUT/'assets'/'yardmatch-provider-calendar-mower.png');ih=480*im.height/im.width
c.drawImage(str(OUT/'assets'/'yardmatch-provider-calendar-mower.png'),66,H-215-ih,480,ih,mask='auto')
para('Illustrative provider calendar. The cleanup job also appears on the crew page.',44,499,524,8.3,11,color=MUTED)
for i,(title,body) in enumerate([
    ('Plan the week','Review scheduled visits and available time. Set your service area and capacity around the work your business can reliably handle.'),
    ('Assign the work','Review crew matches, approve assignments and name a route lead. Share the property notes and work needed for each visit.'),
    ('Keep jobs moving','Check arrival progress, communicate changes and review completion evidence. Follow customer history, fees and payout status.')
]):
    x=44+179*i
    para(title,x,531,166,12.3,17,'Bold')
    para(body,x,557,157,10.2,14.2,maxh=73)
para('<b>Provider fees:</b> $45 once after the first completed job per customer/business pairing. No recurring per-job fee. YardMatch absorbs processing cost; your business pays its crew.',44,629,524,8.6,11.5,color=MUTED)
downloads('Provider');c.showPage()

page(5,'Crew member app','Your next job and the<br/>details you need for it.','Know when to report, where to meet and what work is assigned before you head out.')
phone('yardmatch-crew-assignment-mower.png')
rect(44,206,235,130,DEEP,12)
label('Example assignment',59,220,color='#c9e5cf')
para('25 minutes to report.<br/>5 miles away.',59,247,209,20,26,'Display',WHITE)
para('Oak Lane property | Barnegat, NJ',59,311,207,9,12,color=WHITE)
para('Get to the right place on time',44,365,238,13.2,18,'Bold')
para('It is 9:35 AM. Report by 10:00 AM at the driveway entrance and check in with your route lead. Open directions from the assignment.',44,393,234,11,16,maxh=84)
para('Know the work before arrival',44,478,240,13,18,'Bold')
para('<b>Your tasks: leaf blowing and raking.</b> Review the job notes, coordinate with the business and report delays or access issues through the assigned job.',44,506,234,11,16,maxh=84)
para('Crew members work under the provider business. The business handles supervision, equipment and compensation.',44,602,236,9.1,12.5,color=MUTED)
downloads('Crew');c.showPage()
# 5 - scenario
page(6,'From request to repeat visit','How booking works.','Illustrative example: a Barnegat homeowner needs someone to mow their lawn this summer.')
steps=[
 ('The homeowner asks for lawn care.','They enter the property, desired timing and service. YardMatch gathers the details needed for a quote and a suitable time window.'),
 ('YardMatch recommends your business.','Your service area, available capacity, service fit and quality signals support the match. The customer sees the recommendation and confirms; a few qualified backups are available if needed.'),
 ('You organize the work.','Review the booking and property notes, coordinate the schedule, approve crew assignments and name a route leader. Everyone works from the same job details.'),
 ('Track the arrival, then complete the visit.','Once the route starts, shared GPS location powers the arrival view. Customers can check the map and estimated arrival while the crew heads over, then the team records arrival and completion evidence.'),
 ('The job closes and the relationship continues.','The customer sees the service record and can review the business. You see the settlement and payout status. Recurring service or a rebooking keeps the relationship moving.')]
y=204
for i,(title,body) in enumerate(steps):
    rect(44,y+1,59,62,'#e5eddf',10)
    draw_workflow_icon(c,['home','mower','crew','truck','handshake'][i],47,y+5,53,H)
    rect(91,y-5,18,18,DEEP,9)
    text(str(i+1),97,y-2,9,'Bold',WHITE)
    para(title,121,y,445,12.5,17,'Bold')
    h=para(body,121,y+25,437,10.8,15.2)
    y+=max(92,h+42)
rect(44,680,524,49,SAND,8)
para('<b>When the day changes:</b> weather delays, access issues and quality concerns stay attached to the booking so the customer, business and support team can coordinate.',58,690,496,10,14)
c.showPage()

# 7 - growth and client map
page(7,'Why this helps your business','Expand in the territories you\'re already working in.','See your clients across the area, spot nearby demand and build repeat work around the routes your crew already travels.',title_size=22,title_leading=32)
im=Image.open(OUT/'assets'/'yardmatch-client-map-v2.png');ih=524*im.height/im.width
c.drawImage(str(OUT/'assets'/'yardmatch-client-map-v2.png'),44,H-169-ih,524,ih,mask='auto')
para('Illustrative client map with sample properties, an existing route and a nearby new request.',44,471,524,8.3,11,color=MUTED)
for title,body,x,y in [
    ('Simple booking flow','Customers describe their needs. YardMatch recommends a qualified business based on fit, then the customer confirms.',44,497),
    ('A stronger repeat-service loop','Recurring service, rebooking and seasonal reminders help turn a first visit into an ongoing customer relationship.',324,497),
    ('A denser service area','See your clients together on the map. Take on nearby work when travel time, schedule and staffing make sense. Save on gas.',44,567),
    ('A clearer staffing picture','Review crew profiles, availability and matches. Find new hires and organize field help as demand grows.',324,567)
]:
    para(title,x,y,244,11.5,16,'Bold')
    para(body,x,y+23,244,9.8,13.5,maxh=41)
rect(44,642,524,59,DEEP,10)
label('You keep running your business, your way',59,653,color='#c9e5cf')
para('You control services, service area, availability and crew assignments. Your business handles equipment, supervision, insurance, service quality and crew pay.',59,669,493,9.6,13,color=WHITE)
para('Recommendations depend on fit and reliability, not paid placement. Repeat bookings depend on customer choice, availability and good service.',44,711,524,8.2,10,color=MUTED)
c.showPage()

# 5 - economics
page(8,'The business model','Optimized for client lifetime value.','One new customer. One $45 finder fee. Keep booking repeat visits through YardMatch with no recurring per-job fee.')
rect(44,180,253,92,WHITE,10);rect(313,180,255,92,WHITE,10)
para('$45 <u>once</u>',60,195,222,23,29,'Display')
para('After the first completed job for each customer / provider pairing.',60,235,218,10.5,14)
para('$0 recurring fees',329,195,222,23,29,'Display')
para('No recurring per-job fee. Keep the relationship growing, season after season.',329,235,217,10.5,14)
para('The finder fee is deducted from provider proceeds after the first completed job. YardMatch absorbs payment-processing cost; your business pays its crew.',44,284,520,11,16)
label('Illustration: add 10 customers each year. Keep them coming back.',44,333)
para('Add 10 new customers each year and retain earlier customers. At 10 visits per customer per year and $60 per visit, repeat business adds up.',44,352,524,10,14,color=MUTED)
rect(44,395,524,225,WHITE,10)
chart,economics=customer_lifetime_chart()
renderPDF.draw(chart,c,44,H-620)
renderSVG.drawToFile(chart,str(OUT/'assets'/'yardmatch-three-season-value.svg'))
copy.append('Illustrative annual economics: '+str(economics)+'\n')
para('Annual figures assume 100% retention. YardMatch fees are $450 per year: $45 once for each of 10 new customers. Shading shows revenue after finder fees, before business expenses and taxes. Standard fees before the welcome offer; no refunds. Actual results vary.',44,627,524,9.2,12.5,color=MUTED)
rect(44,674,524,56,SAND,10)
para('<b>$45 once. Years of potential value.</b> One customer retained for all three years generates $1,800 in this example; the finder fee is just <b>2.5%</b>. Across all 30 customers: <b>$36,000 in revenue and only $1,350 in finder fees.</b>',59,684,493,10.6,14.5)
c.showPage()

# 9 - new-provider first-client offer
page(9,'New service provider offer','Your first new client is on us!','Join YardMatch and grow your landscaping business with the first finder\'s fee covered.')
rect(44,181,524,157,DEEP,14)
# Coupon-style perforation, kept inside the offer card.
c.saveState()
c.setStrokeColor(HexColor('#d5ead6'))
c.setLineWidth(1.6)
c.setLineCap(1)
c.setDash(1,4.5)
c.roundRect(54,H-328,504,137,9,fill=0,stroke=1)
c.restoreState()
label('A welcome offer for new providers',70,207,color='#c9e5cf')
text('$45',70,248,27,'Display','#c9e5cf')
line(69,271,118,256,WHITE,2)
text('$0',140,224,56,'Display',WHITE)
text('finder\'s fee.',233,247,26,'Display',WHITE)
copy.append('~~$45~~ $0 finder fee.\n')
para('Covered by YardMatch.',70,294,470,18,24,'Bold',WHITE)
para('Complete your first job with your first new client through YardMatch, and we cover the one-time $45 finder\'s fee.',44,357,524,12,17.5)
para('This is a one-time welcome offer for new sign ups. Later new clients have a $45 one-time finder fee. <b>No recurring per-job fee.</b>',44,400,524,10.2,14.5,color=MUTED)
label('Get started today',44,448)
for i,(title,body) in enumerate([
    ('Set up your profile','Complete your profile, verification and payout setup. Choose your services and the nearby areas you can reliably cover.'),
    ('Set your availability and capacity','Add available time to your calendar and get your crew ready for the first visit.'),
    ('Take on your first YM client','Deliver the work, document the visit and build a relationship that can turn into repeat business.'),
    ('Hire new crew members if you need them','Meet your new demand by finding new crew hires through YardMatch. Review profiles and availability to find the right fit for your business.')
]):
    y=471+i*52
    text('0'+str(i+1),44,y,16,'Display',GREEN)
    para(title,81,y,482,11.5,16,'Bold')
    para(body,81,y+21,478,10,14,maxh=29)
rect(44,695,524,35,DEEP,10)
para('Bring your expertise. We\'ll bring you new customers.',60,704,491,12,17,'Bold',WHITE)
c.showPage();c.save()
(OUT/'YardMatch-Barnegat-Partner-Pitch.md').write_text('\n'.join(copy)+'\n\n---\nEditorial basis: YardMatch README.md, ROADMAP.md, packages/help-center/src/index.ts, packages/domain/src/index.ts (economics policy 2026-07-provider-funded-v1), and shared brand tokens. Pricing in this pitch reflects Patrick\'s updated $45 one-time finder fee with no recurring per-job fee, plus a one-time new-provider offer covering the first new-client finder fee; the application policy has not been changed by this document edit. Prepared September 2026 from project materials. This brief adopts the requested finished-service scenario; it does not certify actual launch readiness.\n',encoding='utf-8')
print(OUT/'YardMatch-Barnegat-Partner-Pitch.pdf')
