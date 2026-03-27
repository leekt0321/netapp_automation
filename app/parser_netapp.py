import re
from typing import Any, Dict, List


SUMMARY_FIELDS = (
    "vendor",
    "cluster_name",
    "model_name",
    "ontap_version",
    "disk_count",
    "controller_serial",
)


def _dedupe_keep_order(items: List[str]) -> List[str]:
    seen = set()
    result = []
    for item in items:
        if item not in seen:
            seen.add(item)
            result.append(item)
    return result


def decode_text_content(content: bytes) -> str:
    for encoding in ("utf-8-sig", "utf-8", "cp949", "euc-kr"):
        try:
            return content.decode(encoding)
        except UnicodeDecodeError:
            continue

    return content.decode("utf-8", errors="replace")


def extract_cluster_name(text: str) -> str:
    match = re.search(r"^([A-Za-z0-9_-]+)::", text, re.MULTILINE)
    return match.group(1) if match else ""


def extract_ontap_version(text: str) -> str:
    match = re.search(r"NetApp Release\s+([0-9A-Za-z\.\-P]+)", text)
    return match.group(1) if match else ""


def extract_system_controller_rows(text: str) -> List[Dict[str, str]]:
    rows: List[Dict[str, str]] = []
    in_table = False

    for raw_line in text.splitlines():
        line = raw_line.strip()
        if not line:
            continue

        if "Controller Name" in line and "Serial Number" in line and "Model" in line:
            in_table = True
            continue

        if not in_table:
            continue

        if re.match(r"^\d+\s+entries were displayed\.$", line):
            break

        if set(line) == {"-"}:
            continue

        parts = raw_line.split()
        if len(parts) < 5:
            continue

        controller_name, _, serial_number, model = parts[:4]
        if not re.match(r"^[A-Za-z0-9_-]+(?:-\d+)?$", controller_name):
            continue
        if not serial_number.isalnum():
            continue

        rows.append(
            {
                "controller_name": controller_name,
                "serial": serial_number,
                "model": model,
            }
        )

    return rows


def extract_model_name(text: str) -> str:
    # NVMe 같은 "Model Name: X3311A"가 먼저 잡히면 안 되므로
    # System Board 블록 아래의 Model Name만 우선 사용
    match = re.search(
        r"slot 0:\s+System Board.*?Model Name:\s+([^\n\r]+)",
        text,
        re.DOTALL,
    )
    if match:
        return match.group(1).strip()

    # fallback: node show 표에서 모델 추출
    for line in text.splitlines():
        parts = line.split()
        if len(parts) >= 6 and re.match(r"^[A-Za-z0-9_-]+-\d+$", parts[0]):
            # 예: FAS2750-01 true true 12 days 00:00 FAS2750 Unified
            # uptime 칼럼이 길어서 고정 인덱스는 위험하지만,
            # 뒤에서 두 번째가 모델인 경우가 많음
            if parts[-1].lower() in ("unified", "san", "nas"):
                return parts[-2]

    controller_rows = extract_system_controller_rows(text)
    if controller_rows:
        models = _dedupe_keep_order([row["model"] for row in controller_rows if row["model"]])
        return ",".join(models)

    return ""


def extract_controller_serial(text: str) -> str:
    serials = re.findall(r"System Serial Number:\s+([A-Za-z0-9]+)", text)
    if not serials:
        serials = [row["serial"] for row in extract_system_controller_rows(text) if row["serial"]]
    serials = _dedupe_keep_order(serials)
    return ",".join(serials)


def extract_disk_count(text: str) -> int:
    """
    디스크 줄 예:
    00.2 : NETAPP   X422_HCOBE600A10 NA02 560.0GB 520B/sect (KWKWT3JX)
    Brocade300:4.126L0 : DGC VRAID 0533 88.7GB 512B/sect (600601603...)

    각 노드 블록에 같은 디스크가 반복될 수 있으므로
    괄호 안 마지막 고유 식별자(시리얼/WWID) 기준으로 dedupe 한다.
    """
    pattern = re.compile(
        r"^(\d+\.\d+\.\d+)\s+(?:\d+(?:\.\d+)?(?:GB|TB|MB)|-)\s+\d+\s+\d+\s+\S+\s+\S+.+$",
        re.MULTILINE,
    )

    disk_ids = pattern.findall(text)
    disk_ids = _dedupe_keep_order(disk_ids)
    return len(disk_ids)


def parse_netapp_log(text: str) -> Dict[str, Any]:
    return {
        "vendor": "NetApp",
        "cluster_name": extract_cluster_name(text),
        "model_name": extract_model_name(text),
        "ontap_version": extract_ontap_version(text),
        "disk_count": extract_disk_count(text),
        "controller_serial": extract_controller_serial(text),
    }


def format_summary_text(summary: Dict[str, Any]) -> str:
    lines = [f"{field}: {summary.get(field, '')}" for field in SUMMARY_FIELDS]
    return "\n".join(lines) + "\n"
