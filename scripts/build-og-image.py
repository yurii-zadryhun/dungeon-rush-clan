"""Build the public Open Graph JPEG from the cropped real clan emblem.

One-time asset regeneration; not part of the production runtime.
Requires Pillow (python3 -m pip install Pillow).
"""
from pathlib import Path
import math
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
PUBLIC = ROOT / 'web' / 'public'
emblem = Image.open(PUBLIC / 'assets' / 'clan-emblem.png').convert('RGBA')
W, H = 1200, 630
image = Image.new('RGB', (W, H))
pixels = image.load()
for y in range(H):
    for x in range(W):
        left = max(0, 1 - math.hypot(x - 260, y - 250) / 750)
        right = max(0, 1 - math.hypot(x - 1070, y - 80) / 870)
        pixels[x, y] = (
            int(17 + 14 * left + 17 * right),
            int(20 + 24 * left + 6 * right),
            int(29 + 35 * left + 22 * right),
        )
draw = ImageDraw.Draw(image)
draw.rounded_rectangle((45, 40, 1155, 590), radius=40,
                       fill=(28, 30, 39), outline=(63, 78, 103), width=3)
draw.line((420, 155, 420, 485), fill=(67, 79, 99), width=3)
large = emblem.resize((340, 340), Image.Resampling.LANCZOS)
image.paste(large, (59, 147), large)
font_bold = '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'
font_regular = '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'
def bold(size):
    return ImageFont.truetype(font_bold, size)
draw.text((469, 171), 'UKRAINIANS', font=bold(79), fill=(252, 250, 246))
draw.rounded_rectangle((471, 282, 782, 330), radius=11, fill=(47, 100, 143))
draw.text((492, 291), 'DUNGEON RUSH', font=bold(34), fill=(255, 252, 243))
draw.text((473, 368), 'CLAN WAR HISTORY', font=bold(40), fill=(243, 205, 117))
draw.text((473, 443), 'Public war results',
          font=ImageFont.truetype(font_regular, 28), fill=(187, 199, 217))
image.save(PUBLIC / 'assets' / 'og-clan.jpg', quality=70, optimize=True, subsampling=2)
print('Generated:', PUBLIC / 'og-clan.jpg')
