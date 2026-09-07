"""Fetch official clipped GIS; never invent named street centreline coordinates.

python -m venv .venv; .venv/bin/pip install -r scripts/gis/requirements.txt
.venv/bin/python scripts/gis/build_world.py --cache /tmp/chung-yee-data

Road width / pavement-elevation interpolation remains a labelled approximation
until detailed iB1000 kerbs and road spot heights can be retrieved and validated.
"""
import argparse, json, hashlib, urllib.request, urllib.parse
from pathlib import Path
from datetime import datetime, timezone
import numpy as np
from scipy.spatial import cKDTree
from pyproj import Transformer
from shapely.geometry import LineString, Polygon, box

ROOT=Path(__file__).resolve().parents[2]
ORIGIN=(836720.,819145.)
AOI=(836300.,818850.,837040.,819720.)
BASE='https://portal.csdi.gov.hk/server/rest/services/common/'
SOURCES={'roads':'td_rcd_1638949160594_2844/MapServer/10', 'buildings':'landsd_rcd_1637211194312_35158/FeatureServer/0', 'outdoor':'landsd_rcd_1637222018065_52265/FeatureServer/0', 'speeds':'td_rcd_1638949160594_2844/MapServer/2','intersections':'td_rcd_1638949160594_2844/MapServer/12'}

def main():
 p=argparse.ArgumentParser();p.add_argument('--cache',default='data/raw');p.add_argument('--refresh',action='store_true');args=p.parse_args();cache=Path(args.cache);cache.mkdir(parents=True,exist_ok=True)
 raw={};manifest=[]
 for name,path in SOURCES.items():
  q={'f':'json','where':'1=1','geometry':','.join(map(str,AOI)),'geometryType':'esriGeometryEnvelope','inSR':2326,'outSR':2326,'outFields':'*','returnGeometry':'true','returnZ':'true'}
  if name=='roads':q['where']="STREET_ENAME IN ('CHUNG YEE STREET','HAU MAN STREET','CHUNG HAU STREET','FAT KWONG STREET','CARMEL VILLAGE STREET')"
  url=BASE+path+'/query?'+urllib.parse.urlencode(q);f=cache/(name+'.json')
  if args.refresh or not f.exists():
   d=json.load(urllib.request.urlopen(url,timeout=45))
   if 'error' in d or d.get('exceededTransferLimit'):raise RuntimeError(f'Incomplete query: {name}')
   f.write_text(json.dumps(d))
  raw[name]=json.loads(f.read_text());manifest.append({'name':name,'url':url,'sha256':hashlib.sha256(f.read_bytes()).hexdigest(),'retrieved':datetime.fromtimestamp(f.stat().st_mtime,timezone.utc).isoformat(),'crs':'EPSG:2326','records':len(raw[name]['features'])})
 # Outdoor pavement points are a proxy, not surveyed carriageway heights.
 pts=[]
 for f in raw['outdoor']['features']:
  a=f['attributes']
  if a.get('Location')!=1 or a.get('FeatureType')!=1 or not a.get('StreetNameEN'):continue
  for line in f['geometry'].get('paths',[]):
   for v in line:
    if len(v)>=3 and 0<v[2]<110:pts.append(v[:3])
 if not pts:raise RuntimeError('No elevation source; refusing to fabricate elevations')
 pts=np.unique(np.array(pts),axis=0);tree=cKDTree(pts[:,:2])
 def height(e,n):
  d,i=tree.query([e,n],k=min(6,len(pts)));w=1/np.maximum(d,1)**2
  return round(float(np.sum(w*pts[i,2])/sum(w)),3)
 def local(v):return[round(v[0]-ORIGIN[0],3),height(*v[:2]),round(ORIGIN[1]-v[1],3)]
 roads=[];clip=box(*AOI)
 for f in raw['roads']['features']:
  a=f['attributes']
  for path in f['geometry']['paths']:
   line=LineString(path).intersection(clip)
   if line.is_empty or line.geom_type!='LineString' or line.length<2:continue
   # Densify to avoid long linear grade interpolation across bends.
   count=max(2,int(line.length/3)+1);dense=[line.interpolate(float(t)).coords[0] for t in np.linspace(0,line.length,count)]
   points=[local(v) for v in dense]
   # Smooth pavement proxy heights to avoid abrupt local building/bridge changes.
   hs=np.array([v[1] for v in points]);kernel=np.ones(9)/9;hs=np.convolve(np.pad(hs,(4,4),mode='edge'),kernel,mode='valid')
   for v,h in zip(points,hs):v[1]=round(float(h),3)
   speeds=[sf['attributes']['SPEED_LIMIT'] for sf in raw['speeds']['features'] if sf['attributes'].get('ROAD_ROUTE_ID')==a['ROUTE_ID']]
   speed=int(speeds[0].split()[0]) if speeds else 50
   roads.append({'id':a['OBJECTID'],'name':a['STREET_ENAME'],'tc':a['STREET_CNAME'],'direction':a['TRAVEL_DIRECTION'],'points':points,'width':7.2 if a['STREET_ENAME']!='FAT KWONG STREET' else 10.5,'widthSource':'simulator estimate; iB1000 download returned 502','speedLimit':speed,'speedSource':'TD route join' if speeds else 'default urban limit; verify signs'})
 buildings=[]
 for f in raw['buildings']['features']:
  a=f['attributes'];rings=f['geometry'].get('rings',[])
  if not rings or a.get('BaseHeight') is None or a.get('TopHeight') is None:continue
  h=a['TopHeight']-a['BaseHeight']
  if h<1:continue
  buildings.append({'rings':[[[round(e-ORIGIN[0],2),round(ORIGIN[1]-n,2)] for e,n,*_ in ring] for ring in rings],'base':a['BaseHeight'],'height':h,'name':a.get('BuildingNameEN') or ''})
 lon,lat=Transformer.from_crs(2326,4326,always_xy=True).transform(*ORIGIN)
 data={'origin':ORIGIN,'originWGS84':[lon,lat],'roads':roads,'surfaces':[],'markings':[],'buildings':buildings,'heights':[[round(e-ORIGIN[0],2),round(h,2),round(ORIGIN[1]-n,2)] for e,n,h in pts], 'metadata':{'crs':'EPSG:2326','heightDatum':'HKPD; pavement proxy, unvalidated for driving','aoi':AOI,'centreline':'TD Road Network 2026-08-31','roadWidths':'estimated','scenery':'LandsD Building footprints/heights; procedural facades; optional 3D Visualisation Map','notOfficialRoute':True,'sources':manifest}}
 (ROOT/'data/metadata').mkdir(parents=True,exist_ok=True);(ROOT/'public/data').mkdir(parents=True,exist_ok=True);(ROOT/'public/data/world.json').write_text(json.dumps(data,separators=(',',':'),ensure_ascii=False));(ROOT/'data/metadata/sources.json').write_text(json.dumps(manifest,indent=2))
 print(f'{len(roads)} road segments; {len(buildings)} real buildings; {len(pts)} pavement height points')
if __name__=='__main__':main()
