from pydantic import BaseModel
from typing import Any, Optional

class APIResponse(BaseModel):
    """
    Standard API response format.
    EVERY endpoint MUST return this.
    """
    data: Optional[Any] = None
    error: Optional[str] = None
    message: str = "Success"
    
    class Config:
        json_schema_extra = {
            "example": {
                "data": {"user_id": "123", "email": "user@example.com"},
                "error": None,
                "message": "User created successfully"
            }
        }
