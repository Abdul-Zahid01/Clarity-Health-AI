from pathlib import Path

import pymupdf


OUTPUT = Path(__file__).parent.parent / "samples" / "synthetic-blood-report.pdf"


def main() -> None:
    OUTPUT.parent.mkdir(exist_ok=True)
    document = pymupdf.open()
    page = document.new_page(width=595, height=842)
    page.insert_text((54, 64), "CLARITY DIAGNOSTICS", fontsize=18)
    page.insert_text((54, 92), "Synthetic Complete Blood Count", fontsize=13)
    page.insert_text((54, 126), "Patient: Jordan Sample", fontsize=10)
    page.insert_text((340, 126), "Collected: 10 Sep 2026", fontsize=10)
    page.insert_text((54, 166), "TEST", fontsize=10)
    page.insert_text((240, 166), "RESULT", fontsize=10)
    page.insert_text((340, 166), "REFERENCE RANGE", fontsize=10)

    rows = [
        ("Hemoglobin", "11.2 g/dL", "12.0 - 16.0 g/dL"),
        ("White Blood Cells", "7.4 x10^9/L", "4.0 - 11.0 x10^9/L"),
        ("Platelets", "268 x10^9/L", "150 - 450 x10^9/L"),
        ("Glucose", "105 mg/dL", "70 - 99 mg/dL"),
    ]
    y_position = 196
    for test_name, result, reference_range in rows:
        page.insert_text((54, y_position), test_name, fontsize=10)
        page.insert_text((240, y_position), result, fontsize=10)
        page.insert_text((340, y_position), reference_range, fontsize=10)
        y_position += 30

    page.insert_text((54, 350), "DEMONSTRATION DATA - NOT A REAL MEDICAL REPORT", fontsize=9)
    document.save(OUTPUT)
    document.close()
    print(f"Created {OUTPUT}")


if __name__ == "__main__":
    main()