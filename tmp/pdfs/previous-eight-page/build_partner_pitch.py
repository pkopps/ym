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
    text('YARDMATCH  /  BARNEGAT AREA PARTNER BRIEF',44,761,8,'Bold',MUTED)
    text(f'{n:02d} / 08',528,761,8,'Body',MUTED)

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

# 1 - cover
rect(0,0,W,H,PAPER)
brand_logo(44,37,294)
text('LOCAL BUSINESS',440,46,8,'Bold',MUTED)
text('PARTNER BRIEF',440,60,8,'Bold',MUTED)
text('Barnegat, NJ + surrounding area',44,110,10,'Body',MUTED)
copy.append('# YardMatch\n\nBarnegat, NJ + surrounding area\n')
label('Your expertise. A stronger local business.',44,143)
para('Find new clients and grow your landscaping business.',44,174,524,32,39,'Display')
para('YardMatch finds new clients for you while connecting the customer, the business owner and the crew in one service experience.',44,277,485,12.3,18)
rect(44,350,524,150,DEEP,16)
label('The business in one minute',64,369,color='#c9e5cf')
para('YardMatch helps homeowners book lawn and property care with a qualified local business. It recommends a provider based on the job, location, availability and service fit, then connects booking, crew coordination, live arrival tracking, payment and follow-up.',64,394,481,11.7,17.5,color=WHITE)
label('Built around the way you grow',44,533)
for i,(title,body) in enumerate([
 ('Win local work','Make it easier for nearby homeowners to find and book your business.'),
 ('Keep customers','Turn a good first visit into recurring mowing and seasonal follow-up.'),
 ('Know the arrival','Live GPS arrival tracking helps keep you and the customer informed while the crew is on the way.')]):
    x=44+i*179
    rect(x,562,7,7,GOLD,2)
    para(title,x,584,162,13,17,'Bold')
    para(body,x,614,157,10.5,15,maxh=81)
text('PARTNER PRESENTATION  /  SEPTEMBER 2026',44,714,8.5,'Bold',MUTED)
copy.append('Partner concept. Written as a finished-service presentation; illustrative scenarios are not results or guarantees.\n')
footer(1);c.showPage()

# 2 - three apps
page(2,'The three apps','Three apps. One connected job.','Each person sees the tools needed for their part of the work. A shared website also supports customers and business operations.')
apps=[
 ('01','CUSTOMER','The homeowner or property manager',
  'Choose the service, property and timing; review a quote and the recommended business. Book a one-time visit or recurring mowing, track arrival with live GPS, pay, review completed work and get help.',
  'Easier booking. More reasons to return.'),
 ('02','SERVICE PROVIDER','You, the landscaping business owner',
  'Set services, coverage and availability. Manage bookings and calendars, review crew matches, approve assignments and choose a route leader. Check arrival progress, customers, service evidence, fees and payouts.',
  'One place to manage the business side.'),
 ('03','CREW MEMBER','The people doing the field work',
  'Share skills, availability and travel preferences. View approved assignments, meeting points and property notes. Coordinate with the business, report delays, check in and document the work.',
  'Clear assignments and fewer loose ends.')]
for i,(num,role,who,body,outcome) in enumerate(apps):
    y=205+i*155
    rect(44,y,524,141,WHITE,12)
    brand_logo(59,y+16,43,icon=True)
    label(role,117,y+16)
    para(who,117,y+35,426,12.2,17,'Bold')
    para(body,117,y+60,426,10.5,14.6,maxh=59)
    para(outcome,117,y+121,426,9.2,12,'Bold',GREEN)
rect(44,684,524,46,SAND,8)
para('The customer books your business. Crew members work under your business; customer billing and provider payouts stay with the owner.',58,694,496,10,14)
c.showPage()

# 3 - devices and download concept
page(3,'On every screen','At your desk. In your pocket.','Three role-specific apps for mobile and iPad, plus desktop access through the YardMatch website.')
asset_dir=OUT/'assets'
c.drawImage(str(asset_dir/'yardmatch-device-branded.png'),62,H-484,488,488*2/3,mask='auto')
para('Concept illustration of the customer, provider and crew experiences.',62,489,488,8.3,11,color=MUTED)
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

