import os

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker


@pytest.fixture
def db_session():
    url = os.environ.get(
        "DATABASE_URL",
        "postgresql+psycopg://bigdata:bigdata@localhost:5433/bigdata",
    )
    engine = create_engine(url)
    session = sessionmaker(bind=engine)()
    try:
        yield session
    finally:
        session.rollback()
        session.close()
        engine.dispose()
