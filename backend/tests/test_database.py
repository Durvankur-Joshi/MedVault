"""Tests 38–40: Database and Alembic migration tests."""

from sqlalchemy import inspect

from tests.conftest import engine


EXPECTED_TABLES = [
    "users",
    "patients",
    "hospitals",
    "doctors",
    "medical_records",
    "consents",
    "access_requests",
    "audit_logs",
]


# --- Test 38: All tables created by metadata.create_all (simulates upgrade) ---
def test_tables_created(db):
    """Verify that metadata.create_all creates all expected tables (reset_database fixture)."""
    inspector = inspect(engine)
    tables = inspector.get_table_names()
    for table in EXPECTED_TABLES:
        assert table in tables, f"Table '{table}' not found. Got: {tables}"


# --- Test 39: Tables can be dropped (simulates downgrade) ---
def test_tables_dropped():
    """Verify that metadata.drop_all removes all tables (happens in fixture teardown)."""
    from app.models import Base

    # Create then drop
    Base.metadata.create_all(bind=engine)
    Base.metadata.drop_all(bind=engine)
    inspector = inspect(engine)
    tables = inspector.get_table_names()
    for table in EXPECTED_TABLES:
        assert table not in tables, f"Table '{table}' still exists after drop"


# --- Test 40: All expected tables exist ---
def test_all_expected_tables_exist(db):
    """Comprehensive check that all 8 model tables are present."""
    inspector = inspect(engine)
    tables = set(inspector.get_table_names())
    missing = [t for t in EXPECTED_TABLES if t not in tables]
    assert not missing, f"Missing tables: {missing}"
    assert len(tables & set(EXPECTED_TABLES)) == len(EXPECTED_TABLES)
