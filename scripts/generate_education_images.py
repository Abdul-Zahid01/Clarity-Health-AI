from pathlib import Path
from random import Random

import pymupdf


OUTPUT_DIR = Path(__file__).parent.parent / "frontend" / "public" / "medical"
WIDTH = 600
HEIGHT = 338
BACKGROUND = (0.94, 0.97, 0.95)
INK = (0.12, 0.24, 0.22)


def new_page() -> tuple[pymupdf.Document, pymupdf.Page]:
    document = pymupdf.open()
    page = document.new_page(width=WIDTH, height=HEIGHT)
    page.draw_rect(page.rect, color=BACKGROUND, fill=BACKGROUND)
    return document, page


def save(document: pymupdf.Document, name: str) -> None:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    pixmap = document[0].get_pixmap(matrix=pymupdf.Matrix(2, 2), alpha=False)
    pixmap.save(OUTPUT_DIR / name)
    document.close()


def add_label(page: pymupdf.Page, title: str, subtitle: str) -> None:
    page.insert_text((34, 42), title, fontsize=18, color=INK)
    page.insert_text((34, 66), subtitle, fontsize=9, color=(0.35, 0.43, 0.40))


def blood_cells() -> None:
    document, page = new_page()
    add_label(page, "Hemoglobin & red blood cells", "Illustrative view — not a microscope image")
    randomizer = Random(7)
    for _ in range(19):
        center = pymupdf.Point(randomizer.randint(45, 555), randomizer.randint(105, 295))
        radius = randomizer.randint(20, 31)
        page.draw_circle(center, radius, color=(0.60, 0.08, 0.10), fill=(0.86, 0.24, 0.25), width=2)
        page.draw_circle(center, radius * 0.48, color=(0.95, 0.50, 0.48), fill=(0.95, 0.50, 0.48))
    save(document, "hemoglobin.png")


def white_cells() -> None:
    document, page = new_page()
    add_label(page, "White blood cells", "Part of the body's immune defense")
    randomizer = Random(11)
    for _ in range(13):
        center = pymupdf.Point(randomizer.randint(55, 550), randomizer.randint(110, 290))
        page.draw_circle(center, 23, color=(0.72, 0.78, 0.76), fill=(0.96, 0.97, 0.96))
    for center in (pymupdf.Point(210, 190), pymupdf.Point(380, 205)):
        page.draw_circle(center, 58, color=(0.24, 0.34, 0.58), fill=(0.78, 0.82, 0.93), width=2)
        page.draw_circle(pymupdf.Point(center.x - 14, center.y), 25, color=(0.29, 0.16, 0.49), fill=(0.42, 0.28, 0.64))
        page.draw_circle(pymupdf.Point(center.x + 16, center.y - 8), 23, color=(0.29, 0.16, 0.49), fill=(0.42, 0.28, 0.64))
    save(document, "white-blood-cells.png")


def platelets() -> None:
    document, page = new_page()
    add_label(page, "Platelets", "Small blood components that help form clots")
    randomizer = Random(19)
    for _ in range(11):
        center = pymupdf.Point(randomizer.randint(55, 550), randomizer.randint(115, 290))
        page.draw_circle(center, 24, color=(0.68, 0.12, 0.15), fill=(0.91, 0.37, 0.36))
        page.draw_circle(center, 11, color=(0.96, 0.63, 0.57), fill=(0.96, 0.63, 0.57))
    for _ in range(42):
        center = pymupdf.Point(randomizer.randint(45, 560), randomizer.randint(100, 305))
        page.draw_circle(center, randomizer.randint(3, 6), color=(0.58, 0.38, 0.66), fill=(0.72, 0.55, 0.78))
    save(document, "platelets.png")


def glucose() -> None:
    document, page = new_page()
    add_label(page, "Glucose", "A circulating sugar used by cells for energy")
    center = pymupdf.Point(300, 200)
    radius = 88
    points = []
    for offset in range(6):
        angle = 60 * offset - 30
        points.append(
            pymupdf.Point(
                center.x + radius * pymupdf.math.cos(angle * pymupdf.math.pi / 180),
                center.y + radius * pymupdf.math.sin(angle * pymupdf.math.pi / 180),
            )
        )
    for index, point in enumerate(points):
        page.draw_line(point, points[(index + 1) % len(points)], color=(0.85, 0.52, 0.10), width=7)
        page.draw_circle(point, 11, color=(0.92, 0.67, 0.18), fill=(1.0, 0.80, 0.31))
    page.draw_circle(center, 25, color=(0.10, 0.48, 0.44), fill=(0.18, 0.66, 0.59))
    page.insert_text((center.x - 10, center.y + 5), "G", fontsize=18, color=(1, 1, 1))
    save(document, "glucose.png")


