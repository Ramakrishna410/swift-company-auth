from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from database import get_db
from models import Expense, User, UserRole, ExpenseStatus
from pydantic import BaseModel
from datetime import datetime

router = APIRouter()

# Pydantic models for request/response
class ExpenseApprovalResponse(BaseModel):
    id: int
    amount: float
    currency: str
    date: datetime
    description: str
    status: ExpenseStatus
    owner_id: int
    owner_name: str
    
    class Config:
        from_attributes = True

class ApprovalDecision(BaseModel):
    status: ExpenseStatus  # Approved or Rejected
    comments: str = None

# Mock function to get current user (for now returns user_id=1)
def get_current_user_id():
    """Mock function to get current user ID - returns 1 for now"""
    return 1

# Mock function to check if user is manager or admin (for now returns True for user_id=1)
def is_manager_or_admin(user_id: int = 1):
    """Mock function to check if user is manager or admin - returns True for user_id=1 for now"""
    return True

@router.get("/pending", response_model=List[ExpenseApprovalResponse])
async def get_pending_expenses(db: Session = Depends(get_db)):
    """Get all expenses with status Pending"""
    # Get current user ID (mocked as 1 for now)
    current_user_id = get_current_user_id()
    
    # Check if user is manager or admin
    if not is_manager_or_admin(current_user_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied. Manager or Admin privileges required."
        )
    
    # Query expenses with pending status and include owner information
    expenses = db.query(Expense, User).join(User, Expense.owner_id == User.id).filter(
        Expense.status == ExpenseStatus.PENDING
    ).all()
    
    # Format response with owner name
    result = []
    for expense, owner in expenses:
        expense_dict = {
            "id": expense.id,
            "amount": expense.amount,
            "currency": expense.currency,
            "date": expense.date,
            "description": expense.description,
            "status": expense.status,
            "owner_id": expense.owner_id,
            "owner_name": owner.name
        }
        result.append(expense_dict)
    
    return result

@router.post("/{expense_id}")
async def approve_or_reject_expense(expense_id: int, decision: ApprovalDecision, db: Session = Depends(get_db)):
    """Approve or reject an expense"""
    # Get current user ID (mocked as 1 for now)
    current_user_id = get_current_user_id()
    
    # Check if user is manager or admin
    if not is_manager_or_admin(current_user_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied. Manager or Admin privileges required."
        )
    
    # Find the expense
    expense = db.query(Expense).filter(Expense.id == expense_id).first()
    
    if not expense:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Expense not found"
        )
    
    # Check if expense is still pending
    if expense.status != ExpenseStatus.PENDING:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Expense is already {expense.status.value.lower()}"
        )
    
    # Update the expense status
    expense.status = decision.status
    
    # Commit changes
    db.commit()
    db.refresh(expense)
    
    # Return success response
    return {
        "message": f"Expense {decision.status.value.lower()} successfully",
        "expense_id": expense_id,
        "new_status": decision.status.value,
        "comments": decision.comments
    }
