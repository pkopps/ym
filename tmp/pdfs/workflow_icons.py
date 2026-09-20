"""Print-sharp YardMatch workflow illustrations, drawn as native PDF vectors."""
from reportlab.lib.colors import HexColor

def draw_workflow_icon(c, kind, x, y, size, page_height):
    c.saveState()
    c.translate(x,page_height-y)
    c.scale(size/64,-size/64)
    ink=HexColor('#205938'); sage=HexColor('#a7c3a5'); white=HexColor('#ffffff')
    c.setStrokeColor(ink);c.setFillColor(white)
    c.setLineWidth(2.2);c.setLineJoin(1);c.setLineCap(1)
    def shape(points,fill=None,close=True):
        p=c.beginPath();p.moveTo(*points[0])
        for a,b in points[1:]:p.lineTo(a,b)
        if close:p.close()
        if fill is not None:c.setFillColor(fill)
        c.drawPath(p,stroke=1,fill=int(fill is not None))
    def circle(x,y,r,fill=white):
        c.setFillColor(fill);c.circle(x,y,r,stroke=1,fill=1)
    def box(x,y,w,h,fill=white):
        c.setFillColor(fill);c.rect(x,y,w,h,stroke=1,fill=1)
    if kind=='home':
        shape([(13,29),(32,12),(51,29)],close=False)
        shape([(18,27),(18,51),(46,51),(46,27)],white)
        shape([(10,30),(32,10),(54,30)],close=False)
        box(28,36,9,15,sage);box(21,29,6,6)
        shape([(9,55),(55,55)],close=False)
        shape([(12,54),(10,49),(16,54),(19,49)],close=False)
        shape([(46,54),(49,49),(51,54),(55,50)],close=False)
    elif kind=='truck':
        # Open pickup bed with rake, shovel and mower equipment.
        shape([(10,34),(10,44),(53,44),(56,39),(53,28),(43,28),(38,34)],white)
        box(8,30,31,12,sage)
        shape([(40,33),(45,33),(44,28)],close=False)
        circle(18,45,5);circle(47,45,5)
        circle(18,45,1.3,ink);circle(47,45,1.3,ink)
        shape([(16,29),(16,13)],close=False)
        shape([(10,13),(22,13)],close=False)
        for a in [10,14,18,22]:shape([(a,13),(a,18)],close=False)
        shape([(28,30),(31,13)],close=False)
        shape([(27,12),(34,13),(33,18),(29,18),(27,12)],sage)
        shape([(22,29),(25,23),(34,23),(36,29)],white)
        shape([(8,53),(56,53)],close=False)
    elif kind=='crew':
        # Three workers, each with a broad-brim hat.
        for px,py in [(15,29),(49,29),(32,23)]:
            shape([(px-10,py+24),(px-9,py+16),(px-5,py+12),(px+5,py+12),(px+9,py+16),(px+10,py+24)],sage)
            circle(px,py+4,6)
            shape([(px-8,py),(px-6,py-6),(px+5,py-6),(px+8,py)],white)
            shape([(px-11,py),(px+11,py)],close=False)
        shape([(26,44),(26,52)],close=False);shape([(38,44),(38,52)],close=False)
    elif kind=='mower':
        # Push mower deck, grass catcher, upright handle and wheels.
        shape([(20,37),(34,37),(39,42),(51,43),(52,49),(14,49),(14,44)],sage)
        box(26,30,13,9)
        shape([(16,43),(11,30),(22,30),(27,41)],white)
        shape([(20,32),(12,13),(7,13)],close=False)
        shape([(24,31),(17,11),(7,11)],close=False)
        circle(20,49,5);circle(45,49,5)
        shape([(8,56),(56,56)],close=False)
        shape([(54,54),(57,48)],close=False)
    elif kind=='handshake':
        # Two sleeves and interlocking palms with folded fingers.
        shape([(5,26),(12,18),(23,28),(15,41)],sage)
        shape([(59,26),(52,18),(42,27),(49,40)],sage)
        shape([(19,28),(27,22),(35,23),(48,36),(45,41),(40,46),(36,48),(21,37),(16,35)],white)
        shape([(44,28),(37,22),(31,22),(23,29),(24,33),(28,33),(33,29),(45,40),(49,34)],white)
        shape([(28,39),(35,45)],close=False)
        shape([(33,36),(41,43)],close=False)
        shape([(37,33),(45,40)],close=False)
        # Small finger folds along the lower hand.
        shape([(19,35),(16,39),(20,43),(23,40)],white)
        shape([(23,39),(20,43),(24,46),(27,43)],white)
        shape([(27,42),(25,46),(29,49),(32,46)],white)
    c.restoreState()
