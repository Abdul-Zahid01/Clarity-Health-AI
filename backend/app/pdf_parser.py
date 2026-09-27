from io import BytesIO
from pathlib import Path

import pymupdf
import pytesseract
from PIL import Image

from app.schemas import ExtractedPage


class PDFExtractionError(ValueError):
    pass


def configure_tesseract() -> None:
    if pytesseract.pytesseract.tesseract_cmd != "tesseract":
        return

    windows_path = Path("C:/Program Files/Tesseract-OCR/tesseract.exe")
    if windows_path.exists():
        pytesseract.pytesseract.tesseract_cmd = str(windows_path)


configure_tesseract()


def extract_pages(pdf_bytes: bytes) -> tuple[list[ExtractedPage], list[str]]:
    try:
        document = pymupdf.open(stream=pdf_bytes, filetype="pdf")
    except Exception as error:
        raise PDFExtractionError("The uploaded file is not a readable PDF.") from error

    try:
        if document.needs_pass:
            raise PDFExtractionError("Password-protected PDFs are not supported.")

        pages = []
        for index, page in enumerate(document):
            text = page.get_text().strip()
            if text:
                pages.append(ExtractedPage(page_number=index + 1, text=text))
                continue

            try:
                pixmap = page.get_pixmap(dpi=300, alpha=False)
                image = Image.open(BytesIO(pixmap.tobytes("png")))
                ocr_text = pytesseract.image_to_string(image).strip()
            except pytesseract.TesseractNotFoundError as error:
                raise PDFExtractionError(
                    "This PDF has no selectable text. Install the Tesseract OCR executable to read scanned pages."
                ) from error

            pages.append(
                ExtractedPage(
                    page_number=index + 1,
                    text=ocr_text,
                    extraction_method="tesseract",
                    needs_review=True,
                )
            )
    finally:
        document.close()

    if not pages:
        raise PDFExtractionError("The PDF does not contain any pages.")

    empty_pages = [page.page_number for page in pages if not page.text]
    if len(empty_pages) == len(pages):
        raise PDFExtractionError("No readable text was found in this PDF.")

    warnings = []
    if empty_pages:
        page_list = ", ".join(str(page_number) for page_number in empty_pages)
        warnings.append(f"No readable text was found on page(s): {page_list}.")

    ocr_pages = [page.page_number for page in pages if page.extraction_method == "tesseract"]
    if ocr_pages:
        page_list = ", ".join(str(page_number) for page_number in ocr_pages)
        warnings.append(
            f"Tesseract OCR was used on page(s): {page_list}. Review OCR-derived values carefully."
        )

    return pages, warnings
