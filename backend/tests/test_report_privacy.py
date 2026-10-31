import pytest

from app.report_privacy import is_deletion_only, redact_report_pages
from app.schemas import ExtractedPage
from app.structured_extractor import build_report_text


@pytest.mark.parametrize("label", [
    "Patient Name:", "Patient:", "Name:", "Full Name:", "Patient ID:", "UHID:",
    "DOB:", "Address:", "Phone:", "Referred By:", "Sample No:", "Report ID:",
])
def test_removes_labeled_identity_lines_without_changing_labs(label):
    pages = [ExtractedPage(page_number=2, text=f"{label} Synthetic Person\nGlucose 92 mg/dL")]
    redacted, count = redact_report_pages(pages)
    assert redacted[0].text == "Glucose 92 mg/dL"
    assert redacted[0].page_number == 2
    assert count == 1
    assert "Synthetic Person" in pages[0].text


def test_removes_split_labels_emails_and_honorific_names():
    pages, count = redact_report_pages([ExtractedPage(
        page_number=1,
        text="Patient Name:\nSynthetic Person\nEmail synthetic@example.invalid\nDr Synthetic Referrer\nTSH 2.4 mIU/L",
    )])
    assert pages[0].text == "TSH 2.4 mIU/L"
    assert count == 4
    assert redact_report_pages(pages)[0] == pages


def test_provider_text_is_redacted_but_does_not_claim_to_find_unlabeled_names():
    prompt = build_report_text([ExtractedPage(
        page_number=1, text="Name: Synthetic Person\nUnlabeled synthetic header\nGlucose 92 mg/dL",
    )])
    assert "Synthetic Person" not in prompt
    assert "Unlabeled synthetic header" in prompt
    assert "[PAGE 1]" in prompt


def test_preview_only_allows_deletions():
    assert is_deletion_only("Header\nGlucose 92", "Glucose 92")
    assert is_deletion_only("Glucose 92", "")
    assert not is_deletion_only("Glucose 92", "Glucose 95")
