# Re-run: python scripts/key-welcome-photo.py "brand asset/image.png" out.png  (then export WebP sizes)
# Blue-wall key for the welcome photo: soft alpha + spill removal, card colour shows through.
import sys, numpy as np
from PIL import Image, ImageFilter
src, out_png = sys.argv[1], sys.argv[2]
im = np.asarray(Image.open(src).convert("RGB")).astype(np.float64)
H, W, _ = im.shape
r, g, b = im[..., 0], im[..., 1], im[..., 2]
yy, xx = np.mgrid[0:H, 0:W]
TABLE_Y = 767  # first all-wood row; everything from here down stays solid

# "Blueness": how far blue rises above the other two channels (wall ≈ 90–110, fur ≈ 0 or below).
s = b - np.maximum(r, g)

# Local wall colour: fit a smooth 2nd-order surface to clearly-wall pixels (handles the vignette).
wall = (s > 70) & (r < 25) & (yy < TABLE_Y)
X = np.stack([np.ones(wall.sum()), xx[wall], yy[wall], xx[wall]**2, yy[wall]**2, xx[wall]*yy[wall]], 1) / 1.0
def fit(ch):
    coef, *_ = np.linalg.lstsq(X, ch[wall], rcond=None)
    A = np.stack([np.ones(H*W), xx.ravel(), yy.ravel(), xx.ravel()**2, yy.ravel()**2, (xx*yy).ravel()], 1)
    return (A @ coef).reshape(H, W)
Bw = np.stack([fit(r), fit(g), fit(b)], -1)
s_bg = Bw[..., 2] - np.maximum(Bw[..., 0], Bw[..., 1])

# Alpha: 1 = dog/food, 0 = wall. Soft ramp between a little blue (fur) and full wall blueness.
LO = 14.0
alpha = 1.0 - np.clip((s - LO) / np.maximum(s_bg - LO, 1.0), 0, 1)
alpha[yy >= TABLE_Y] = 1.0                       # table, food, blueberries
tag = (xx - 760)**2 + (yy - 531)**2 <= 44**2     # the blue eL tag
alpha[tag] = 1.0
# Clean the extremes (JPEG noise in the wall, specks inside the fur).
alpha = np.where(alpha < 0.05, 0.0, np.where(alpha > 0.97, 1.0, alpha))
# Choke the matte by ~1px: drops the last ring of wall-tinted edge pixels (leaf rims, fur tips).
a_img = Image.fromarray((alpha * 255).astype(np.uint8))
choked = np.asarray(a_img.filter(ImageFilter.MinFilter(3))).astype(np.float64) / 255.0
alpha = np.where(yy < TABLE_Y, np.minimum(alpha, (alpha + choked) / 2), alpha)
a_img = Image.fromarray((alpha * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(0.6))
alpha = np.asarray(a_img).astype(np.float64) / 255.0
alpha[yy >= TABLE_Y] = 1.0
alpha[tag] = 1.0
# Clear faint specks (wall noise) that aren't next to anything solid; real fur edges always are.
near_solid = np.asarray(Image.fromarray(((alpha > 0.5) * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(9))) > 0
alpha[(alpha < 0.12) & ~near_solid] = 0.0

# Unmix: remove the wall's share from edge pixels so fur keeps its true colour (no blue halo).
a3 = alpha[..., None]
F = np.where(a3 > 0.02, (im - (1 - a3) * Bw) / np.maximum(a3, 0.02), im)
F = np.clip(F, 0, 255)
# Residual spill guard on edges only: blue may not exceed the brighter of red/green by much.
# Edge band: soft pixels plus a 2px ring of solid ones next to them (spill lives there too).
soft = (alpha < 1)
ring = np.asarray(Image.fromarray((soft * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(5))) > 0
edge = ring & (alpha > 0) & (~tag) & (yy < TABLE_Y)
cap = np.maximum(F[..., 0], F[..., 1]) + 8
F[..., 2] = np.where(edge, np.minimum(F[..., 2], cap), F[..., 2])
rgba = np.dstack([F, alpha * 255]).round().astype(np.uint8)
Image.fromarray(rgba, "RGBA").save(out_png)
print("saved", out_png, "| transparent px:", int((alpha == 0).sum()), "| soft edge px:", int(edge.sum()))
