from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from database import engine, Base, create_tables
from routers import users, expenses, approvals

# Create database tables
create_tables()

# Initialize FastAPI app
app = FastAPI(
    title="Expense Management System API",
    description="Backend API for expense management system",
    version="1.0.0"
)

# Add CORS middleware for React frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5173"],  # React dev servers
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE"],
    allow_headers=["*"],
)

# Include routers
app.include_router(users.router, prefix="/api/users", tags=["users"])
app.include_router(expenses.router, prefix="/api/expenses", tags=["expenses"])
app.include_router(approvals.router, prefix="/api/approvals", tags=["approvals"])

@app.get("/")
async def root():
    return {
        "message": "Expense Management System API",
        "version": "1.0.0",
        "docs": "/docs",
        "endpoints": {
            "users": "/api/users",
            "expenses": "/api/expenses", 
            "approvals": "/api/approvals"
        }
    }

@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "database": "connected",
        "tables_created": True
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000, reload=True)
