"""Generate offline SVG metadata badges; these are static, not remote CI status."""
from pathlib import Path
from xml.sax.saxutils import escape

BADGES = {
    'version': ('version', '1.1.0'),
    'windows': ('Windows', '10 / 11 x64'),
    'android': ('Android', '9+ / ARM64'),
    'license': ('code license', 'MIT'),
    'questions': ('question bank', '207 entries'),
    'offline': ('reading', 'offline'),
}


def badge(label, value):
    left = round(len(label)*6.4+20)
    right = round(len(value)*6.4+20)
    width = left+right
    title = escape(label+': '+value)
    return f'''<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="24" viewBox="0 0 {width} 24" role="img" aria-label="{title}">
  <title>{title}</title>
  <clipPath id="badge"><rect width="{width}" height="24" rx="4"/></clipPath>
  <g clip-path="url(#badge)"><path fill="#374151" d="M0 0h{left}v24H0z"/><path fill="#285d4b" d="M{left} 0h{right}v24H{left}z"/></g>
  <g fill="#fff" font-family="Verdana,DejaVu Sans,sans-serif" font-size="11" text-anchor="middle">
    <text x="{left/2}" y="16" textLength="{left-20}" lengthAdjust="spacingAndGlyphs">{escape(label)}</text>
    <text x="{left+right/2}" y="16" textLength="{right-20}" lengthAdjust="spacingAndGlyphs">{escape(value)}</text>
  </g>
</svg>
'''


if __name__ == '__main__':
    for name, pair in BADGES.items():
        Path(__file__).with_name(name+'.svg').write_text(badge(*pair), encoding='utf-8')
