from app.schemas import ResultStatus


def calculate_status(
    value: float | None,
    reference_min: float | None,
    reference_max: float | None,
) -> ResultStatus:
    if value is None or reference_min is None or reference_max is None:
        return "unknown"
    if value < reference_min:
        return "low"
    if value > reference_max:
        return "high"
    return "normal"