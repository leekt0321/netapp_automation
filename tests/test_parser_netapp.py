from app.parser_netapp import parse_netapp_log


def test_parse_single_cluster_summary_fields(sample_log: str):
    summary = parse_netapp_log(sample_log)

    assert summary["vendor"] == "NetApp"
    assert summary["hostname"] == "FAS2750"
    assert summary["model_name"] == "FAS2750"
    assert summary["ontap_version"] == "9.17.1P2"
    assert summary["controller_serial"] == "952047001063,952047000902"


def test_parse_12_node_cluster_models_and_serials(sample_12_node_log: str):
    summary = parse_netapp_log(sample_12_node_log)

    assert summary["hostname"] == "cloudv4"
    assert summary["model_name"] == "FAS8300,AFF-A400"
    assert "952237000136" in summary["controller_serial"]
    assert "952344003865" in summary["controller_serial"]
