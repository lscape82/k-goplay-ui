"""Frame-locked adaptation of 제작지시서.md. No generated building/brand assets.
Run --preview, inspect PNGs, then --render. All times are seconds at 30fps.
"""
from pathlib import Path
from functools import lru_cache
import math, argparse, subprocess, json
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter, ImageChops
import imageio_ffmpeg

ROOT=Path(__file__).resolve().parent
W,H,FPS,FRAMES=1080,1920,30,600
OUTPUT=ROOT/'lotte_himart_seongseo_directed_v1_20s.mp4'
FONT='C:/Windows/Fonts/NotoSansKR-VF.ttf'
STAGE=(72,520,1008,1130)
CONFIG={
 'opening':(0,3),'moving':(3,6),'special':(6,9),
 'brands':(9,12),'price':(12,15.5),'ending':(15.5,20),
 'title_center_open':(540,806),'title_center_small':(540,320),
 'title_width':880,'title_small_scale':.45,
 'preopen':'9월 21일(월) ~ 10월 8일(목)',
 'event':'10월 9일(금) ~ 10월 11일(일)',
 'background_zoom':1.03,
}
# Each copy layer: content, center, size. Entrance keyframes are in stage().
COPY={
 'moving': [('입주',260,780,120),('혼수',540,780,120),('이사',820,780,120)],
 'moving_sub':('준비 중이시라면',540,972,62),
 'special_sub':('올해 마지막',540,657,62),
 'special':[ (ch,285+i*170,857,160) for i,ch in enumerate('특별행사') ],
 'brands':[('삼성',380,660,106),('엘지',700,660,106)],
 'popular':('인기 가전',540,843,142),'gather':('총집합',540,1010,150),
 'price':('가격만큼은',540,651,108),
 'expect':('기대하셔도',540,826,151),'good':('좋습니다',540,1010,159),
 'benefits':('가전 구입혜택은',540,634,62),
 'open_store':('오픈 행사점이',540,817,133),'best':('가장 좋습니다',540,1004,142),
}

def clamp(x):return max(0.,min(1.,x))
def bezier(x,x1,y1,x2,y2):
    x=clamp(x);lo=0.;hi=1.
    for _ in range(15):
        u=(lo+hi)/2;v=3*(1-u)**2*u*x1+3*(1-u)*u*u*x2+u**3
        if v<x:lo=u
        else:hi=u
    u=(lo+hi)/2
    return 3*(1-u)**2*u*y1+3*(1-u)*u*u*y2+u**3
def enter(x):return bezier(x,.16,1,.3,1)
def leave(x):return bezier(x,.7,0,.84,0)
def smooth(x):x=clamp(x);return x*x*(3-2*x)
def overshoot(x,start):
    x=clamp(x)
    return start+(.97-start)*enter(x/.72) if x<.72 else .97+.03*smooth((x-.72)/.28)

@lru_cache(maxsize=200)
def glyph(text,size,gold=True,tracking=0.):
    f=ImageFont.truetype(FONT,size);f.set_variation_by_axes([850 if gold else 700])
    advance=[f.getlength(ch)+size*tracking for ch in text]
    width=math.ceil(sum(advance)-size*tracking)+40
    m=Image.new('L',(width,size*2));d=ImageDraw.Draw(m);x=20
    for ch,adv in zip(text,advance):d.text((x,0),ch,font=f,fill=255);x+=adv
    b=m.getbbox();m=m.crop((0,max(0,b[1]-14),width,b[3]+14))
    if gold:
        yy=np.linspace(0,1,m.height)
        colors=np.array([[230,171,63],[255,251,210],[255,230,149],[235,184,79],[255,239,173]])
        strip=np.stack([np.interp(yy,[0,.22,.48,.66,1],colors[:,i]) for i in range(3)],axis=1)
        rgb=np.broadcast_to(strip[:,None,:],(m.height,m.width,3)).astype(np.uint8).copy()
        im=Image.fromarray(rgb).convert('RGBA')
    else:im=Image.new('RGBA',m.size,(255,252,240,255))
    im.putalpha(m);return im

