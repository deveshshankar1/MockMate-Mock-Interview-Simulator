from pathlib import Path
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException
from fastapi import File, UploadFile
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
from sqlalchemy.exc import SQLAlchemyError
from app.database import SessionLocal
from app import models
from app.security import ALGORITHM, SECRET_KEY
import jwt

router = APIRouter(prefix="/api/profile", tags=["Profile"])

security = HTTPBearer()

PROFILE_PICTURE_DIR = Path(__file__).resolve().parent.parent / "uploads" / "profile-pictures"
PROFILE_PICTURE_DIR.mkdir(parents=True, exist_ok=True)
MAX_PROFILE_PICTURE_SIZE = 5 * 1024 * 1024
IMAGE_SIGNATURES = {
    b"\x89PNG\r\n\x1a\n": ("png", "image/png"),
    b"\xff\xd8\xff": ("jpg", "image/jpeg"),
    b"RIFF": ("webp", "image/webp"),
}


class ProfileRequest(BaseModel):
    phone: str
    skills: str
    education: str
    experience: str
    resume: str = ""


def get_user_id(
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    try:
        payload = jwt.decode(
            credentials.credentials,
            SECRET_KEY,
            algorithms=[ALGORITHM]
        )

        return payload["user_id"]

    except jwt.InvalidTokenError:
        raise HTTPException(
            status_code=401,
            detail="Invalid token"
        )


@router.post("")
def create_profile(
    data: ProfileRequest,
    user_id: int = Depends(get_user_id)
):
    db = SessionLocal()

    try:
        existing = (
            db.query(models.CandidateProfile)
            .filter(models.CandidateProfile.user_id == user_id)
            .first()
        )

        if existing:
            existing.phone = data.phone
            existing.skills = data.skills
            existing.education = data.education
            existing.experience = data.experience
            existing.resume = data.resume

            db.commit()
            db.refresh(existing)

            return {
                "message": "Profile updated successfully",
                "profile": {
                    "id": existing.id,
                    "user_id": existing.user_id,
                    "phone": existing.phone,
                    "skills": existing.skills,
                    "education": existing.education,
                    "experience": existing.experience,
                    "resume": existing.resume,
                    "profile_picture_url": existing.profile_picture_url,
                },
            }

        profile = models.CandidateProfile(
            user_id=user_id,
            phone=data.phone,
            skills=data.skills,
            education=data.education,
            experience=data.experience,
            resume=data.resume,
        )

        db.add(profile)
        db.commit()
        db.refresh(profile)

        return {
            "message": "Profile created successfully",
            "profile": {
                "id": profile.id,
                "user_id": profile.user_id,
                "phone": profile.phone,
                "skills": profile.skills,
                "education": profile.education,
                "experience": profile.experience,
                "resume": profile.resume,
                "profile_picture_url": profile.profile_picture_url,
            },
        }

    finally:
        db.close()


@router.get("")
def get_profile(
    user_id: int = Depends(get_user_id)
):
    db = SessionLocal()

    try:
        profile = (
            db.query(models.CandidateProfile)
            .filter(models.CandidateProfile.user_id == user_id)
            .first()
        )

        if not profile:
            raise HTTPException(
                status_code=404,
                detail="Profile not found"
            )

        return {
            "id": profile.id,
            "user_id": profile.user_id,
            "phone": profile.phone,
            "skills": profile.skills,
            "education": profile.education,
            "experience": profile.experience,
            "resume": profile.resume,
            "profile_picture_url": profile.profile_picture_url,
        }

    finally:
        db.close()


@router.post("/picture")
async def upload_profile_picture(
    file: UploadFile = File(...),
    user_id: int = Depends(get_user_id),
):
    contents = await file.read(MAX_PROFILE_PICTURE_SIZE + 1)
    if len(contents) > MAX_PROFILE_PICTURE_SIZE:
        raise HTTPException(status_code=413, detail="Profile picture must be 5 MB or smaller")

    image_format = next(
        (
            format_info
            for signature, format_info in IMAGE_SIGNATURES.items()
            if contents.startswith(signature)
        ),
        None,
    )
    if image_format is None or (
        image_format[0] == "webp"
        and contents[8:12] != b"WEBP"
    ):
        raise HTTPException(status_code=400, detail="Upload a valid PNG, JPEG, or WEBP image")

    extension, _ = image_format
    filename = f"{uuid4().hex}.{extension}"
    file_path = PROFILE_PICTURE_DIR / filename
    file_path.write_bytes(contents)

    db = SessionLocal()
    try:
        profile = (
            db.query(models.CandidateProfile)
            .filter(models.CandidateProfile.user_id == user_id)
            .first()
        )
        if profile is None:
            profile = models.CandidateProfile(
                user_id=user_id,
                phone="",
                skills="",
                education="",
                experience="",
                resume="",
            )
            db.add(profile)

        profile.profile_picture_url = f"/uploads/profile-pictures/{filename}"
        db.commit()
        return {
            "message": "Profile picture uploaded successfully",
            "profile_picture_url": profile.profile_picture_url,
        }
    except SQLAlchemyError:
        db.rollback()
        file_path.unlink(missing_ok=True)
        raise
    finally:
        db.close()


@router.put("")
def update_profile(
    data: ProfileRequest,
    user_id: int = Depends(get_user_id)
):
    db = SessionLocal()

    try:
        profile = (
            db.query(models.CandidateProfile)
            .filter(models.CandidateProfile.user_id == user_id)
            .first()
        )

        if not profile:
            raise HTTPException(
                status_code=404,
                detail="Profile not found"
            )

        profile.phone = data.phone
        profile.skills = data.skills
        profile.education = data.education
        profile.experience = data.experience
        profile.resume = data.resume

        db.commit()
        db.refresh(profile)

        return {
            "message": "Profile updated successfully",
            "profile": {
                "id": profile.id,
                "user_id": profile.user_id,
                "phone": profile.phone,
                "skills": profile.skills,
                "education": profile.education,
                "experience": profile.experience,
                "resume": profile.resume,
                "profile_picture_url": profile.profile_picture_url,
            }
        }

    finally:
        db.close()