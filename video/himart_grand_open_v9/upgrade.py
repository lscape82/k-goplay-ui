from pathlib import Path
p=Path(__file__).with_name('render.py')
s=p.read_text(encoding='utf-8')
a=s.index('fixed=Image.new')
b=s.index('BG=Image.alpha_composite(BG,fixed)',a)
s=s[:a]+'''fixed=Image.new('RGBA',BG.size)
original=Image.open(ROOT/'assets/high_resolution_reference.png').convert('RGB')
def original_type(box,width,x,y):
    tile=original.crop(box)
    rgb=np.asarray(tile).astype(np.float32)
    alpha=np.clip((rgb[:,:,1]-28)/48,0,1)
    tile=tile.convert('RGBA'); tile.putalpha(Image.fromarray(np.uint8(alpha*255)))
    tile=tile.resize((width,round(width*tile.height/tile.width)),Image.Resampling.LANCZOS)
    fixed.alpha_composite(tile,(round(x-width/2),round(y-tile.height/2)))
# Native high-resolution glyphs retain the original gold texture and serif forms.
original_type((460,42,884,93),420,571,90)
original_type((403,115,851,176),448,540,162)
original_type((156,186,1101,374),862,540,283)
original_type((248,379,1000,555),710,540,447)
original_type((507,560,749,609),206,540,562)
original_type((408,614,849,648),386,540,607)
d=ImageDraw.Draw(fixed)
for x1,y,x2 in [(164,162,296),(784,162,916),(174,562,402),(678,562,906)]:
    d.line((x1,y,x2,y),fill=(249,219,151,255),width=2)
# Extract the logo silhouette at native resolution; fill only enclosed white regions.
logo=original.crop((361,22,447,108))
arr=np.asarray(logo)
sil=Image.fromarray(np.uint8((arr[:,:,0]>170)&(arr[:,:,1]<95)&(arr[:,:,2]<110))*255)
for x in range(sil.width):
    for y in (0,sil.height-1):
        if sil.getpixel((x,y))==0: ImageDraw.floodfill(sil,(x,y),128)
for y in range(sil.height):
    for x in (0,sil.width-1):
        if sil.getpixel((x,y))==0: ImageDraw.floodfill(sil,(x,y),128)
logo=logo.convert('RGBA'); logo.putalpha(Image.fromarray(np.uint8(np.asarray(sil)!=128)*255))
fixed.alpha_composite(logo.resize((66,66),Image.Resampling.LANCZOS),(296,56))
# Original event panel, excluding only its exterior background.
schedule=original.crop((194,660,1060,863)).convert('RGBA')
mask=Image.new('L',schedule.size,0)
ImageDraw.Draw(mask).rounded_rectangle((2,2,863,200),radius=26,fill=255)
schedule.putalpha(mask)
schedule=schedule.resize((914,round(914*203/866)),Image.Resampling.LANCZOS)
fixed.alpha_composite(schedule,(83,1184))
'''+s[b:]
s=s.replace("'-crf','18'","'-crf','14'")
p.write_text(s,encoding='utf-8')
