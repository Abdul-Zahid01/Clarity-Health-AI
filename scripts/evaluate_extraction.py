"""Evaluate structured extraction on generated synthetic lab reports.

Generates seeded synthetic PDFs with known ground truth, runs each through the
real pipeline (PyMuPDF -> Gemini -> evidence validation -> status), and reports
field-level precision/recall/F1 and per-report latency.

Usage (from the repository root):
    backend\\.venv\\Scripts\\python.exe scripts\\evaluate_extraction.py --reports 30
"""

from __future__ import annotations

import argparse
import asyncio
import json
import random
import re
import statistics
import sys
import tempfile
import time
from dataclasses import asdict, dataclass
from pathlib import Path

import pymupdf

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "backend"))

from app.pdf_parser import extract_pages  # noqa: E402
from app.result_status import calculate_status  # noqa: E402
from app.structured_extractor import extract_structured_report  # noqa: E402

# name, unit, reference_min, reference_max, decimals; None bounds mean "<max" or ">min" ranges.
PANELS = {
    "Complete Blood Count": [
        ("Hemoglobin", "g/dL", 12.0, 16.0, 1),
        ("Hematocrit", "%", 36.0, 46.0, 1),
        ("RBC Count", "million/uL", 4.2, 5.4, 2),
        ("WBC Count", "10^3/uL", 4.0, 11.0, 1),
        ("Platelet Count", "10^3/uL", 150, 450, 0),
        ("MCV", "fL", 80, 100, 1),
        ("MCH", "pg", 27, 33, 1),
        ("RDW", "%", 11.5, 14.5, 1),
    ],
    "Metabolic Panel": [
        ("Glucose (Fasting)", "mg/dL", 70, 99, 0),
        ("Blood Urea Nitrogen", "mg/dL", 7, 20, 0),
        ("Creatinine", "mg/dL", 0.6, 1.2, 2),
        ("Sodium", "mmol/L", 135, 145, 0),
        ("Potassium", "mmol/L", 3.5, 5.1, 1),
        ("Calcium", "mg/dL", 8.5, 10.5, 1),
    ],
    "Lipid Profile": [
        ("Total Cholesterol", "mg/dL", None, 200, 0),
        ("HDL Cholesterol", "mg/dL", 40, None, 0),
        ("LDL Cholesterol", "mg/dL", None, 100, 0),
        ("Triglycerides", "mg/dL", None, 150, 0),
    ],
    "Liver Function": [
        ("ALT (SGPT)", "U/L", 7, 56, 0),
        ("AST (SGOT)", "U/L", 10, 40, 0),
        ("Alkaline Phosphatase", "U/L", 44, 147, 0),
        ("Total Bilirubin", "mg/dL", 0.1, 1.2, 1),
        ("Albumin", "g/dL", 3.5, 5.0, 1),
    ],
    "Thyroid Panel": [
        ("TSH", "mIU/L", 0.4, 4.0, 2),
        ("Free T4", "ng/dL", 0.8, 1.8, 2),
    ],
}
QUALITATIVE = [
    ("Urine Glucose", ["Not Detected", "Trace"]),
    ("Urine Protein", ["Negative", "Trace"]),
    ("Urine Ketones", ["Negative"]),
]
LAYOUTS = ("columns_with_flag", "combined_columns", "single_line")


@dataclass
class TruthResult:
    name: str
    value_numeric: float | None
    value_text: str | None
    unit: str | None
    reference_min: float | None
    reference_max: float | None
    reported_flag: str | None


def fmt(value: float, decimals: int) -> str:
    return f"{value:.{decimals}f}"


def range_text(low: float | None, high: float | None, decimals: int) -> str:
    if low is None:
        return f"< {fmt(high, decimals)}"
    if high is None:
        return f"> {fmt(low, decimals)}"
    return f"{fmt(low, decimals)} - {fmt(high, decimals)}"


