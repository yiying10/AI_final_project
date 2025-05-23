from sqlmodel import SQLModel, create_engine, Session
import os

db_file = os.getenv("DATABASE_URL", "sqlite:///sessions.db")
engine = create_engine(db_file, echo=False, connect_args={"check_same_thread": False})

# 啟動時建立 table
def init_db():
    SQLModel.metadata.create_all(engine)

# 取得 DB session
def get_session():
    with Session(engine) as session:
        yield session