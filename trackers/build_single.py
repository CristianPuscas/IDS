# Un singur fișier HTML (CSS + JS incluse) pentru folosire fără artifact, opțional cu date inițiale.
# Folosire: python3 trackers/build_single.py trackere.html [dosar-cu-json-uri-de-date]
import re, json, pathlib, sys
root = pathlib.Path(__file__).resolve().parent
src = (root / 'index.html').read_text()
def css(m): return '<style>\n' + (root / m.group(1)).read_text() + '\n</style>'
def js(m): return '<script>\n' + (root / m.group(1)).read_text().replace('</script', '<\\/script') + '\n</script>'
out = re.sub(r'<link rel="stylesheet" href="([^"]+)">', css, src)
out = re.sub(r'<script src="([^"]+)"></script>', js, out)
seed_dir = pathlib.Path(sys.argv[2]) if len(sys.argv) > 2 else None
if seed_dir:
    seed = {p.stem: json.loads(p.read_text()) for p in sorted(seed_dir.glob('*.json'))}
    blob = json.dumps(seed, ensure_ascii=False).replace('</', '<\\/')
    boot = ('<script>\n// Datele tale, copiate la generarea fișierului. Se folosesc doar pe un dispozitiv unde trackerul e încă gol.\n'
            '(function(){var seed=' + blob + ';try{Object.keys(seed).forEach(function(k){var key="tk:data:v1:"+k;'
            'if(!localStorage.getItem(key)){var d=seed[k];delete d.__name__;localStorage.setItem(key,JSON.stringify(d));}});}catch(e){}})();\n</script>\n')
    out = out.replace('<script>', boot + '<script>', 1)
pathlib.Path(sys.argv[1]).write_text(out)
print(sys.argv[1], len(out))