# 4 - live GPS feature spotlight
page(4,'Live GPS arrival tracking','See the route. Know the arrival.','Give customers a clear arrival view and your business a practical way to follow active jobs.')
for title,body,y in [
    ('Keep customers informed','Customers can open their booking to see the shared route location, estimated arrival and distance remaining. It helps them plan for the visit without another check-in call.',207),
    ('See active-job progress','Open a job to check its arrival status, route progress and latest location update. See the journey toward the property while coordinating the day.',340),
    ('Coordinate the next step','Starting the route sends an on-my-way update. If a delay or access issue changes the plan, keep the update attached to that same booking.',468)
]:
    para(title,44,y,238,13.5,18,'Bold')
    para(body,44,y+29,234,11,16,maxh=98)
c.drawImage(str(OUT/'assets'/'yardmatch-live-gps-concept.png'),300,H-606,268,402,mask='auto')
para('Illustrative tracking screen. Map, time and distance shown are sample data.',308,614,254,8.2,11,color=MUTED)
rect(44,658,524,72,DEEP,10)
para('<b>Clear about what is live.</b> GPS sharing needs location permission, a connection and the sharing app open during the active route. Estimated or paused updates are labeled; arrival times are estimates.',60,672,491,10.4,15.2,color=WHITE)
c.showPage()

# 5 - scenario
page(5,'From request to repeat visit','What a real job feels like','Illustrative example: a Barnegat homeowner wants recurring mowing and your company has room on a nearby route.')
steps=[
 ('The homeowner asks for lawn care.','They enter the property, desired timing and service. YardMatch gathers the details needed for a quote and a suitable time window.'),
 ('YardMatch recommends your business.','Your service area, available capacity, service fit and quality signals support the match. The customer sees the recommendation and confirms; a few qualified backups are available if needed.'),
 ('You organize the work.','Review the booking and property notes, coordinate the schedule, approve crew assignments and name a route leader. Everyone works from the same job details.'),
 ('Track the arrival, then complete the visit.','Once the route starts, shared GPS location powers the arrival view. Customers can check the map and estimated arrival while the crew heads over, then the team records arrival and completion evidence.'),
 ('The job closes and the relationship continues.','The customer sees the service record and can review the business. You see the settlement and payout status. Recurring service or a rebooking keeps the relationship moving.')]
y=204
for i,(title,body) in enumerate(steps):
    rect(44,y+2,29,29,DEEP,14)
    text(str(i+1),54,y+7,12,'Bold',WHITE)
    para(title,88,y,478,12.5,17,'Bold')
    h=para(body,88,y+25,471,10.8,15.2)
    y+=max(92,h+42)
rect(44,680,524,49,SAND,8)
para('<b>When the day changes:</b> weather delays, access issues and quality concerns stay attached to the booking so the customer, business and support team can coordinate.',58,690,496,10,14)
c.showPage()

# 4 - growth
page(6,'Why this helps your business','Grow around the routes you have.','The goal is profitable repeat work and reliable service. More inquiries alone do not solve a crowded schedule or a thin margin.')
block('A shorter path to a booked job','Customers start with what they need. YardMatch recommends a qualified business, reducing the effort between searching for help and confirming a visit.',44,207)
block('A stronger repeat-service loop','Recurring mowing, rebooking prompts and seasonal reminders create opportunities to serve the same customer again. A proven prior provider can be preferred when still eligible and available.',324,207)
block('A tighter service area','Set a realistic radius and available time. Start with nearby work that fits existing routes, then expand only where travel time and staffing still make sense.',44,371)
block('A clearer staffing picture','Crew profiles and availability help you find and organize field help. You review matches and assignments; workers do not need to own a landscaping company to contribute.',324,371)
rect(44,552,524,117,DEEP,12)
label('You keep running your business',61,568,color='#c9e5cf')
para('You manage the company profile, offered services, service radius, availability and crew assignments. Your business remains responsible for equipment, supervision, insurance, service quality and crew compensation.',61,593,489,11.1,16.4,color=WHITE)
para('Recommendation order is based on fit and reliability; paid placement does not buy a better match. Repeat bookings still depend on customer choice, availability and good service.',44,691,524,9.4,13,color=MUTED)
c.showPage()

