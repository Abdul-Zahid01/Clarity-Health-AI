from urllib.parse import quote_plus

from app.schemas import LabResult, ReferenceLink


def references_for_result(result: LabResult) -> list[ReferenceLink]:
    name = result.name.casefold()
    if "hemoglobin" in name or "haemoglobin" in name or any(token in name for token in ("mcv", "mch", "rdw", "rbc")):
        query = "hemoglobin red blood cell indices clinical interpretation"
        topic = "Hemoglobin and red-cell indices"
    elif any(token in name for token in ("wbc", "white blood", "neutrophil", "lymphocyte", "eosinophil", "monocyte", "basophil")):
        query = "white blood cell differential clinical interpretation"
        topic = "White blood cell differential"
    elif "platelet" in name or "mpv" in name:
        query = "platelet count mean platelet volume clinical interpretation"
        topic = "Platelet count and volume"
    elif "glucose" in name:
        query = "blood glucose testing clinical interpretation"
        topic = "Blood glucose testing"
    elif any(token in name for token in ("bilirubin", "sgot", "sgpt", " ast", " alt")):
        query = "liver enzymes bilirubin clinical interpretation"
        topic = "Liver enzymes and bilirubin"
    elif any(token in name for token in ("creatinine", "urea", "bun")):
        query = "creatinine blood urea nitrogen kidney function interpretation"
        topic = "Kidney function markers"
    elif "tsh" in name or "thyroid" in name:
        query = "thyroid stimulating hormone TSH clinical interpretation"
        topic = "TSH and thyroid function"
    elif "urine" in (result.category or "").casefold() or "clinical pathology" in (result.category or "").casefold():
        query = "urinalysis clinical interpretation"
        topic = "Urinalysis"
    else:
        query = f"{result.name} laboratory test clinical interpretation"
        topic = result.name

    return [
        ReferenceLink(
            title=f"{topic} research",
            url=f"https://pubmed.ncbi.nlm.nih.gov/?term={quote_plus(query)}",
            source="PubMed",
        ),
        ReferenceLink(
            title=f"{topic} patient information",
            url=f"https://medlineplus.gov/search/?query={quote_plus(result.name)}",
            source="MedlinePlus",
        ),
    ]


def references_for_results(results: list[LabResult], cited_names: list[str]) -> list[ReferenceLink]:
    cited = {name.casefold() for name in cited_names}
    selected = [result for result in results if not cited or result.name.casefold() in cited]
    links: list[ReferenceLink] = []
    seen: set[str] = set()
    for result in selected:
        for link in references_for_result(result):
            if link.url not in seen:
                seen.add(link.url)
                links.append(link)
            if len(links) == 6:
                return links
    return links