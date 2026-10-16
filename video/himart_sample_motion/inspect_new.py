from pathlib import Path
import subprocess
from PIL import Image,ImageDraw
import imageio_ffmpeg
ROOT=Path(__file__).resolve().parent/'new_sample';ROOT.mkdir(exist_ok=True)
src='E:/★★★광고주제안서/★★집행완료_251230/대구성서점롯데하이마트/하이마트영상/250804_LEESEEDX_D2_롯데하이마트_성서점_광고영상.mp4'
p=subprocess.run([imageio_ffmpeg.get_ffmpeg_exe(),'-y','-i',src,'-vf','fps=4,scale=270:-1','-an',str(ROOT/'%03d.png')],capture_output=True)
print(p.stderr.decode('utf-8',errors='replace')[-3500:])
files=sorted(ROOT.glob('*.png'))
for o in range(0,len(files),20):
 h=Image.open(files[0]).height;sheet=Image.new('RGB',(1350,(h+24)*4));d=ImageDraw.Draw(sheet)
 for j,f in enumerate(files[o:o+20]):
  x=j%5*270;y=j//5*(h+24);sheet.paste(Image.open(f),(x,y));d.text((x+5,y+h+3),f'{(o+j)/4:.2f}s',fill='white')
 sheet.save(ROOT/f'contact_{o//20}.jpg')
