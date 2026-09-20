"""Illustrative annual economics as ten new customers are added each year."""
from reportlab.graphics.shapes import Drawing, String, Line, Rect, Polygon
from reportlab.graphics.charts.lineplots import LinePlot
from reportlab.graphics.widgets.markers import makeMarker
from reportlab.lib.colors import HexColor
from decimal import Decimal


def customer_lifetime_chart():
    data=[]
    for year in (1,2,3):
        customers=10*year;visits=customers*10
        revenue=Decimal(visits)*60
        costs=Decimal(10*45)
        data.append(dict(year=year,customers=customers,visits=visits,revenue=revenue,costs=costs,after_fees=revenue-costs))
    assert [r['after_fees'] for r in data]==[Decimal('5550'),Decimal('11550'),Decimal('17550')]
    d=Drawing(524,225)
    green=HexColor('#205938');muted=HexColor('#66756a');cost_color=HexColor('#9b6746');shade=HexColor('#dcebd6')
    d.add(Line(16,208,37,208,strokeColor=green,strokeWidth=2.6))
    d.add(String(43,205,'Revenue',fontName='Bold',fontSize=9,fillColor=green))
    d.add(Line(121,208,142,208,strokeColor=cost_color,strokeWidth=2,strokeDashArray=[4,3]))
    d.add(String(148,205,'YardMatch fees',fontName='Bold',fontSize=9,fillColor=cost_color))
    d.add(Rect(247,202,15,12,fillColor=shade,strokeColor=None))
    d.add(String(270,205,'Shaded gap = revenue after fees',fontName='Bold',fontSize=9,fillColor=green))
    chart=LinePlot();chart.x=58;chart.y=58;chart.width=408;chart.height=125
    chart.data=[[(r['year'],float(r[key])) for r in data] for key in ['revenue','costs']]
    chart.xValueAxis.valueMin=.82;chart.xValueAxis.valueMax=3.18;chart.xValueAxis.valueSteps=[1,2,3]
    chart.xValueAxis.labelTextFormat=lambda v:'Year '+str(int(v))
    chart.xValueAxis.labels.fontName='Bold';chart.xValueAxis.labels.fontSize=9;chart.xValueAxis.labels.fillColor=green
    chart.xValueAxis.strokeColor=HexColor('#c4d0bf');chart.xValueAxis.tickDown=0
    chart.yValueAxis.valueMin=0;chart.yValueAxis.valueMax=20000;chart.yValueAxis.valueSteps=[0,5000,10000,15000,20000]
    chart.yValueAxis.labelTextFormat=lambda v:'$'+format(int(v),',')
    chart.yValueAxis.labels.fontName='Body';chart.yValueAxis.labels.fontSize=8;chart.yValueAxis.labels.fillColor=muted
    chart.yValueAxis.visibleAxis=False;chart.yValueAxis.visibleTicks=False;chart.yValueAxis.visibleGrid=True
    chart.yValueAxis.gridStrokeColor=HexColor('#e0e7da');chart.yValueAxis.gridStrokeWidth=.6
    def point(year,value):return (58+(year-.82)/2.36*408,58+float(value)/20000*125)
    coords=[]
    for r in data:coords.extend(point(r['year'],r['revenue']))
    for r in reversed(data):coords.extend(point(r['year'],r['costs']))
    d.add(Polygon(coords,fillColor=shade,strokeColor=None))
    for i,col in enumerate([green,cost_color]):
        chart.lines[i].strokeColor=col;chart.lines[i].strokeWidth=2.6 if i==0 else 2
        m=makeMarker('FilledCircle');m.size=5;m.fillColor=col;m.strokeColor=col;chart.lines[i].symbol=m
    chart.lines[1].strokeDashArray=[4,3]
    d.add(chart)
    for r in data:
        xx,yy=point(r['year'],r['revenue'])
        d.add(String(xx,yy+8,f"${r['revenue']:,.0f}",textAnchor='middle',fontName='Bold',fontSize=9,fillColor=green))
        xx,yy=point(r['year'],r['costs'])
        d.add(String(xx,yy+7,f"${r['costs']:,.0f}",textAnchor='middle',fontName='Body',fontSize=8,fillColor=cost_color))
        d.add(String(xx,28,f"{r['customers']} customers | {r['visits']} visits",textAnchor='middle',fontName='Body',fontSize=8,fillColor=muted))
        d.add(String(xx,10,f"After fees: ${r['after_fees']:,.0f}",textAnchor='middle',fontName='Bold',fontSize=9,fillColor=green))
    return d,data
