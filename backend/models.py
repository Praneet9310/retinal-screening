from sqlalchemy import Column, Integer, String, Float, DateTime
from database import Base
import datetime

class PredictionRecord(Base):
    __tablename__ = "predictions"

    id = Column(Integer, primary_key=True, index=True)
    original_image_path = Column(String, nullable=False)
    gradcam_image_path = Column(String, nullable=False)
    predicted_class = Column(String, index=True)
    confidence_score = Column(Float)
    risk_level = Column(String)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)