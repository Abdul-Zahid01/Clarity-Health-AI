import pymupdf

from app.schemas import ExtractedPage


class PDFExtractionError(ValueError):
    pass


def extract_pages(pdf_bytes: bytes) -> tuple[list[ExtractedPage], list[str]]:
    try:
        document = pymupdf.open(stream=pdf_bytes, filetype="pdf")
    except Exception as error:
        raise PDFExtractionError("The uploaded file is not a readable PDF.") from error

    try:
        if document.needs_pass:
            raise PDFExtractionError("Password-protected PDFs are not supported.")

        pages = [
            ExtractedPage(page_number=index + 1, text=page.get_text().strip())
            for index, page in enumerate(document)
        ]
    finally:
        document.close()

    if not pages:
        raise PDFExtractionError("The PDF does not contain any pages.")

    empty_pages = [page.page_number for page in pages if not page.text]
    if len(empty_pages) == len(pages):
        raise PDFExtractionError(
            "No selectable text was found. Scanned PDFs will be supported in a later phase."
        )

    warnings = []
    if empty_pages:
        page_list = ", ".join(str(page_number) for page_number in empty_pages)
        warnings.append(f"No selectable text was found on page(s): {page_list}.")

    return pages, warnings
