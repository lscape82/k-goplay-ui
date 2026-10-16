from PIL import Image,ImageFont,ImageDraw
from pathlib import Path
import numpy as np
root=Path(__file__).parent/'new_sample'
a=np.array(Image.open(root/'detail.png').crop((580,200,1340,400)))
m=Image.fromarray(np.uint8((a[:,:,1]>200)&(a[:,:,2]>200))*255);m=m.crop(m.getbbox()).resize((700,160))
target=np.array(m)>128
res=[]
for p in Path('C:/Windows/Fonts').glob('*'):
 if p.suffix.lower() not in ('.ttf','.otf','.ttc'):continue
 try:
  if not any(v.lower() in p.name.lower() for v in ['NotoSansKR','malgun','KoPub','HANDotum','Seoul','서울','H2','HMK','Cafe24']):continue
  weights=[600,650,700,750,800,850,900] if 'NotoSansKR' in p.name else [None]
  for weight in weights:
   f=ImageFont.truetype(str(p),160)
   if weight:f.set_variation_by_axes([weight])
   for tracking in [-12,-8,-4,0]:
    im=Image.new('L',(1200,250));d=ImageDraw.Draw(im);x=10
    for c in '가격만큼은':d.text((x,0),c,font=f,fill=255);x+=f.getlength(c)+tracking
    im=im.crop(im.getbbox()).resize((700,160));b=np.array(im)>128
    score=(target&b).sum()/(target|b).sum();res.append((score,p.name,weight,tracking,im))
 except Exception:pass
res.sort(key=lambda r:-r[0]);print([(round(r[0],4),*r[1:4]) for r in res[:12]])
sheet=Image.new('RGB',(740,220*6),(45,45,45));d=ImageDraw.Draw(sheet)
for i,r in enumerate(res[:5]):sheet.paste(r[4],(20,(i+1)*220));d.text((20,(i+1)*220+165),str(r[:4]),fill='white')
sheet.paste(m,(20,0));sheet.save(root/'font_comparison.jpg')
