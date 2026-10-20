"""Builds the terminal page.

  public/index.html  served by the Cloudflare Worker (talks to its own /api)
  index.html         GitHub Pages copy (talks to the Worker at api_base in bbs.config.json)
"""
import json, re, pathlib, pyfiglet

ROOT = pathlib.Path(__file__).resolve().parent

def fig(text, font):
    lines = [l.rstrip() for l in pyfiglet.figlet_format(text, font=font, width=300).split("\n")]
    while lines and not lines[0].strip(): lines.pop(0)
    while lines and not lines[-1].strip(): lines.pop()
    return lines

def shade(lines, colors, indent=0):
    return ["|%02d" % colors[min(i, len(colors) - 1)] + " " * indent + l for i, l in enumerate(lines)]

ART = {}
ART["logo_main"] = ["|08" + " " * 7 + "- = [ |14t h e|08 ] = -"] + shade(fig("SEPTiC TANKZ", "doom"), [15, 11, 11, 3, 3, 1], 6)
ART["qterm"] = fig("Q-Slodem", "standard")   # the terminal program's own splash title (plain, colored in app.js)
ART["logo_elite"] = shade(fig("CESSPOOL", "poison"), [13, 13, 5, 5, 12, 12, 4, 4, 8, 8])

TANK = [
" FROM HOUSE                                               TO LEACH FIELD",
" ==========.      _[_]_                       _[_]_      .=============>",
"           |     |     |                     |     |     |",
"  .--------|-----'     '---------------------'     '-----|---------.",
"  |        |  ^^^^^^^^^^^^^^ S C U M ^^^^^^^^^^^^^^^^^^  |         |",
"  |        '                                             '         |",
"  |    ~ ~ ~ ~ ~ ~ ~ ~   E F F L U E N T   ~ ~ ~ ~ ~ ~ ~ ~         |",
"  |                                                                |",
"  |  ##########  S L U D G E  ###############################      |",
"  '----------------------------------------------------------------'",
]
def tank_color(r, c, ch):
    if r == 0: return 8
    if ch in "=>" or (r == 1 and ch == "."): return 7
    if c in (11, 57) and 2 <= r <= 5: return 7
    if r == 4 and ch != " " and 13 <= c <= 54: return 6
    if r == 6 and ch != " " and 4 < c < 60: return 3
    if r == 8 and ch != " " and 4 <= c < 62: return 6
    return 8
def colorize(lines, fn):
    out = []
    for r, l in enumerate(lines):
        s, cur = "", None
        for c, ch in enumerate(l):
            col = fn(r, c, ch)
            if col != cur: s += "|%02d" % col; cur = col
            s += ch
        out.append(s)
    return out
ART["tank"] = colorize(TANK, tank_color)
ART["toilet"] = [
    "|07              ____________",
    "|07             |  |15SEPTIC|07    |      |08Thanks for calling",
    "|07             |__|15TANKZ|07____|      |15THE SEPTIC TANKZ",
    "|07               |      |",
    "|07          .----'------'----.        |08Remember: only flush",
    "|07         (                  )       |08what you've uploaded.",
    "|07          '.              .'",
    "|07            '----.  .----'          |11Call back soon.",
    "|07                 |  |",
    "|07               __|__|__",
]
for k, v in ART.items():
    for l in v:
        assert len(re.sub(r"\|\d\d", "", l)) <= 80, (k, l)
        assert not re.search(r"\{.\}", l), (k, l)

cfg = json.loads((ROOT / "bbs.config.json").read_text())
shell = (ROOT / "web" / "shell.html").read_text()
app = (ROOT / "web" / "app.js").read_text().replace("/*__ART__*/null", json.dumps(ART))
page = shell.replace("/*__APP__*/", app)
doc = lambda api: ('<!doctype html><html lang="en"><head><meta charset="utf-8">'
                   '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"></head><body>\n'
                   + page.replace("/*__API__*/", api).replace("/*__BASE__*/", "") + "\n</body></html>\n")
(ROOT / "public").mkdir(exist_ok=True)
(ROOT / "public" / "index.html").write_text(doc(""))
(ROOT / "index.html").write_text(doc(cfg.get("api_base", "")))
print("built public/index.html and index.html (api_base=%r)" % cfg.get("api_base", ""))
