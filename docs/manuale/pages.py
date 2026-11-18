import json, re, os, sys
D = os.path.dirname(os.path.abspath(__file__))
from pypdf import PdfReader
r=PdfReader(os.path.join(D, 'manuale.pdf'))
heads=json.load(open(os.path.join(D, 'heads.json')))
texts=[re.sub(r'\s+',' ',(p.extract_text() or '')) for p in r.pages]
res={}; start=3
for h in heads:
    t=re.sub(r'\s+',' ',h['text']).strip()
    for L in (40,20):
        hit=next((i for i in range(start,len(texts)) if t[:L] in texts[i]),None)
        if hit is not None: res[h['id']]=hit+1; start=hit; break
    else: print('NOT FOUND',t)
json.dump(res,open(os.path.join(D, 'pages.json'),'w')); print(len(r.pages),'pages',len(res),'heads')
