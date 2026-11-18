# Converte le schermate PNG (img/) in JPEG (imgj/) per un PDF più leggero
import glob, os
from PIL import Image
D = os.path.dirname(os.path.abspath(__file__))
os.makedirs(os.path.join(D, "imgj"), exist_ok=True)
for f in glob.glob(os.path.join(D, "img", "*.png")):
    Image.open(f).convert("RGB").save(os.path.join(D, "imgj", os.path.basename(f)[:-4] + ".jpg"), quality=86, optimize=True)
