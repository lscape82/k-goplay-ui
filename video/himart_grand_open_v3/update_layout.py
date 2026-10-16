from pathlib import Path
p=Path(__file__).with_name('render.py')
s=p.read_text(encoding='utf-8')
s=s.replace('ImageFont, ImageFilter','ImageFont, ImageFilter, ImageOps')
start=s.index('# V2 layout:')
end=s.index('def load_font',start)
s=s[:start]+'''# V3: user-supplied fixed composition. Only scenes 2-6 animate in the empty middle.
SCENES[0]['layers']=[]
SCENES[5]['layers']=SCENES[5]['layers'][:3]
POSITIONS = [[], [816,816,816,816,816,984], [764,953,953,953,953],
             [727,879,1042], [736,901,1053], [732,892,1050]]
for scene,positions in zip(SCENES,POSITIONS):
    for layer,y in zip(scene['layers'],positions): layer['y']=y
for layer in SCENES[2]['layers'][1:]: layer['size']=150
SCENES[3]['layers'][1]['size']=128
SCENES[3]['layers'][2]['size']=135
SCENES[4]['layers'][1]['size']=128
SCENES[4]['layers'][2]['size']=137
SCENES[5]['layers'][1]['size']=103
SCENES[5]['layers'][2]['size']=113

'''+s[end:]
start=s.index('def setup():')
end=s.index('def text_layer',start)
s=s[:start]+s[end:]
start=s.index('\nsetup()')
end=s.index('LAYERS=',start)
s=s[:start]+'''
source=Image.open(ROOT/'assets/fixed_layout.png').convert('RGB')
# Remove the 3px gray capture edge. Fit without stretching brand or building.
source=source.crop((0,3,source.width,source.height))
BG=ImageOps.fit(source,(WIDTH,HEIGHT),method=Image.Resampling.LANCZOS)
'''+s[end:]
start=s.index('    z=1+.04')
end=s.index('    for s in SCENES:',start)
s=s[:start]+"    bg=BG.copy().convert('RGBA')\n"+s[end:]
start=s.index('        # Restrained framing')
end=s.index("        for c in s['layers']:",start)
s=s[:start]+s[end:]
start=s.index("    bg=bg.convert('RGB')")
end=s.index('\ndef preview():',start)
s=s[:start]+"    return bg.convert('RGB')\n"+s[end:]
p.write_text(s,encoding='utf-8')
