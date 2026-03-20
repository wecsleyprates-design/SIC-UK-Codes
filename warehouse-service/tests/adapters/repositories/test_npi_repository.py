import pytest

from datapooler.adapters.db.models import NPIUpdateRunsDb
from datapooler.adapters.db.repositories.npi_automation_repository import (
    WAREHOUSE_TABLES,
    NPIAutomationRepository,
    NPIFileRepository,
)
from datapooler.adapters.sessions import TransactionalSessions


@pytest.fixture
def seed_npi_automation_record():
    with TransactionalSessions.get_session() as session:
        record = NPIUpdateRunsDb(
            url="http://example.com/npi_data.zip",
            pl_records=1,
            endpoint_records=1,
            othername_records=1,
            npi_records=1,
        )
        session.add(record)
        session.commit()

    yield record


@pytest.fixture(scope="module")
def npi_download_link():
    return NPIFileRepository().get_download_link()


@pytest.fixture(scope="module")
def use_file_map(npi_download_link):
    return NPIFileRepository().download(npi_download_link)


def test_npi_file_repository_download_link():
    npi_file_repo = NPIFileRepository()
    download_link = npi_file_repo.get_download_link()

    assert "https://download.cms.gov/nppes/NPPES_Data_Dissemination_" in download_link


def test_npi_file_repository_download_files(seed_npi_automation_record):
    npi_file_repo = NPIFileRepository()
    download_link = npi_file_repo.get_download_link()

    assert download_link is not None

    new_npi_run, file_map = npi_file_repo.download(download_link, seed_npi_automation_record)

    assert isinstance(new_npi_run, NPIUpdateRunsDb)
    assert new_npi_run.url == download_link

    # check that the file_map contains the expected tables in the keys
    for tbl_name, data in file_map.items():
        assert tbl_name in WAREHOUSE_TABLES
        assert isinstance(data, list)
        assert len(data) > 0


def test_npi_file_repository_download_no_previous_run():
    npi_file_repo = NPIFileRepository()
    download_link = npi_file_repo.get_download_link()

    assert download_link is not None

    new_npi_run, file_map = npi_file_repo.download(download_link)

    assert isinstance(new_npi_run, NPIUpdateRunsDb)
    assert new_npi_run.url == download_link

    # check that the file_map contains the expected tables in the keys
    for tbl_name, data in file_map.items():
        assert tbl_name in WAREHOUSE_TABLES
        assert isinstance(data, list)
        assert len(data) > 0


def test_npi_automation_repository_get_last_run(seed_npi_automation_record):
    npi_repo = NPIAutomationRepository()
    last_run = npi_repo.get_last_update_run()

    assert last_run is not None
    assert last_run.url == "http://example.com/npi_data.zip"
    assert last_run.pl_records == 1
    assert last_run.endpoint_records == 1
    assert last_run.othername_records == 1
    assert last_run.npi_records == 1


def test_npi_automation_repository_no_last_run():
    npi_repo = NPIAutomationRepository()
    last_run = npi_repo.get_last_update_run()

    assert last_run is None


def test_npi_automation_repository_add_run():
    npi_repo = NPIAutomationRepository()
    new_run = NPIUpdateRunsDb(url="http://example.com/new_npi_data.zip")

    npi_repo.add_run(new_run)

    last_run = npi_repo.get_last_update_run()

    assert last_run is not None
    assert last_run.id == 1
    assert last_run.url == "http://example.com/new_npi_data.zip"
    assert last_run.pl_records is None
    assert last_run.endpoint_records is None
    assert last_run.othername_records is None
    assert last_run.npi_records is None
    assert last_run.created_at is not None
    assert last_run.updated_at is not None


@pytest.mark.skip(reason="Only Run this Test Locally")
@pytest.mark.parametrize("table_name", WAREHOUSE_TABLES)
def test_npi_automation_repository_generate_query(use_file_map, table_name):
    npi_repo = NPIAutomationRepository()
    current_run, file_map = use_file_map

    with npi_repo._prepare_tables(table_name) as (base_table, temp_table):
        query = npi_repo._generate_merge_clause(base_table, temp_table)

        assert query is not None
        assert "MERGE INTO" in query
        assert "ON target.npi = source.npi" in query

        # columns should be quoted correctly
        assert 'target."' in query
        assert 'source."' in query
        assert 'EXCLUDED."' in query


@pytest.mark.skip(reason="Only Run this Test Locally")
@pytest.mark.parametrize("table_name", WAREHOUSE_TABLES)
def test_npi_automation_repo_load_temp_table(use_file_map, table_name):
    npi_repo = NPIAutomationRepository()
    current_run, file_map = use_file_map

    with npi_repo._prepare_tables(table_name) as (base_table, temp_table):
        count = npi_repo._load_temp_table(temp_table, file_map[table_name][0:10])
        assert count == 10