def make_report(rng: random.Random, show_flags: bool) -> list[TruthResult]:
    panel_names = rng.sample(list(PANELS), k=rng.randint(1, 3))
    results: list[TruthResult] = []
    for panel in panel_names:
        for name, unit, low, high, decimals in PANELS[panel]:
            lo = low if low is not None else high * 0.5
            hi = high if high is not None else low * 2
            span = hi - lo
            # Roughly one in four values falls outside the reference interval.
            value = rng.uniform(lo - 0.3 * span, lo) if rng.random() < 0.12 else (
                rng.uniform(hi, hi + 0.3 * span) if rng.random() < 0.14 else rng.uniform(lo, hi)
            )
            value = round(max(value, 10 ** -decimals), decimals)
            status = calculate_status(value, low if low is not None else float("-inf"),
                                      high if high is not None else float("inf"))
            flag = {"high": "H", "low": "L"}.get(status) if show_flags else None
            results.append(TruthResult(name, value, None, unit, low, high, flag))
    if rng.random() < 0.4:
        for name, options in rng.sample(QUALITATIVE, k=2):
            results.append(TruthResult(name, None, rng.choice(options), None, None, None, None))
    return results


def render_pdf(path: Path, results: list[TruthResult], layout: str, rng: random.Random, report_id: int) -> None:
    document = pymupdf.open()
    rows_per_page = 14
    pages = [results[i:i + rows_per_page] for i in range(0, len(results), rows_per_page)]
    for page_index, rows in enumerate(pages, start=1):
        page = document.new_page(width=595, height=842)
        page.insert_text((54, 56), "SYNTHETIC REFERENCE LABORATORY", fontsize=15)
        page.insert_text((54, 74), "12 Example Street, Demo City  |  Tel 000-000-0000", fontsize=8)
        page.insert_text((54, 100), f"Patient: Test Person {report_id:03d}", fontsize=10)
        page.insert_text((300, 100), f"Age/Sex: {rng.randint(20, 80)} / {rng.choice(['F', 'M'])}", fontsize=10)
        page.insert_text((54, 114), f"Sample ID: SYN-{report_id:05d}   Collected: 0{rng.randint(1, 9)} Sep 2026", fontsize=9)
        y = 150
        if layout == "columns_with_flag":
            for x, label in ((54, "TEST"), (230, "RESULT"), (300, "FLAG"), (345, "UNIT"), (440, "REFERENCE")):
                page.insert_text((x, y), label, fontsize=9)
        elif layout == "combined_columns":
            for x, label in ((54, "INVESTIGATION"), (250, "OBSERVED VALUE"), (380, "BIOLOGICAL REF. INTERVAL")):
                page.insert_text((x, y), label, fontsize=9)
        y += 24
        for row in rows:
            decimals = 0
            if row.value_numeric is not None:
                decimals = len(str(row.value_numeric).split(".")[1]) if not float(row.value_numeric).is_integer() else 0
                value = fmt(row.value_numeric, decimals)
                bound = row.reference_min if row.reference_min is not None else row.reference_max
                ref_decimals = 0 if float(bound).is_integer() else len(str(bound).split(".")[1])
                ref = range_text(row.reference_min, row.reference_max, ref_decimals)
            else:
                value, ref = row.value_text, "Negative / Not Detected"
            if layout == "columns_with_flag":
                page.insert_text((54, y), row.name, fontsize=10)
                page.insert_text((230, y), value, fontsize=10)
                page.insert_text((300, y), row.reported_flag or "", fontsize=10)
                page.insert_text((345, y), row.unit or "", fontsize=10)
                page.insert_text((440, y), ref, fontsize=10)
            elif layout == "combined_columns":
                unit = f" {row.unit}" if row.unit else ""
                flag = f" {row.reported_flag}" if row.reported_flag else ""
                page.insert_text((54, y), row.name, fontsize=10)
                page.insert_text((250, y), f"{value}{unit}{flag}", fontsize=10)
                page.insert_text((380, y), f"{ref}{unit}", fontsize=10)
            else:
                unit = f" {row.unit}" if row.unit else ""
                flag = f" [{row.reported_flag}]" if row.reported_flag else ""
                page.insert_text((54, y), f"{row.name}: {value}{unit}{flag}   (Ref: {ref}{unit})", fontsize=10)
            y += 26
        page.insert_text((54, 760), "Interpretation: values should be reviewed with a clinician; reference intervals", fontsize=8)
        page.insert_text((54, 772), "vary by laboratory and method. Fasting for 8 to 12 hours is advised for lipid tests.", fontsize=8)
        page.insert_text((54, 800), f"DEMONSTRATION DATA - NOT A REAL MEDICAL REPORT    Page {page_index} of {len(pages)}", fontsize=8)
    document.save(path)
    document.close()


