from __future__ import annotations

import shutil
import sys
from pathlib import Path

from PIL import Image, ImageChops


ROOT = Path(__file__).resolve().parents[1]
BRAND = ROOT / "public" / "brand"
ICONS = ROOT / "public" / "icons"
OFF_WHITE = (255, 253, 249, 255)


def content_bbox(image: Image.Image, threshold: int = 12) -> tuple[int, int, int, int]:
    bg = Image.new("RGBA", image.size, (255, 255, 255, 255))
    diff = ImageChops.difference(image, bg).convert("L")
    mask = diff.point(lambda pixel: 255 if pixel > threshold else 0)
    bbox = mask.getbbox()
    if bbox is None:
        raise RuntimeError("Could not detect logo content in source image.")
    return bbox


def pad_bbox(
    bbox: tuple[int, int, int, int],
    image_size: tuple[int, int],
    padding: int,
) -> tuple[int, int, int, int]:
    left, top, right, bottom = bbox
    width, height = image_size
    return (
        max(0, left - padding),
        max(0, top - padding),
        min(width, right + padding),
        min(height, bottom + padding),
    )


def resize_to_square(source: Image.Image, target: Path, size: int, fill: tuple[int, int, int, int]) -> None:
    target.parent.mkdir(parents=True, exist_ok=True)
    image = source.convert("RGBA")
    image.thumbnail((int(size * 0.84), int(size * 0.84)), Image.Resampling.LANCZOS)
    canvas = Image.new("RGBA", (size, size), fill)
    offset = ((size - image.width) // 2, (size - image.height) // 2)
    canvas.alpha_composite(image, offset)
    canvas.save(target)


def resize_favicon(source: Image.Image, target: Path, size: int) -> Image.Image:
    target.parent.mkdir(parents=True, exist_ok=True)
    image = source.convert("RGBA")
    image.thumbnail((int(size * 0.92), int(size * 0.92)), Image.Resampling.LANCZOS)
    canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    offset = ((size - image.width) // 2, (size - image.height) // 2)
    canvas.alpha_composite(image, offset)
    pixels = canvas.load()
    for y in range(size):
        for x in range(size):
            _, _, _, alpha = pixels[x, y]
            if alpha < 10:
                pixels[x, y] = (0, 0, 0, 0)
            else:
                pixels[x, y] = (23, 20, 22, min(255, int(alpha * 3.8)))
    canvas.save(target)
    return canvas


def save_crop(source: Image.Image, bbox: tuple[int, int, int, int], target: Path) -> Image.Image:
    target.parent.mkdir(parents=True, exist_ok=True)
    crop = source.crop(bbox).convert("RGBA")
    crop.save(target)
    return crop


def remove_white_background(source: Image.Image, threshold: int = 235) -> Image.Image:
    image = source.convert("RGBA")
    pixels = image.load()
    for y in range(image.height):
        for x in range(image.width):
            red, green, blue, alpha = pixels[x, y]
            luminance = int(red * 0.299 + green * 0.587 + blue * 0.114)
            if luminance >= threshold:
                pixels[x, y] = (23, 20, 22, 0)
            else:
                ink_alpha = min(255, max(0, int((threshold - luminance) * 5.2)))
                pixels[x, y] = (23, 20, 22, min(alpha, ink_alpha))
    return image


def make_ico(source: Image.Image, target: Path) -> None:
    icon = source.convert("RGBA")
    icon.save(target, sizes=[(16, 16), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)])


def try_make_icns(source: Image.Image, target: Path) -> bool:
    try:
        source.convert("RGBA").save(target, format="ICNS")
        return target.exists()
    except Exception as exc:
        print(f"ICNS generation skipped: {exc}")
        return False


def main() -> int:
    if len(sys.argv) != 2:
        print("Usage: python generate-brand-assets.py <source-logo-png>", file=sys.stderr)
        return 1

    source_path = Path(sys.argv[1]).expanduser().resolve()
    if not source_path.exists():
        print(f"Source logo does not exist: {source_path}", file=sys.stderr)
        return 1

    BRAND.mkdir(parents=True, exist_ok=True)
    ICONS.mkdir(parents=True, exist_ok=True)

    image = Image.open(source_path).convert("RGBA")
    shutil.copyfile(source_path, BRAND / "researchdino-logo-source.png")

    full_bbox = pad_bbox(content_bbox(image), image.size, 38)
    full_logo = save_crop(image, full_bbox, BRAND / "researchdino-logo-full.png")

    # Crops are from the provided logo image. They intentionally preserve the
    # original drawing instead of redrawing or vectorizing it.
    mark_bbox = (260, 250, 1068, 740)
    agent_avatar_bbox = (275, 250, 625, 570)
    wordmark_bbox = (170, 735, 1124, 858)
    mark_crop = image.crop(mark_bbox).convert("RGBA")
    mark = remove_white_background(mark_crop)
    mark.save(BRAND / "researchdino-mark.png")
    agent_avatar = remove_white_background(image.crop(agent_avatar_bbox).convert("RGBA"))
    agent_avatar.save(BRAND / "researchdino-agent-avatar.png")
    save_crop(image, wordmark_bbox, BRAND / "researchdino-wordmark.png")

    # Keep the requested horizontal filename as a trimmed full-logo bitmap,
    # not a redrawn horizontal reinterpretation.
    full_logo.save(BRAND / "researchdino-logo-horizontal.png")

    for size in [1024, 512, 256, 192, 180, 128, 64, 48, 32, 16]:
        resize_to_square(mark, ICONS / f"app-icon-{size}.png", size, OFF_WHITE)

    for size in [16, 32, 48]:
        resize_favicon(mark, ICONS / f"favicon-{size}x{size}.png", size)

    shutil.copyfile(ICONS / "app-icon-180.png", ICONS / "apple-touch-icon.png")
    shutil.copyfile(ICONS / "app-icon-192.png", ICONS / "android-chrome-192x192.png")
    shutil.copyfile(ICONS / "app-icon-512.png", ICONS / "android-chrome-512x512.png")
    resize_to_square(mark, ICONS / "maskable-icon-512x512.png", 512, OFF_WHITE)

    favicon_source = resize_favicon(mark, ICONS / "favicon-256-source.png", 256)
    make_ico(favicon_source, ICONS / "favicon.ico")
    (ICONS / "favicon-256-source.png").unlink(missing_ok=True)
    with Image.open(ICONS / "app-icon-1024.png") as app_icon:
        make_ico(app_icon, ICONS / "icon.ico")
        try_make_icns(app_icon, ICONS / "icon.icns")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
