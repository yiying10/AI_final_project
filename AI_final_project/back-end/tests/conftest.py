# backend/tests/conftest.py

import pytest
from backend.app.database import init_db

@pytest.fixture(autouse=True, scope="session")
def prepare_database():
    # 測試一開始就建好所有 table
    init_db()