def norm_name(text: str) -> str:
    return re.sub(r"[^a-z0-9]", "", text.casefold())


def norm_unit(text: str | None) -> str | None:
    if not text:
        return None
    return text.casefold().replace(" ", "").replace("µ", "u").replace("μ", "u").replace("×", "x")


def norm_text(text: str | None) -> str | None:
    return " ".join(text.casefold().split()) if text else None


def numbers_equal(a: float | None, b: float | None) -> bool:
    return a is not None and b is not None and abs(a - b) < 1e-6


def score_report(truth: list[TruthResult], predicted: list[dict]) -> dict[str, list[int]]:
    """Field-level counts: a correct non-null field is a TP, a wrong value is FP+FN,
    a missed field is FN, and a value invented where the truth is null is FP."""

    fields = ("name", "value", "unit", "reference_min", "reference_max", "reported_flag")
    counts = {field: [0, 0, 0] for field in fields}  # tp, fp, fn
    unmatched = list(predicted)
    for expected in truth:
        key = norm_name(expected.name)
        match = next((p for p in unmatched if norm_name(p["name"]) == key), None) or next(
            (p for p in unmatched if key in norm_name(p["name"]) or norm_name(p["name"]) in key), None
        )
        if match:
            unmatched.remove(match)
        pairs = {
            "name": (expected.name, match["name"] if match else None, True),
            "value": (
                expected.value_numeric if expected.value_numeric is not None else norm_text(expected.value_text),
                (match["value_numeric"] if expected.value_numeric is not None else norm_text(match["value_text"])) if match else None,
                None,
            ),
            "unit": (norm_unit(expected.unit), norm_unit(match["unit"]) if match else None, None),
            "reference_min": (expected.reference_min, match["reference_min"] if match else None, None),
            "reference_max": (expected.reference_max, match["reference_max"] if match else None, None),
            "reported_flag": (expected.reported_flag, match["reported_flag"] if match else None, None),
        }
        for field, (want, got, always_equal) in pairs.items():
            if always_equal and match:
                equal = True
            elif isinstance(want, float) or isinstance(got, float):
                equal = numbers_equal(want, got)
            else:
                equal = want == got
            if want is not None and got is not None:
                if equal:
                    counts[field][0] += 1
                else:
                    counts[field][1] += 1
                    counts[field][2] += 1
            elif want is not None:
                counts[field][2] += 1
            elif got is not None:
                counts[field][1] += 1
    for extra in unmatched:  # hallucinated or duplicated results
        counts["name"][1] += 1
        for field, key in (("value", "value_numeric"), ("unit", "unit"), ("reference_min", "reference_min"),
                           ("reference_max", "reference_max"), ("reported_flag", "reported_flag")):
            if extra.get(key) is not None:
                counts[field][1] += 1
    return counts


def prf(tp: int, fp: int, fn: int) -> tuple[float, float, float]:
    precision = tp / (tp + fp) if tp + fp else 0.0
    recall = tp / (tp + fn) if tp + fn else 0.0
    f1 = 2 * precision * recall / (precision + recall) if precision + recall else 0.0
    return precision, recall, f1