def outline(im,opacity=.18):
    m=im.getchannel('A')
    edge=ImageChops.subtract(m.filter(ImageFilter.MaxFilter(5)),m.filter(ImageFilter.MinFilter(3)))
    out=Image.new('RGBA',im.size,(255,227,160,0));out.putalpha(edge.point(lambda a:round(a*opacity)))
    return out

def place(canvas,im,x,y,scale=1,alpha=1,blur=0,clip=None,wipe=1):
    im=im.copy()
    if wipe<1:
        a=np.array(im.getchannel('A'));edge=round(im.width*clamp(wipe));a[:,edge:]=0;im.putalpha(Image.fromarray(a))
    if abs(scale-1)>.0001:im=im.resize((max(1,round(im.width*scale)),max(1,round(im.height*scale))),Image.Resampling.LANCZOS)
    if blur>.05:im=im.filter(ImageFilter.GaussianBlur(blur))
    if alpha<1:im.putalpha(im.getchannel('A').point(lambda a:round(a*clamp(alpha))))
    layer=Image.new('RGBA',canvas.size);layer.alpha_composite(im,(round(x-im.width/2),round(y-im.height/2)))
    if clip:
        layer=layer.crop(clip);canvas.alpha_composite(layer,(clip[0],clip[1]))
    else:canvas.alpha_composite(layer)

def text(canvas,item,gold=True,**kw):
    content,x,y,size=item
    im=glyph(content,size,gold,kw.pop('tracking',0.))
    x+=kw.pop('dx',0);y+=kw.pop('dy',0)
    place(canvas,im,x,y,**kw)

def reveal(canvas,item,t,start,dur=.3,dy=40,scale_start=1,blur_start=0,gold=True,pop=False,dx=0):
    if t<start:return
    q=clamp((t-start)/dur);e=enter(q)
    size=item[3];y=item[2]
    scale=overshoot(q,scale_start) if pop else scale_start+(1-scale_start)*e
    text(canvas,item,gold=gold,dy=dy*(1-e),dx=dx*(1-e),scale=scale,blur=blur_start*(1-e),alpha=clamp((t-start)/.1),clip=(72,round(y-size*.68),1008,round(y+size*.68)))

SOURCE=Image.open(ROOT/'assets/high_resolution_reference.png').convert('RGB')
BG=Image.open(ROOT/'assets/background.png').convert('RGB')
assert BG.size==(W,H)
def cut_type(box):
    im=SOURCE.crop(box).convert('RGBA');rgb=np.array(im)
    a=np.clip((rgb[:,:,1].astype(float)-28)/48,0,1)
    im.putalpha(Image.fromarray(np.uint8(a*255)));return im
TITLE=cut_type((156,186,1101,555))
TITLE=TITLE.resize((880,round(TITLE.height*880/TITLE.width)),Image.Resampling.LANCZOS)
YEAR=cut_type((403,115,851,176))
NAME=cut_type((460,42,884,93))
LOGO=SOURCE.crop((361,22,447,108)).convert('RGBA')
arr=np.asarray(LOGO);m=Image.fromarray(np.uint8((arr[:,:,0]>215)&(arr[:,:,1]<95))*255)
for xx in range(m.width):
 for yy in [0,m.height-1]:
  if m.getpixel((xx,yy))==0:ImageDraw.floodfill(m,(xx,yy),128)
for yy in range(m.height):
 for xx in [0,m.width-1]:
  if m.getpixel((xx,yy))==0:ImageDraw.floodfill(m,(xx,yy),128)
LOGO.putalpha(Image.fromarray(np.uint8(np.asarray(m)!=128)*255))
LOGO=LOGO.resize((66,66),Image.Resampling.LANCZOS)
SCHEDULE=SOURCE.crop((194,660,1060,863)).convert('RGBA')
mask=Image.new('L',SCHEDULE.size);ImageDraw.Draw(mask).rounded_rectangle((2,2,863,200),26,fill=255)
SCHEDULE.putalpha(mask);SCHEDULE=SCHEDULE.resize((860,201),Image.Resampling.LANCZOS)

