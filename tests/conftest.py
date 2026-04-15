import importlib
import os
import sys
from pathlib import Path

import pytest
from fastapi.testclient import TestClient


SAMPLE_LOG = """FAS2750::*> node show
NetApp Release 9.17.1P2: Fri Nov  7 04:39:01 EST 2025
slot 0: System Board 1.5 GHz (System Board XXII C2)
                Model Name:         FAS2750
System Serial Number: 952047001063 (FAS2750-01)
System Serial Number: 952047000902 (FAS2750-02)
00.2 : NETAPP   X422_HCOBE600A10 NA02 560.0GB 520B/sect (DISK001)
00.3 : NETAPP   X422_HCOBE600A10 NA02 560.0GB 520B/sect (DISK002)
"""

SAMPLE_12_NODE_LOG = """cloudv4::*> system controller show
Controller Name System ID Serial Number Model Status

PC2HDD001-01 538261227 952237000136 FAS8300 ok
PC2HDD001-02 538261030 952236001752 FAS8300 ok
PC2HDD002-01 538206132 952117001954 FAS8300 ok
PC2HDD002-02 538260892 952237000367 FAS8300 ok
PC2HDD003-01 538260971 952237000296 FAS8300 ok
PC2HDD003-02 538261160 952237000232 FAS8300 ok
PC2SSD001-01 538260683 952236001391 AFF-A400 ok
PC2SSD001-02 538250337 952220001641 AFF-A400 ok
PC2SSD002-01 538260649 952237000569 AFF-A400 ok
PC2SSD002-02 538261172 952237000181 AFF-A400 ok
PC2SSD003-01 538260819 952237000437 AFF-A400 ok
PC2SSD003-02 538311486 952344003865 AFF-A400 ok
12 entries were displayed.
"""


def unload_app_modules() -> None:
    for module_name in list(sys.modules):
        if module_name == "app" or module_name.startswith("app."):
            sys.modules.pop(module_name, None)


@pytest.fixture
def sample_log() -> str:
    return SAMPLE_LOG


@pytest.fixture
def sample_12_node_log() -> str:
    return SAMPLE_12_NODE_LOG


@pytest.fixture
def app_module(monkeypatch: pytest.MonkeyPatch, tmp_path: Path):
    upload_dir = tmp_path / "upload"
    test_database_url = os.getenv("TEST_DATABASE_URL")
    if test_database_url:
        database_url = test_database_url
    else:
        database_url = f"sqlite+pysqlite:///{tmp_path / 'test.db'}"

    monkeypatch.setenv("DATABASE_URL", database_url)
    monkeypatch.setenv("UPLOAD_DIR", str(upload_dir))
    monkeypatch.setenv("ADMIN_USERNAME", "admin")
    monkeypatch.setenv("ADMIN_PASSWORD", "secret123")
    monkeypatch.setenv("ADMIN_FULL_NAME", "Baobab Admin")

    unload_app_modules()

    main_module = importlib.import_module("app.main")
    db_module = importlib.import_module("app.db")
    models_module = importlib.import_module("app.models")

    models_module.Base.metadata.drop_all(db_module.engine)
    models_module.Base.metadata.create_all(db_module.engine)
    with db_module.engine.begin() as connection:
        connection.exec_driver_sql("CREATE TABLE IF NOT EXISTS alembic_version (version_num VARCHAR(32) NOT NULL)")
        current_version = connection.exec_driver_sql("SELECT version_num FROM alembic_version LIMIT 1").scalar()
        if current_version is None:
            connection.exec_driver_sql("INSERT INTO alembic_version (version_num) VALUES ('test-head')")

    return main_module


@pytest.fixture
def client(app_module):
    with TestClient(app_module.app) as test_client:
        yield test_client


@pytest.fixture
def upload_dir(app_module) -> Path:
    config_module = importlib.import_module("app.config")
    return Path(config_module.settings.upload_dir)
