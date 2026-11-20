#!/bin/sh
# Rigenera il manuale PDF: schermate dall'app reale, conversione JPEG, due passaggi per i numeri di pagina dell'indice.
# Richiede Node con Playwright (npm install), Python 3 con Pillow e pypdf. Facoltativo: CHROME_PATH=percorso di Chrome.
set -e
cd "$(dirname "$0")"
node shots.js
python3 jpg.py
node render.js && python3 pages.py
node render.js pages.json && python3 pages.py
node render.js pages.json
cp manuale.pdf Manuale_Shoot_Analyzer_v1.19.pdf
echo "Creato docs/manuale/Manuale_Shoot_Analyzer_v1.19.pdf"
