#!/usr/bin/env python3
"""Rigenera i font incorporati del report PDF in russo (PDF_FONTS in src/index.html) — dalla 1.19.0.

Sottoinsiemi di Liberation Sans 2.1.5 Regular/Bold (SIL OFL 1.1, vedi fonts/OFL.txt), rinominati «SA Report Sans»
perché «Liberation» è un Reserved Font Name. Richiede: pip install fonttools; i TTF di Liberation Sans 2.x
(pacchetto fonts-liberation2 su Debian/Ubuntu). Scrive fonts.json; sostituire poi l'oggetto PDF_FONTS:

    python3 tools/pdf-fonts.py && python3 - <<'X'
    import json,re; s=open('src/index.html').read(); F=open('fonts.json').read()
    s=re.sub(r'const PDF_FONTS = .*?;\n</script>', 'const PDF_FONTS = '+F+';\n</script>', s, count=1, flags=re.S)
    open('src/index.html','w').write(s)
    X
"""
import json, base64, io
from fontTools.ttLib import TTFont
from fontTools import subset
U = set(range(0x20,0x7f)) | set(range(0xa0,0x100)) | set(range(0x400,0x460)) | {0x2116}
U |= {0x20ac,0x201a,0x192,0x201e,0x2026,0x2020,0x2021,0x2c6,0x2030,0x160,0x2039,0x152,0x17d,0x2018,0x2019,0x201c,0x201d,0x2022,0x2013,0x2014,0x2dc,0x2122,0x161,0x203a,0x153,0x17e,0x178}
U |= set(range(0x391,0x3aa)) | set(range(0x3b1,0x3ca)) | {0x2032,0x2033,0x2212,0x221a,0x2248,0x2260,0x2264,0x2265,0x221e,0x2190,0x2191,0x2192,0x2193,0x2194,0x2195,0x25b2,0x25bc,0x25cf,0x25cb,0x25c9,0x302,0x2009,0x202f,0x2007,0x200b,0x2011,0x2010,0x2012,0x2015}
out = {}
for key, src, style in [("R","/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf","Regular"),("B","/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf","Bold")]:
    f = TTFont(src); cm = f.getBestCmap(); uni = sorted(u for u in U if u in cm)
    opts = subset.Options(); opts.hinting = False; opts.layout_features = []; opts.name_IDs = [0,1,2,3,4,5,6,13,14]; opts.notdef_outline = True; opts.glyph_names = False; opts.drop_tables += ['GSUB','GPOS','GDEF','DSIG','kern','FFTM','meta']
    sub = subset.Subsetter(opts); sub.populate(unicodes=uni); sub.subset(f)
    # nome diverso: «Liberation» è un Reserved Font Name (OFL 1.1, sez. 3)
    fam = "SA Report Sans"; ps = "SAReportSans-" + style
    for r in f['name'].names:
        if r.nameID == 1: r.string = fam
        elif r.nameID == 3: r.string = f"Shoot Analyzer: {ps} (subset of Liberation Sans 2.1.5)"
        elif r.nameID == 4: r.string = f"{fam} {style}" if style != "Regular" else fam
        elif r.nameID == 6: r.string = ps
    buf = io.BytesIO(); f.save(buf); data = buf.getvalue()
    f = TTFont(io.BytesIO(data)); cm = f.getBestCmap(); upm = f['head'].unitsPerEm; order = f.getGlyphOrder(); hm = f['hmtx']
    cps = sorted(cm); gids = [f.getGlyphID(cm[c]) for c in cps]; ws = [round(hm[cm[c]][0]*1000/upm) for c in cps]
    W = [round(hm[g][0]*1000/upm) for g in order]
    h = f['head']; os2 = f['OS/2']; post = f['post']
    out[key] = {"name": ps, "b64": base64.b64encode(data).decode(), "cps": cps, "gids": gids, "ws": ws, "gw": W,
      "bbox": [round(v*1000/upm) for v in (h.xMin,h.yMin,h.xMax,h.yMax)], "asc": round(os2.sTypoAscender*1000/upm), "desc": round(os2.sTypoDescender*1000/upm),
      "cap": round(getattr(os2,'sCapHeight',1409)*1000/upm), "flags": 32, "stemV": 80 if key=="R" else 140}
    print(key, len(data), len(cps), len(order), f['name'].getDebugName(6))
json.dump(out, open("fonts.json","w"))
assert out["R"]["cps"] == out["B"]["cps"]
