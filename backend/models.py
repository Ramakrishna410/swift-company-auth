from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Text, Enum
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from database import Base
import enum

class UserRole(enum.Enum):
    """Enum for user roles"""
    EMPLOYEE = "Employee"
    MANAGER = "Manager"
    ADMIN = "Admin"

class ExpenseStatus(enum.Enum):
    """Enum for expense status"""
    PENDING = "Pending"
    APPROVED = "Approved"
    REJECTED = "Rejected"

class User(Base):
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    role = Column(Enum(UserRole), default=UserRole.EMPLOYEE, nullable=False)
    
    # Relationships
    expenses = relationship("Expense", back_populates="owner", cascade="all, delete-orphan")
    
    def __repr__(self):
        return f"<User(id={self.id}, name='{self.name}', role='{self.role.value}')>"

class Expense(Base):
    __tablename__ = "expenses"
    
    id = Column(Integer, primary_key=True, index=True)
    amount = Column(Float, nullable=False)
    currency = Column(String(3), default="USD", nullable=False)  # ISO currency code
    date = Column(DateTime(timezone=True), nullable=False)
    description = Column(Text, nullable=False)
    status = Column(Enum(ExpenseStatus), default=ExpenseStatus.PENDING, nullable=False)
    owner_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    
    # Relationships
    owner = relationship("User", back_populates="expenses")
    
    def __repr__(self):
        return f"<Expense(id={self.id}, amount={self.amount} {self.currency}, status='{self.status.value}', owner_id={self.owner_id})>"
