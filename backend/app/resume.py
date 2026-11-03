from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from app.database import SessionLocal
from app import models
from app.security import ALGORITHM, SECRET_KEY
import jwt
import os
from pypdf import PdfReader
from docx import Document

router = APIRouter(prefix="/api/resume", tags=["Resume"])

security = HTTPBearer()

UPLOAD_DIR = "uploads/resumes"
os.makedirs(UPLOAD_DIR, exist_ok=True)


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


def extract_pdf_text(file_path):
    reader = PdfReader(file_path)

    text = ""

    for page in reader.pages:
        text += page.extract_text() or ""

    return text


def extract_docx_text(file_path):
    document = Document(file_path)

    return "\n".join(
        paragraph.text
        for paragraph in document.paragraphs
    )


@router.post("/upload")
async def upload_resume(
    file: UploadFile = File(...),
    user_id: int = Depends(get_user_id)
):
    if not file.filename.lower().endswith((".pdf", ".docx")):
        raise HTTPException(
            status_code=400,
            detail="Only PDF and DOCX files are allowed"
        )

    file_path = os.path.join(
        UPLOAD_DIR,
        f"{user_id}_{file.filename}"
    )

    contents = await file.read()

    with open(file_path, "wb") as buffer:
        buffer.write(contents)

    if file.filename.lower().endswith(".pdf"):
        extracted_text = extract_pdf_text(file_path)
    else:
        extracted_text = extract_docx_text(file_path)

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
                resume=file.filename,
            )
            db.add(profile)
        else:
            profile.resume = file.filename

        resume = models.Resume(
            user_id=user_id,
            filename=file.filename,
            file_path=file_path,
            extracted_text=extracted_text
        )

        db.add(resume)
        db.commit()
        db.refresh(resume)

        return {
            "message": "Resume uploaded successfully",
            "resume_id": resume.id,
            "filename": resume.filename,
            "text_length": len(extracted_text),
            "extracted_text": extracted_text
        }

    finally:
        db.close()


@router.get("/latest")
def get_latest_resume(user_id: int = Depends(get_user_id)):
    db = SessionLocal()

    try:
        resume = (
            db.query(models.Resume)
            .filter(models.Resume.user_id == user_id)
            .order_by(models.Resume.id.desc())
            .first()
        )
        if resume is None:
            raise HTTPException(status_code=404, detail="No resume has been uploaded")

        return {
            "resume_id": resume.id,
            "filename": resume.filename,
            "text_length": len(resume.extracted_text or ""),
            "extracted_text": resume.extracted_text or "",
        }
    finally:
        db.close()