from fastapi import FastAPI, File, UploadFile, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy.orm import Session
from database import engine, Base, get_db
import models
import ai_engine
import shutil
import os
import uuid

Base.metadata.create_all(bind=engine)

app = FastAPI(title="Retinal AI Screening API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
    "https://retinal-screening.vercel.app",
    "https://retinal-disease-screening-system.vercel.app",
    "http://localhost:3000",
],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

UPLOAD_DIR = "static/uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)
app.mount("/static", StaticFiles(directory="static"), name="static")

@app.get("/health")
def health_check():
    return {"status": "healthy", "model_loaded": ai_engine.model is not None}

@app.post("/predict")
async def predict_disease(file: UploadFile = File(...), db: Session = Depends(get_db)):
    if not file.content_type.startswith("image/"):
        raise HTTPException(400, detail="Invalid file type")

    file_id = str(uuid.uuid4())
    ext = file.filename.split(".")[-1]
    raw_path = os.path.join(UPLOAD_DIR, f"{file_id}_raw.{ext}")

    with open(raw_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    pred_class, confidence, gradcam_path = ai_engine.generate_explainable_image(raw_path, UPLOAD_DIR)
    risk_level = ai_engine.get_risk_level(pred_class, confidence)

    record = models.PredictionRecord(
        original_image_path=raw_path,
        gradcam_image_path=gradcam_path,
        predicted_class=pred_class,
        confidence_score=confidence,
        risk_level=risk_level
    )
    db.add(record)
    db.commit()
    db.refresh(record)

    return {
        "id": record.id,
        "disease": pred_class,
        "confidence": confidence,
        "risk_level": risk_level,
        "original_url": f"/{raw_path}",
        "gradcam_url": f"/{gradcam_path}"
    }

@app.get("/history")
def get_history(limit: int = 10, db: Session = Depends(get_db)):
    records = db.query(models.PredictionRecord).order_by(
        models.PredictionRecord.created_at.desc()
    ).limit(limit).all()
    return records
    @app.get("/stats")
def get_stats(db: Session = Depends(get_db)):
    total_scans = db.query(models.PredictionRecord).count()
    return {"total_scans": total_scans}