def generic_lab() -> None:
    document, page = new_page()
    add_label(page, "Laboratory result", "An educational illustration of sample analysis")
    page.draw_rect(pymupdf.Rect(120, 115, 185, 285), color=(0.14, 0.45, 0.43), fill=(0.80, 0.91, 0.88), width=3)
    page.draw_rect(pymupdf.Rect(126, 205, 179, 279), color=(0.20, 0.58, 0.53), fill=(0.20, 0.58, 0.53))
    page.draw_rect(pymupdf.Rect(245, 135, 480, 280), color=(0.72, 0.78, 0.75), fill=(1, 1, 1), width=2)
    for y_position, width in ((168, 160), (202, 125), (236, 180)):
        page.draw_line(pymupdf.Point(275, y_position), pymupdf.Point(275 + width, y_position), color=(0.16, 0.48, 0.44), width=6)
    save(document, "generic-lab.png")


def liver() -> None:
    document, page = new_page()
    add_label(page, "Liver markers", "Illustrative anatomy — not a diagnostic image")
    page.draw_oval(pymupdf.Rect(145, 110, 455, 285), color=(0.39, 0.10, 0.08), fill=(0.62, 0.20, 0.15), width=3)
    page.draw_oval(pymupdf.Rect(330, 168, 474, 292), color=(0.39, 0.10, 0.08), fill=(0.55, 0.15, 0.12), width=3)
    page.draw_line(pymupdf.Point(315, 112), pymupdf.Point(320, 274), color=(0.82, 0.38, 0.28), width=3)
    page.draw_oval(pymupdf.Rect(352, 238, 380, 286), color=(0.20, 0.42, 0.25), fill=(0.33, 0.62, 0.36))
    save(document, "liver.png")


def kidneys() -> None:
    document, page = new_page()
    add_label(page, "Kidney function markers", "Illustrative anatomy — not a diagnostic image")
    for left, direction in ((175, 1), (355, -1)):
        page.draw_oval(pymupdf.Rect(left, 110, left + 90, 255), color=(0.45, 0.11, 0.15), fill=(0.72, 0.25, 0.28), width=3)
        notch_center = pymupdf.Point(left + (68 if direction == 1 else 22), 183)
        page.draw_circle(notch_center, 25, color=BACKGROUND, fill=BACKGROUND)
        page.draw_line(notch_center, pymupdf.Point(300, 295), color=(0.85, 0.63, 0.32), width=5)
    page.draw_oval(pymupdf.Rect(266, 277, 334, 321), color=(0.76, 0.49, 0.18), fill=(0.91, 0.70, 0.35))
    save(document, "kidneys.png")


def thyroid() -> None:
    document, page = new_page()
    add_label(page, "Thyroid & TSH", "Illustrative anatomy — not a diagnostic image")
    page.draw_line(pymupdf.Point(300, 95), pymupdf.Point(300, 290), color=(0.70, 0.78, 0.76), width=22)
    page.draw_oval(pymupdf.Rect(182, 130, 302, 275), color=(0.63, 0.28, 0.43), fill=(0.88, 0.52, 0.64), width=3)
    page.draw_oval(pymupdf.Rect(298, 130, 418, 275), color=(0.63, 0.28, 0.43), fill=(0.88, 0.52, 0.64), width=3)
    page.draw_rect(pymupdf.Rect(272, 180, 328, 225), color=(0.63, 0.28, 0.43), fill=(0.88, 0.52, 0.64))
    save(document, "thyroid.png")


def urinalysis() -> None:
    document, page = new_page()
    add_label(page, "Urinalysis", "A sample can be checked physically, chemically, and microscopically")
    page.draw_rect(pymupdf.Rect(150, 100, 245, 290), color=(0.25, 0.48, 0.52), fill=(0.90, 0.95, 0.95), width=3)
    page.draw_rect(pymupdf.Rect(158, 205, 237, 282), color=(0.88, 0.65, 0.10), fill=(0.98, 0.82, 0.27))
    page.draw_rect(pymupdf.Rect(330, 105, 370, 285), color=(0.52, 0.52, 0.48), fill=(0.96, 0.94, 0.84), width=2)
    colors = [(0.91, 0.52, 0.18), (0.27, 0.64, 0.47), (0.77, 0.31, 0.34), (0.38, 0.50, 0.72), (0.72, 0.60, 0.24)]
    for index, color in enumerate(colors):
        top = 120 + index * 31
        page.draw_rect(pymupdf.Rect(335, top, 365, top + 20), color=color, fill=color)
    save(document, "urinalysis.png")


def main() -> None:
    blood_cells()
    white_cells()
    platelets()
    glucose()
    liver()
    kidneys()
    thyroid()
    urinalysis()
    generic_lab()
    print(f"Created educational images in {OUTPUT_DIR}")


if __name__ == "__main__":
    main()