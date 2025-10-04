from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
import os

# Database URL - using SQLite for development
DATABASE_URL = "sqlite:///./expense_management.db"

# Create SQLAlchemy engine with proper configuration for SQLite
engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False},  # Needed for SQLite
    echo=True,  # Set to False in production for better performance
    pool_pre_ping=True,  # Verify connections before use
)

# Create SessionLocal class
SessionLocal = sessionmaker(
    autocommit=False, 
    autoflush=False, 
    bind=engine
)

# Create Base class for models
Base = declarative_base()

# Dependency to get database session
def get_db():
    """
    Dependency function that provides a database session.
    Ensures proper session cleanup after use.
    """
    db = SessionLocal()
    try:
        yield db
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()

# Function to create all tables
def create_tables():
    """Create all database tables"""
    Base.metadata.create_all(bind=engine)

# Function to drop all tables (useful for testing)
def drop_tables():
    """Drop all database tables"""
    Base.metadata.drop_all(bind=engine)
