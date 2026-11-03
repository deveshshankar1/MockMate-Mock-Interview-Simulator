from fastapi import APIRouter
from pydantic import BaseModel
from app.database import SessionLocal
from app import models
from app.security import ALGORITHM, SECRET_KEY
from pwdlib import PasswordHash
import jwt
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

router = APIRouter(prefix="/api/auth", tags=["Authentication"])

password_hash = PasswordHash.recommended()

class RegisterRequest(BaseModel):
    name: str
    email: str
    password: str


class LoginRequest(BaseModel):
    email: str
    password: str


@router.post("/register")
def register(data: RegisterRequest):
    db = SessionLocal()

    try:
        existing_user = (
            db.query(models.User)
            .filter(models.User.email == data.email)
            .first()
        )

        if existing_user:
            return {"message": "Email already registered"}

        user = models.User(
            name=data.name,
            email=data.email,
            password=password_hash.hash(data.password)
        )

        db.add(user)
        db.commit()
        db.refresh(user)

        return {
            "message": "Registration successful",
            "user": {
                "id": user.id,
                "name": user.name,
                "email": user.email
            }
        }

    finally:
        db.close()


@router.post("/login")
def login(data: LoginRequest):
    db = SessionLocal()

    try:
        user = (
            db.query(models.User)
            .filter(models.User.email == data.email)
            .first()
        )

        if not user:
            return {"message": "Invalid email or password"}

        if not password_hash.verify(data.password, user.password):
            return {"message": "Invalid email or password"}

        token_data = {
            "user_id": user.id,
            "email": user.email,
            "exp": datetime.utcnow() + timedelta(hours=2)
        }

        token = jwt.encode(
            token_data,
            SECRET_KEY,
            algorithm=ALGORITHM
        )

        return {
            "message": "Login successful",
            "access_token": token,
            "token_type": "bearer",
            "user": {
                "id": user.id,
                "name": user.name,
                "email": user.email
            }
        }

    finally:
        db.close()
security = HTTPBearer()


@router.get("/me")
def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    token = credentials.credentials

    try:
        payload = jwt.decode(
            token,
            SECRET_KEY,
            algorithms=[ALGORITHM]
        )

        return {
            "message": "Token is valid",
            "user_id": payload["user_id"],
            "email": payload["email"]
        }

    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=401,
            detail="Token has expired"
        )

    except jwt.InvalidTokenError:
        raise HTTPException(
            status_code=401,
            detail="Invalid token"
        )