# 5 - economics
page(7,'The business model','Know what each job leaves you.','YardMatch earns provider-funded fees on completed work. The same fees support the marketplace, booking tools and service coordination.')
rect(44,192,253,93,WHITE,10);rect(313,192,255,93,WHITE,10)
para('$30 once',60,207,222,23,29,'Display')
para('After the first completed job for each customer / provider pairing.',60,247,218,10.5,14)
para('$6.99 per job',329,207,222,23,29,'Display')
para('On every completed job, including the first visit.',329,247,217,10.5,14)
para('YardMatch absorbs payment-processing cost under this model. Fees are deducted from provider proceeds, and your business pays its crew.',44,305,520,11,16)
label('Illustration: one customer, ten $60 visits',44,368)
# Financial comparison table
rows=[('Customer service charges','$60.00','$540.00','$600.00'),('One-time finder fee','-$30.00','$0.00','-$30.00'),('Completed-job fees','-$6.99','-$62.91','-$69.90'),('Provider proceeds','$23.01','$477.09','$500.10')]
xs=[57,293,380,478]
rect(44,394,524,34,DEEP,6)
for s,x in zip(['','First visit','Next 9 visits','10-visit total'],xs): text(s,x,405,9,'Bold',WHITE)
copy.append('| Item | First visit | Next 9 visits | 10-visit total |\n| --- | ---: | ---: | ---: |')
for i,row in enumerate(rows):
    y=428+i*34
    rect(44,y,524,34,('#e0ebdf' if i==3 else WHITE if i%2==0 else SAND))
    for j,(s,x) in enumerate(zip(row,xs)): text(s,x,y+10,10 if j==0 else 10.4,'Bold' if i==3 else 'Body')
    copy.append('| '+' | '.join(row)+' |')
para('Illustrative math, not a service quote or earnings forecast. Assumes ten completed, fully paid visits with the same business, no refunds or adjustments, and the fee model above. Provider proceeds are before labor, fuel, equipment, insurance, taxes and other business costs.',44,577,521,9.5,13.5,color=MUTED)
rect(44,649,524,81,SAND,10)
para('<b>The owner takeaway:</b> the first visit carries an acquisition cost. Repeat visits spread that cost across the relationship. Judge each route by what remains after your actual costs; a payout is not profit.',59,663,493,10.6,15.5)
c.showPage()

# 6 - pilot / FAQ
page(8,'A practical next step','Start with a small local route.','Suggested partnership approach: use YardMatch to add a manageable pocket of business around the work you already do.')
label('Start narrow',44,190)
para('Begin with recurring mowing and seasonal cleanup in Barnegat. Add nearby areas you already serve only when staffing and travel time support them. Other services depend on your capabilities, credentials and local coverage.',44,212,522,11,16)
label('A focused 30-day trial',44,297)
for i,(a,b) in enumerate([
 ('Set up the business','Complete the profile, verification and payout setup. Choose service boundaries and a realistic amount of open capacity.'),
 ('Run the first visits','Coordinate crew assignments, document the work and review customer feedback and any scheduling issues.'),
 ('Decide whether to expand','Compare repeat bookings, proceeds after job costs, drive time, admin time and reliability before adding capacity.')]):
    y=322+i*71
    text('0'+str(i+1),44,y,17,'Display',GREEN)
    para(a,81,y,483,11.5,16,'Bold')
    para(b,81,y+22,482,10.1,14,maxh=43)
line(44,542,568,542)
block('Trust starts before the visit.','Your business profile, service scope, insurance and required credentials support provider verification. Clear property notes and crew assignments help set expectations.',44,560,244)
block('Accountability after the work.','Job notes, service photos and customer reviews stay tied to the visit. Support reviews issues against that record; refund or dispute reviews can hold payouts.',324,560,244)
rect(44,678,524,53,DEEP,10)
para('Let\'s pick one route, agree on the numbers and see whether YardMatch can bring you repeat work worth keeping.',60,690,491,12,17,'Bold',WHITE)
c.showPage();c.save()
(OUT/'YardMatch-Barnegat-Partner-Pitch.md').write_text('\n'.join(copy)+'\n\n---\nEditorial basis: YardMatch README.md, ROADMAP.md, packages/help-center/src/index.ts, packages/domain/src/index.ts (economics policy 2026-07-provider-funded-v1), and shared brand tokens. Prepared September 2026 from project materials. This brief adopts the requested finished-service scenario; it does not certify actual launch readiness.\n',encoding='utf-8')
print(OUT/'YardMatch-Barnegat-Partner-Pitch.pdf')
