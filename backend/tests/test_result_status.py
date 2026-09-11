import pytest

from app.result_status import calculate_status
from app.schemas import LabResult


@pytest.mark.parametrize(
    ("value", "minimum", "maximum", "expected"),
    [
        (38, 0, 33, "high"),
        (0.38, 0.70, 1.30, "low"),
        (13, 13, 17, "normal"),
        (17, 13, 17, "normal"),
        (1.52, None, None, "unknown"),
        (None, 0, 10, "unknown"),
    ],
)
def test_calculate_status(
    value: float | None,
    minimum: float | None,
    maximum: float | None,
    expected: str,
) -> None:
    assert calculate_status(value, minimum, maximum) == expected


def test_lab_result_requires_numeric_or_text_value() -> None:
    with pytest.raises(ValueError, match="numeric or textual"):
        LabResult(name="Missing result", source_page=1, source_text="Missing result")


def test_lab_result_preserves_missing_range() -> None:
    result = LabResult(
        name="AST / ALT Ratio",
        value_numeric=1.52,
        source_page=3,
        source_text="AST / ALT Ratio 1.52",
    )

    assert result.reference_min is None
    assert result.reference_max is None
    assert result.calculated_status == "unknown"