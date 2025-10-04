from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from database import get_db
from models import User, UserRole
from pydantic import BaseModel

router = APIRouter()

# Pydantic models for request/response
class UserCreate(BaseModel):
    name: str
    role: UserRole = UserRole.EMPLOYEE

class UserResponse(BaseModel):
    id: int
    name: str
    role: UserRole
    
    class Config:
        from_attributes = True

class UserRoleUpdate(BaseModel):
    role: UserRole

@router.get("/", response_model=List[UserResponse])
async def get_users(db: Session = Depends(get_db)):
    """Get all users"""
    users = db.query(User).all()
    return users

@router.post("/", response_model=UserResponse)
async def create_user(user: UserCreate, db: Session = Depends(get_db)):
    """Create a new user"""
    # Create new user instance
    db_user = User(
        name=user.name,
        role=user.role
    )
    
    # Add to database
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    
    return db_user

@router.patch("/{user_id}/role", response_model=UserResponse)
async def update_user_role(user_id: int, role_update: UserRoleUpdate, db: Session = Depends(get_db)):
    """Update user role"""
    # Find the user
    user = db.query(User).filter(User.id == user_id).first()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    # Update the role
    user.role = role_update.role
    
    # Commit changes
    db.commit()
    db.refresh(user)
    
    return user