def panel(t):
    out=Image.new('RGBA',(W,H))
    if t<2.8:return out
    color=(51,3,8);strength=195
    if 6<=t<9:color=(119,3,15);strength=200
    if 9<=t<12:color=(28,5,10);strength=206
    if 12<=t<15.2:color=(91,6,12);strength=200
    if 15.2<=t<15.5:
        q=(t-15.2)/.3;v=math.sin(math.pi*q)
        color=tuple(round(a+(b-a)*v) for a,b in zip((80,4,12),(255,237,207)));strength=round(195+35*v)
    if t>=15.5:color=(61,4,9);strength=205
    x0,y0,x1,y1=STAGE;pw=x1-x0;ph=y1-y0
    yy,xx=np.mgrid[0:ph,0:pw]
    fx=np.clip(np.minimum(xx/85,(pw-1-xx)/85),0,1)
    fy=np.clip(np.minimum(yy/85,(ph-1-yy)/85),0,1)
    feather=(fx*fx*(3-2*fx))*(fy*fy*(3-2*fy))
    alpha=np.uint8(feather*(strength-25))
    if t<3:
        radius=enter((t-2.8)/.2)*1100
        alpha=np.uint8(alpha*((xx-pw*.85)**2+(yy-ph*.5)**2<=radius**2))
    tile=Image.new('RGBA',(pw,ph),(*color,255));tile.putalpha(Image.fromarray(alpha));out.alpha_composite(tile,(x0,y0))
    return out

def stage(t):
    c=Image.new('RGBA',(W,H))
    if 3<=t<6:
        for i,item in enumerate(COPY['moving']):reveal(c,item,t,3+i*.2,dy=70,scale_start=1.18,blur_start=10,pop=True)
        for x,at in [(400,3.3),(680,3.5)]:
            if t>=at:text(c,('·',x,780,65),alpha=clamp((t-at)/.1))
        reveal(c,COPY['moving_sub'],t,3.6,dy=36,gold=False)
        if t>=5.7:
            v=leave((t-5.7)/.3);shift=round(90*v)
            out=Image.new('RGBA',(W,H));out.alpha_composite(c,(0,-shift))
            out.putalpha(out.getchannel('A').point(lambda a:round(a*(1-v))));c=out
    elif 6<=t<9:
        reveal(c,COPY['special_sub'],t,6,.2,gold=False)
        whole=glyph('특별행사',160,True,.065)
        if t>=6.2:
            sc=1.45-.35*enter((t-6.2)/.2) if t<6.4 else 1.1+.15*enter((t-6.4)/.5)
            place(c,outline(whole,.18),540,857,scale=sc)
        for i,item in enumerate(COPY['special']):reveal(c,item,t,6.4+i*.1,.2,dy=0,scale_start=1.25,pop=True)
        if t>=8.7:
            v=leave((t-8.7)/.3)
            c=Image.new('RGBA',(W,H))
            place(c,whole,540,857,scale=1+.7*v,alpha=1-v,blur=8*v)
    elif 9<=t<12:
        for i,item in enumerate(COPY['brands']):reveal(c,item,t,9,dy=0,dx=(-160 if i==0 else 160),blur_start=10)
        if t>=9.3:text(c,('·',540,660,60),gold=False)
        reveal(c,COPY['popular'],t,9.3,dy=65,scale_start=1.15)
        reveal(c,COPY['gather'],t,9.6,.2,dy=70)
        if t>=11.7:
            v=leave((t-11.7)/.3);c=Image.new('RGBA',(W,H))
            for i,item in enumerate(COPY['brands']):text(c,item,dx=(-180 if i==0 else 180)*v,alpha=1-v)
            for key in ['popular','gather']:text(c,COPY[key],dy=-100*v,alpha=1-v)
    elif 12<=t<15.5:
        if t<15.2:
            # First the price cue fills the stage, then makes room for the larger promise.
            q=enter((t-12)/.3);reframe=enter((t-12.3)/.3)
            item=('가격만큼은',540,820-169*reframe,108)
            text(c,item,scale=(1.35-.35*q)*(1.23-.23*reframe),blur=10*(1-q),alpha=clamp((t-12)/.1))
            for key,at in [('expect',12.6),('good',12.8)]:
                if t>=at:
                    q=enter((t-at)/.3);tracking=round(.08*(1-q),3)
                    text(c,COPY[key],wipe=q,tracking=tracking)
        # The central cream transition covers removed copy, never two competing sentences.
    elif 15.5<=t<20:
        reveal(c,COPY['benefits'],t,15.5,gold=False)
        if t>=15.8:
            im=glyph('오픈 행사점이',133,True)
            q=enter((t-15.8)/.4)
            place(c,outline(im,.65*(1-q)),540,817)
            place(c,im,540,817,wipe=q)
        reveal(c,COPY['best'],t,16.2,.4,dy=80,scale_start=1.12)
    result=Image.new('RGBA',(W,H));result.alpha_composite(c.crop(STAGE),(72,520));return result

