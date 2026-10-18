import json, re, pyfiglet, pathlib

def fig(text, font):
    lines = pyfiglet.figlet_format(text, font=font, width=300).split("\n")
    lines = [l.rstrip() for l in lines]
    while lines and not lines[0].strip(): lines.pop(0)
    while lines and not lines[-1].strip(): lines.pop()
    return lines

def shade(lines, colors, indent=0):
    out = []
    for i, l in enumerate(lines):
        c = colors[min(i, len(colors) - 1)]
        out.append("|%02d" % c + " " * indent + l)
    return out

ART = {}

main = fig("SEPTiC TANKZ", "doom")
ART["logo_main"] = ["|08" + " " * 7 + "- = [ |14t h e|08 ] = -"] + shade(main, [15, 11, 11, 3, 3, 1], 6)

elite = fig("CESSPOOL", "poison")
ART["logo_elite"] = shade(elite, [13, 13, 5, 5, 12, 12, 4, 4, 8, 8])

nfo = fig("DRaiNBRaiN", "slant")
ART["logo_nfo"] = shade(nfo, [15, 7, 7, 8, 8], 8)

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


assert len(set(len(l) for l in TANK[2:])) <= 2
for k, v in ART.items():
    for l in v:
        w = len(re.sub(r"\|\d\d", "", l))
        assert w <= 80, (k, w, l)
        assert not re.search(r"\{.\}", l), (k, l)

tpl = pathlib.Path("template.html").read_text()
page = tpl.replace("/*__ART__*/null", json.dumps(ART))
pathlib.Path("septic-tankz.html").write_text(page)  # artifact body (the host adds the skeleton)
pathlib.Path("index.html").write_text(
    '<!doctype html><html lang="en"><head><meta charset="utf-8">'
    '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"></head><body>\n'
    + page + "\n</body></html>\n")  # standalone copy for GitHub Pages
print("ok", {k: max(len(re.sub(r'\|\d\d', '', l)) for l in v) for k, v in ART.items()})
