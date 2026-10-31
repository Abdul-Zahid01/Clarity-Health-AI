import re

from app.schemas import ExtractedPage

# These are label-based safeguards, not general-purpose person-name recognition.
IDENTITY_LABEL = re.compile(
    r"(?i)^\s*(?:(?:patient|client|subject)\s*(?:name|details|information|id|no\.?|number)"
    r"|(?:full|first|last|sur)\s*name|name|patient"
    r"|(?:mrn|uhid|aadhar|aadhaar|ssn|passport)"
    r"|(?:sample|accession|registration|report|lab|hospital)\s*(?:id|no\.?|number)"
    r"|(?:date\s*of\s*birth|dob|birth\s*date)|address|e-?mail|phone|mobile|contact"
    r"|(?:referred|requested|collected|reported|verified|approved)\s*by"
    r"|ref\.?\s*(?:by|doctor)|consultant|physician|doctor)"
    r"(?:\s*[:=#-]|\s*$|\s+(?!\s*$))"
)
EMAIL = re.compile(r"\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b", re.I)
HONORIFIC_NAME = re.compile(r"(?i)^\s*(?:mr|mrs|ms|miss|dr|prof)\.?\s+[a-z]")


def redact_report_pages(pages: list[ExtractedPage]) -> tuple[list[ExtractedPage], int]:
    redacted_pages = []
    removed_lines = 0
    for page in pages:
        retained = []
        skip_next = False
        for line in page.text.splitlines():
            if not line.strip():
                retained.append(line)
                continue
            match = IDENTITY_LABEL.match(line)
            if match or HONORIFIC_NAME.match(line) or EMAIL.search(line):
                removed_lines += 1
                skip_next = bool(match and not line[match.end():].strip())
                continue
            if skip_next:
                # PDF extraction sometimes puts the value below its label.
                removed_lines += 1
                skip_next = False
                continue
            retained.append(line)
        redacted_pages.append(page.model_copy(update={"text": "\n".join(retained).strip()}))
    return redacted_pages, removed_lines


def is_deletion_only(original: str, edited: str) -> bool:
    source = iter(original)
    return all(any(candidate == character for candidate in source) for character in edited)