def frame(n):
    t=n/FPS;z=1+.03*n/(FRAMES-1)
    cw,ch=W/z,H/z
    im=BG.transform((W,H),Image.Transform.EXTENT,((W-cw)/2,H-ch,(W+cw)/2,H),Image.Resampling.BICUBIC).convert('RGBA')
    im=Image.alpha_composite(im,panel(t))
    # Brand, schedule and original building persist across all scene transitions.
    place(im,NAME,585,125);place(im,LOGO,325,125)
    place(im,SCHEDULE,540,1289.5)
    small=enter((t-2.4)/.4)
    if t>=.2:
        e=enter((t-.2)/.3)
        place(im,YEAR,540,545-330*small+40*(1-e),scale=1-.38*small,clip=(72,175,1008,590))
    if t>=.4:
        e=enter((t-.4)/.4);scale=(1.55-.55*e)*(1-.55*small)
        place(im,TITLE,540,806-486*small,scale=scale,blur=12*(1-e),alpha=clamp((t-.4)/.1),clip=(72,175,1008,1130))
    # Keep pre-open information as its own layer; move once as the header compacts.
    py=1090-645*small
    text(im,('Pre Open',540,py,36),gold=True)
    text(im,(CONFIG['preopen'],540,py+43,31),gold=False)
    im=Image.alpha_composite(im,stage(t))
    return im.convert('RGB')

def preview():
    d=ROOT/'previews';d.mkdir(exist_ok=True)
    times=[1.8,4.7,7.6,10.5,14,18.5]
    sheet=Image.new('RGB',(1080,1280))
    for i,t in enumerate(times):
        im=frame(round(t*30));im.save(d/f'scene_{i+1}.png')
        sheet.paste(im.resize((360,640),Image.Resampling.LANCZOS),((i%3)*360,(i//3)*640))
    sheet.save(d/'contact_sheet.jpg',quality=96)
    groups=[(.2,.9),(2.4,3.9),(5.7,6.9),(8.7,9.8),(11.7,13.1),(15.2,16.7)]
    for g,(a,b) in enumerate(groups):
        ticks=range(round(a*10),round(b*10)+1)
        sheet=Image.new('RGB',(5*216,math.ceil(len(ticks)/5)*410),(25,25,25))
        draw=ImageDraw.Draw(sheet)
        for i,k in enumerate(ticks):
            im=frame(k*3).resize((216,384),Image.Resampling.LANCZOS)
            x=i%5*216;y=i//5*410;sheet.paste(im,(x,y));draw.text((x+6,y+387),f'{k/10:.1f}s',fill='white')
        sheet.save(d/f'transition_{g+1}.jpg',quality=93)
    print('Preview and 0.1s transition sheets ready',flush=True)

def render():
    ff=imageio_ffmpeg.get_ffmpeg_exe()
    cmd=[ff,'-y','-f','rawvideo','-pix_fmt','rgb24','-s','1080x1920','-r','30','-i','-','-an','-c:v','libx264','-preset','medium','-crf','14','-pix_fmt','yuv420p','-frames:v','600','-movflags','+faststart',str(OUTPUT)]
    with open(ROOT/'render.log','w') as log:
        p=subprocess.Popen(cmd,stdin=subprocess.PIPE,stderr=log)
        for n in range(600):
            p.stdin.write(frame(n).tobytes())
            if n%60==0:print(f'{n}/600 frames',flush=True)
        p.stdin.close();assert p.wait()==0
    print(OUTPUT,flush=True)
if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--preview',action='store_true');p.add_argument('--render',action='store_true');a=p.parse_args()
    if a.preview:preview()
    if a.render:render()
