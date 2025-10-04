from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from database import get_db
from models import Expense, User, UserRole, ExpenseStatus
from pydantic import BaseModel
from datetime import datetime

router = APIRouter()

# Pydantic models for request/response
class ExpenseCreate(BaseModel):
    amount: float
    currency: str = "USD"
    date: datetime
    description: str

class ExpenseResponse(BaseModel):
    id: int
    amount: float
    currency: str
    date: datetime
    description: str
    status: ExpenseStatus
    owner_id: int
    
    class Config:
        from_attributes = True

# Mock function to get current user (for now returns user_id=1)
def get_current_user_id():
    """Mock function to get current user ID - returns 1 for now"""
    return 1

# Mock function to check if user is admin (for now returns True for user_id=1)
def is_admin(user_id: int = 1):
    """Mock function to check if user is admin - returns True for user_id=1 for now"""
    return True

@router.post("/", response_model=ExpenseResponse)
async def create_expense(expense: ExpenseCreate, db: Session = Depends(get_db)):
    """Create a new expense"""
    # Get current user ID (mocked as 1 for now)
    current_user_id = get_current_user_id()
    
    # Create new expense instance
    db_expense = Expense(
        amount=expense.amount,
        currency=expense.currency,
        date=expense.date,
        description=expense.description,
        status=ExpenseStatus.PENDING,  # Default status
        owner_id=current_user_id
    )
    
    # Add to database
    db.add(db_expense)
    db.commit()
    db.refresh(db_expense)
    
    return db_expense

@router.get("/mine", response_model=List[ExpenseResponse])
async def get_my_expenses(db: Session = Depends(get_db)):
    """Get logged-in user's expenses"""
    # Get current user ID (mocked as 1 for now)
    current_user_id = get_current_user_id()
    
    # Query expenses for the current user
    expenses = db.query(Expense).filter(Expense.owner_id == current_user_id).all()
    
    return expenses

@router.get("/all", response_model=List[ExpenseResponse])
async def get_all_expenses(db: Session = Depends(get_db)):
    """Get all expenses (Admin only)"""
    # Get current user ID (mocked as 1 for now)
    current_user_id = get_current_user_id()
    
    # Check if user is admin
    if not is_admin(current_user_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied. Admin privileges required."
        )
    
    # Query all expenses
    expenses = db.query(Expense).all()
    
    return expenses
