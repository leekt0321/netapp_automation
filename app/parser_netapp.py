import re
from typing import Any, Dict, List


SUMMARY_FIELDS = (
    "vendor",
    "hostname",
    "model_name",
    "ontap_version",
    "sp_ip_version",
    "mgmt",
    "shelf_count",
    "disk_count",
    "spare_count",
    "used_protocols",
    "snapmirror_in_use",
    "expansion_slots",
    "aggr_diskcount_maxraidsize",
    "volume_count",
    "lun_count",
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


def _dedupe_non_empty_blocks(blocks: List[str]) -> List[str]:
    seen = set()
    result = []
    for block in reversed(blocks):
        normalized = block.strip()
        if not normalized or normalized in seen:
            continue
        seen.add(normalized)
        result.append(normalized)
    result.reverse()
    return result


def _strip_terminal_backspaces(text: str) -> str:
    cleaned_chars: List[str] = []
    for char in text:
        if char == "\b":
            if cleaned_chars:
                cleaned_chars.pop()
            continue
        cleaned_chars.append(char)
    return "".join(cleaned_chars)


def decode_text_content(content: bytes) -> str:
    if content.startswith((b"\xff\xfe", b"\xfe\xff")):
        for encoding in ("utf-16", "utf-16-le", "utf-16-be"):
            try:
                return _strip_terminal_backspaces(content.decode(encoding))
            except UnicodeDecodeError:
                continue

    sample = content[:4096]
    if sample:
        even_nulls = sample[0::2].count(0)
        odd_nulls = sample[1::2].count(0)
        sample_pairs = max(1, len(sample) // 2)
        if odd_nulls / sample_pairs > 0.25 and even_nulls / sample_pairs < 0.05:
            try:
                return _strip_terminal_backspaces(content.decode("utf-16-le"))
            except UnicodeDecodeError:
                pass
        if even_nulls / sample_pairs > 0.25 and odd_nulls / sample_pairs < 0.05:
            try:
                return _strip_terminal_backspaces(content.decode("utf-16-be"))
            except UnicodeDecodeError:
                pass

    for encoding in ("utf-8-sig", "utf-8", "cp949", "euc-kr"):
        try:
            return _strip_terminal_backspaces(content.decode(encoding))
        except UnicodeDecodeError:
            continue

    return _strip_terminal_backspaces(content.decode("utf-8", errors="replace"))


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


def extract_sp_ip_version(text: str) -> str:
    block = _extract_command_block(text, "sp show")
    entries: List[str] = []
    in_table = False

    search_text = block if _block_has_non_empty_table(block) else text

    for raw_line in search_text.splitlines():
        line = raw_line.strip()
        if not line:
            continue

        if "Node" in line and "Version" in line and "IP Address" in line:
            in_table = True
            continue

        if not in_table:
            continue

        if set(line) == {"-"}:
            continue

        if re.match(r"^\d+\s+entries were displayed\.$", line):
            break

        parts = raw_line.split()
        if len(parts) < 6:
            continue

        node_name, node_type, status, configured, version, ip_address = parts[:6]
        if not re.match(r"^[A-Za-z0-9_-]+(?:-\d+)?$", node_name):
            continue
        if node_type.upper() not in {"BMC", "SP"}:
            continue
        if status.lower() not in {"online", "offline"}:
            continue
        if configured.lower() not in {"true", "false"}:
            continue
        if not re.match(r"^\d{1,3}(?:\.\d{1,3}){3}$", ip_address):
            continue

        entries.append(f"{ip_address} / {version}")

    return ",".join(_dedupe_keep_order(entries))


def extract_shelf_count(text: str) -> int:
    shelf_names = re.findall(r"^\s*(\d+\.\d+)\s+\d+\s+\S+\s+\S+\s+\S+\s+\S+\s*$", text, re.MULTILINE)
    return len(_dedupe_keep_order(shelf_names))


def extract_mgmt(text: str) -> str:
    block = _extract_command_block(text, "net int show")
    search_lines = _iter_table_data_lines(block) if _block_has_non_empty_table(block) else text.splitlines()

    for raw_line in search_lines:
        line = raw_line.strip() if isinstance(raw_line, str) else str(raw_line).strip()
        if "Address/Mask" in line and "Interface" in line:
            continue
        parts = line.split()
        if len(parts) < 3:
            continue
        if parts[0] == "Cluster":
            continue
        if parts[0] == "cluster_mgmt":
            address = parts[2]
            return address.split("/", 1)[0]

    fallback_match = re.search(r"\bcluster_mgmt\s+up/up\s+(\d{1,3}(?:\.\d{1,3}){3})/\d+\b", text)
    if fallback_match:
        return fallback_match.group(1)

    return ""


def _is_disk_identifier(value: str) -> bool:
    return re.match(r"^\d+\.\d+\.\d+$", value) is not None


def _is_zero_size(value: str) -> bool:
    return value in {"0B", "0KB", "0MB", "0GB", "0TB"}


def extract_spare_count(text: str) -> int:
    spare_count = 0
    section_type = ""

    for raw_line in text.splitlines():
        line = raw_line.strip()
        if not line:
            continue

        lower_line = line.lower()
        if "spare pool" in lower_line:
            section_type = "spare_pool"
            continue
        if "partitioned spares" in lower_line:
            section_type = "partitioned_spares"
            continue
        if lower_line.startswith("owner node:") or lower_line.startswith("original owner:"):
            section_type = ""
            continue
        if set(line) == {"-"} or line.startswith("Disk ") or line.startswith("Local ") or line.startswith("Pool0"):
            continue

        parts = raw_line.split()
        if not parts or not _is_disk_identifier(parts[0]):
            continue

        if section_type == "spare_pool":
            spare_count += 1
            continue

        if section_type == "partitioned_spares" and len(parts) >= 9:
            local_data_usable = parts[-4]
            if not _is_zero_size(local_data_usable):
                spare_count += 1

    return spare_count


def _extract_command_block(text: str, command: str) -> str:
    pattern = re.compile(
        rf"^[^\n]*::[^\n]*?>[^\n]*?{re.escape(command)}\s*$" r"(.*?)(?=^[^\n]*::[^\n]*?>|\Z)",
        re.MULTILINE | re.DOTALL,
    )
    match = pattern.search(text)
    return match.group(1) if match else ""


def extract_matching_command_blocks(text: str, command_pattern: str) -> List[str]:
    pattern = re.compile(
        rf"(^[^\n]*::[^\n]*?>[^\n]*?(?:{command_pattern})\s*$)(.*?)(?=^[^\n]*::[^\n]*?>|\Z)",
        re.MULTILINE | re.DOTALL | re.IGNORECASE,
    )
    blocks: List[str] = []

    for match in pattern.finditer(text):
        command_line = match.group(1).rstrip()
        command_output = match.group(2).strip("\n")
        combined = command_line if not command_output.strip() else f"{command_line}\n{command_output.strip()}"
        blocks.append(combined)

    return _dedupe_non_empty_blocks(blocks)


def extract_section_text_from_patterns(text: str, command_patterns: List[str]) -> str:
    command_blocks: List[str] = []
    for command_pattern in command_patterns:
        command_blocks.extend(extract_matching_command_blocks(text, command_pattern))
    return "\n\n".join(_dedupe_non_empty_blocks(command_blocks))


def extract_disk_section_text(text: str) -> str:
    return extract_section_text_from_patterns(
        text,
        [
            r"disk show\s+-broken",
            r"disk show\s+-fields\b[^\r\n]*",
            r"disk show",
        ],
    )


def extract_shelf_section_text(text: str) -> str:
    return extract_section_text_from_patterns(
        text,
        [
            r"storage shelf show\s+-fields\b[^\r\n]*",
            r"storage shelf show",
            r"run\s+-node\s+\S+\s+sasadmin\s+shelf",
            r"run\s+-node\s+\S+\s+sasadmin\s+expander_map",
        ],
    )


def extract_fcp_section_text(text: str) -> str:
    return extract_section_text_from_patterns(
        text,
        [
            r"vserver fcp show",
            r"fcp adapter show\s+-fields\b[^\r\n]*",
            r"fcp adapter show",
            r"fcp initiator show",
        ],
    )


def extract_network_interface_section_text(text: str) -> str:
    return extract_section_text_from_patterns(
        text,
        [
            r"net int failover-groups show",
            r"net int show\s+-fields\b[^\r\n]*",
            r"net int show\s+-instance",
            r"net int show",
            r"network interface show",
            r"net interface show",
            r"network int show",
            r"broadcast-domain show",
        ],
    )


def extract_network_port_section_text(text: str) -> str:
    return extract_section_text_from_patterns(
        text,
        [
            r"net port show\s+-fields\b[^\r\n]*",
            r"net port show\s+-instance",
            r"net port show",
            r"network port show",
        ],
    )


def extract_volume_section_text(text: str) -> str:
    return extract_section_text_from_patterns(
        text,
        [
            r"vol show\s+-fields\b[^\r\n]*",
            r"vol show",
            r"df -V -g -x",
            r"df -V -g",
            r"df -A -g -x",
            r"df -A -g",
            r"df -i",
        ],
    )


def extract_lun_section_text(text: str) -> str:
    return extract_section_text_from_patterns(
        text,
        [
            r"lun show\s+-fields\b[^\r\n]*",
            r"lun show",
            r"igroup show\s+-fields\b[^\r\n]*",
            r"igroup show",
            r"lun -m -g\s+[^\r\n]*",
        ],
    )


def extract_snapmirror_section_text(text: str) -> str:
    return extract_section_text_from_patterns(
        text,
        [
            r"snapmirror show-history",
            r"snapmirror show-h",
            r"snapmirror show\s+-fields\b[^\r\n]*",
            r"snapmirror show\s+-instance",
            r"snapmirror list-destination[s]?",
            r"snapmirror show",
            r"snapmirror\b[^\r\n]*",
            r"cluster peer show",
            r"vserver peer show",
        ],
    )


def extract_event_log_section_text(text: str) -> str:
    return extract_section_text_from_patterns(
        text,
        [
            r"alert show",
            r"event log show\s+-severity\b[^\r\n]*",
            r"event log show",
        ],
    )


def extract_event_log_section_contents(text: str) -> Dict[str, str]:
    all_text = extract_event_log_section_text(text)
    severity_map = {
        "all": all_text,
        "alert": {"categories": []},
        "error": {"categories": []},
        "emergency": {"categories": []},
    }

    matched_categories = {
        "alert": {},
        "error": {},
        "emergency": {},
    }
    for raw_line in all_text.splitlines():
        line = raw_line.rstrip()
        normalized = line.strip()
        if not normalized:
            continue
        match = re.match(
            r"^(\d{1,2}/\d{1,2}/\d{4})\s+(\d{1,2}:\d{2}:\d{2})\s+(\S+)\s+(ALERT|ERROR|EMERGENCY)\s+(.+)$",
            normalized,
            re.IGNORECASE,
        )
        if not match:
            continue

        severity = match.group(4).lower()
        message_text = match.group(5).strip()
        event_code_match = re.match(r"([^:]+):", message_text)
        event_code = event_code_match.group(1).strip() if event_code_match else message_text
        if severity in matched_categories:
            matched_categories[severity].setdefault(event_code, []).append(line)

    for key in ("alert", "error", "emergency"):
        severity_map[key] = {
            "categories": [
                {
                    "code": event_code,
                    "entries": lines,
                }
                for event_code, lines in matched_categories[key].items()
            ]
        }

    return severity_map


def _block_has_non_empty_table(block: str) -> bool:
    if not block:
        return False
    if "This table is currently empty." in block:
        return False
    return True


def _iter_table_data_lines(block: str) -> List[str]:
    data_lines: List[str] = []

    for raw_line in block.splitlines():
        line = raw_line.strip()
        if not line:
            continue
        if set(line) == {"-"}:
            continue
        if re.match(r"^\d+\s+entries were displayed\.$", line):
            continue
        data_lines.append(line)

    return data_lines


def _block_has_general_access_true(block: str) -> bool:
    if not _block_has_non_empty_table(block):
        return False

    for line in _iter_table_data_lines(block):
        if "General" in line and "Access" in line:
            continue
        parts = line.split()
        if len(parts) >= 2 and parts[1].lower() == "true":
            return True

    return False


def _block_has_status_admin_up(block: str) -> bool:
    if not _block_has_non_empty_table(block):
        return False

    for line in _iter_table_data_lines(block):
        if "Status" in line and "Admin" in line:
            continue
        parts = line.split()
        if any(part.lower() == "up" for part in parts):
            return True

    return False


def extract_used_protocols(text: str) -> str:
    protocols: List[str] = []

    if _block_has_general_access_true(_extract_command_block(text, "nfs show")):
        protocols.append("nfs")
    if _block_has_status_admin_up(_extract_command_block(text, "cifs show")):
        protocols.append("cifs")
    if _block_has_status_admin_up(_extract_command_block(text, "iscsi show")):
        protocols.append("iscsi")

    fcp_block = _extract_command_block(text, "fcp adapter show")
    if fcp_block and "This table is currently empty." not in fcp_block:
        for raw_line in fcp_block.splitlines():
            line = raw_line.strip()
            if not line or set(line) == {"-"}:
                continue
            if "Operational" in line and "Status" in line:
                continue
            if re.search(r"\bonline\b", line, re.IGNORECASE):
                protocols.append("fcp")
                break

    return ",".join(_dedupe_keep_order(protocols))


def extract_snapmirror_in_use(text: str) -> str:
    snapmirror_show_block = _extract_command_block(text, "snapmirror show")
    if _block_has_non_empty_table(snapmirror_show_block):
        for line in _iter_table_data_lines(snapmirror_show_block):
            if "Healthy" in line and "Updated" in line:
                continue
            if re.search(r"\btrue\b", line, re.IGNORECASE):
                return "O"

    snapmirror_destinations_block = _extract_command_block(text, "snapmirror list-destinations")
    if _block_has_non_empty_table(snapmirror_destinations_block):
        for line in _iter_table_data_lines(snapmirror_destinations_block):
            if "Relationship" in line and "Path" in line:
                continue
            return "O"

    return "X"


def extract_expansion_slots(text: str) -> str:
    slots: List[str] = []

    for raw_line in text.splitlines():
        match = re.search(r"sysconfig:\s+slot\s+(\d+)\s+OK:\s+([^:]+):\s+(.+)$", raw_line)
        if not match:
            continue
        slot_number = match.group(1).strip()
        part_number = match.group(2).strip()
        description = match.group(3).strip()
        slots.append(f"slot {slot_number}: {part_number}: {description}")

    return ", ".join(_dedupe_keep_order(slots))


def extract_aggr_diskcount_maxraidsize(text: str) -> str:
    entries: List[str] = []
    in_table = False

    for raw_line in text.splitlines():
        line = raw_line.strip()
        if not line:
            if in_table and entries:
                break
            continue

        lower_line = line.lower()
        if "aggregate" in lower_line and "diskcount" in lower_line and "maxraidsize" in lower_line:
            in_table = True
            continue

        if not in_table:
            continue

        if set(line) == {"-"}:
            continue

        parts = raw_line.split()
        if len(parts) < 3:
            if entries:
                break
            continue

        aggregate_name = parts[0]
        numeric_values = [part for part in parts[1:] if part.isdigit()]
        if len(numeric_values) < 2:
            if entries and re.search(r"::.*?>", raw_line):
                break
            continue

        diskcount = numeric_values[0]
        maxraidsize = numeric_values[1]
        entries.append(f"{aggregate_name}: {diskcount} / {maxraidsize}")

    return ", ".join(entries)


def extract_volume_count(text: str) -> int:
    count = 0
    in_table = False

    for raw_line in text.splitlines():
        line = raw_line.strip()
        if not line:
            if in_table and count:
                break
            continue

        if "Vserver" in line and "Volume" in line and "Aggregate" in line:
            in_table = True
            continue

        if not in_table:
            continue

        if set(line) == {"-"}:
            continue

        parts = raw_line.split()
        if len(parts) < 2:
            if count and re.search(r"::.*?>", raw_line):
                break
            continue
        volume_name = parts[1]
        if volume_name == "vol0" or volume_name.endswith("_root"):
            continue
        count += 1

    return count


def extract_lun_count(text: str) -> int:
    count = 0
    in_table = False

    for raw_line in text.splitlines():
        line = raw_line.strip()
        if not line:
            if in_table and count:
                break
            continue

        if "Vserver" in line and "Path" in line and "Mapped" in line:
            in_table = True
            continue

        if not in_table:
            continue

        if set(line) == {"-"}:
            continue

        parts = raw_line.split()
        if len(parts) < 6:
            if count and re.search(r"::.*?>", raw_line):
                break
            continue
        if parts[1].startswith("/vol/"):
            count += 1

    return count


def parse_netapp_log(text: str) -> Dict[str, Any]:
    return {
        "vendor": "NetApp",
        "hostname": extract_cluster_name(text),
        "model_name": extract_model_name(text),
        "ontap_version": extract_ontap_version(text),
        "sp_ip_version": extract_sp_ip_version(text),
        "mgmt": extract_mgmt(text),
        "shelf_count": extract_shelf_count(text),
        "disk_count": extract_disk_count(text),
        "spare_count": extract_spare_count(text),
        "used_protocols": extract_used_protocols(text),
        "snapmirror_in_use": extract_snapmirror_in_use(text),
        "expansion_slots": extract_expansion_slots(text),
        "aggr_diskcount_maxraidsize": extract_aggr_diskcount_maxraidsize(text),
        "volume_count": extract_volume_count(text),
        "lun_count": extract_lun_count(text),
        "controller_serial": extract_controller_serial(text),
    }


def format_summary_text(summary: Dict[str, Any]) -> str:
    lines = [f"{field}: {summary.get(field, '')}" for field in SUMMARY_FIELDS]
    return "\n".join(lines) + "\n"