async def run(report_count: int, seed: int, pause: float, output_dir: Path) -> None:
    rng = random.Random(seed)
    output_dir.mkdir(parents=True, exist_ok=True)
    totals: dict[str, list[int]] = {}
    latencies: list[float] = []
    failures: list[dict] = []
    status_correct = status_total = 0
    records = []
    for report_id in range(1, report_count + 1):
        show_flags = rng.random() < 0.6
        truth = make_report(rng, show_flags)
        layout = LAYOUTS[(report_id - 1) % len(LAYOUTS)]
        pdf_path = output_dir / f"synthetic-{report_id:03d}.pdf"
        render_pdf(pdf_path, truth, layout, rng, report_id)

        started = time.perf_counter()
        try:
            pages, _warnings = extract_pages(pdf_path.read_bytes())
            report = await extract_structured_report(pdf_path.name, pages)
            predicted = [result.model_dump() for result in report.results]
            error = None
        except Exception as exc:  # noqa: BLE001 - every failure is scored as a miss
            predicted = []
            cause = exc.__cause__
            error = f"{type(exc).__name__}: {exc} | cause: {getattr(cause, 'code', '')} {getattr(cause, 'status', '')}"
        elapsed = time.perf_counter() - started

        if error:
            failures.append({"report": pdf_path.name, "error": error, "seconds": round(elapsed, 2)})
        else:
            latencies.append(elapsed)
        counts = score_report(truth, predicted)
        for field, (tp, fp, fn) in counts.items():
            agg = totals.setdefault(field, [0, 0, 0])
            agg[0] += tp
            agg[1] += fp
            agg[2] += fn
        for expected in truth:
            got = next((p for p in predicted if norm_name(p["name"]) == norm_name(expected.name)), None)
            want_status = calculate_status(expected.value_numeric, expected.reference_min, expected.reference_max)
            status_total += 1
            status_correct += bool(got and got["calculated_status"] == want_status)

        records.append({
            "report": pdf_path.name, "layout": layout, "pages": len(pages) if not error else None,
            "truth_results": len(truth), "predicted_results": len(predicted),
            "seconds": round(elapsed, 2), "error": error,
            "truth": [asdict(item) for item in truth], "predicted": predicted,
        })
        tp = sum(c[0] for c in counts.values())
        fp = sum(c[1] for c in counts.values())
        fn = sum(c[2] for c in counts.values())
        print(f"[{report_id:>3}/{report_count}] {layout:<18} {len(truth):>2} results  "
              f"{elapsed:5.1f}s  F1={prf(tp, fp, fn)[2]:.3f}" + (f"  FAILED {error}" if error else ""), flush=True)
        if report_id < report_count:
            await asyncio.sleep(pause)

    print("\n=== Field-level results ===")
    all_tp = sum(v[0] for v in totals.values())
    all_fp = sum(v[1] for v in totals.values())
    all_fn = sum(v[2] for v in totals.values())
    summary = {"reports": report_count, "seed": seed, "fields": {}}
    for field, (tp, fp, fn) in totals.items():
        p, r, f = prf(tp, fp, fn)
        summary["fields"][field] = {"tp": tp, "fp": fp, "fn": fn, "precision": p, "recall": r, "f1": f}
        print(f"{field:<14} P={p:.3f} R={r:.3f} F1={f:.3f}  (tp={tp} fp={fp} fn={fn})")
    p, r, f = prf(all_tp, all_fp, all_fn)
    summary["micro"] = {"precision": p, "recall": r, "f1": f, "tp": all_tp, "fp": all_fp, "fn": all_fn}
    summary["status_accuracy"] = status_correct / status_total if status_total else 0.0
    summary["successful_reports"] = len(latencies)
    summary["failures"] = failures
    if latencies:
        ordered = sorted(latencies)
        summary["latency_seconds"] = {
            "median": statistics.median(ordered),
            "p95": ordered[min(len(ordered) - 1, round(0.95 * (len(ordered) - 1)))],
            "min": ordered[0],
            "max": ordered[-1],
        }
    print(f"\nMICRO      P={p:.3f} R={r:.3f} F1={f:.3f}")
    print(f"Status accuracy: {summary['status_accuracy']:.3f} over {status_total} results")
    print(f"Successful reports: {len(latencies)}/{report_count}")
    if latencies:
        lat = summary["latency_seconds"]
        print(f"Latency (successful reports): median={lat['median']:.2f}s p95={lat['p95']:.2f}s "
              f"min={lat['min']:.2f}s max={lat['max']:.2f}s")
    (output_dir / "summary.json").write_text(json.dumps(summary, indent=2), encoding="utf-8")
    (output_dir / "records.json").write_text(json.dumps(records, indent=2), encoding="utf-8")
    print(f"\nSaved PDFs and results to {output_dir}")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--reports", type=int, default=30)
    parser.add_argument("--seed", type=int, default=7)
    parser.add_argument("--pause", type=float, default=4.0, help="Seconds between reports to respect rate limits.")
    parser.add_argument("--output-dir", type=Path, default=Path(tempfile.gettempdir()) / "clarity-extraction-eval")
    args = parser.parse_args()
    asyncio.run(run(args.reports, args.seed, args.pause, args.output_dir))


if __name__ == "__main__":
    main()
