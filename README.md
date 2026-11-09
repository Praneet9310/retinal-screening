# 👁️ Retinal Diagnostics AI

**Explainable AI-powered retinal disease classification system** using EfficientNet-B0 and Grad-CAM, with real-time live camera screening.

[![Live Demo](https://img.shields.io/badge/demo-live-brightgreen)](https://retinal-screening.vercel.app/)

---

## Overview

Retinal Diagnostics AI is a full-stack clinical decision-support tool that classifies fundus (retinal) images into four categories and generates a Grad-CAM heatmap explaining *why* the model made its prediction — making the AI's reasoning visible rather than a black box.

The system supports both **static image upload** and **live camera-based screening**, with results (disease class, confidence score, risk level, and recommendation) rendered in real time.

## Screened Conditions

| Condition | Risk Level |
|---|---|
| Normal Retina | Low |
| Diabetic Retinopathy | High |
| Glaucoma | High |
| Cataract | Moderate |

## Features

- 📤 **Image Upload** — upload a fundus scan for instant classification
- 📹 **Live Retinal Monitor** — real-time camera capture with manual or auto-scan modes
- 🔥 **Grad-CAM Explainability** — visual heatmap overlay showing which regions drove the prediction
- 📊 **Confidence Scoring** — per-prediction confidence percentage with risk-level banding
- 🗄️ **Scan History** — total scans processed, persisted in PostgreSQL
- 📱 **Responsive UI** — works across desktop and mobile

## Tech Stack

**Frontend**
- Next.js (App Router) + TypeScript
- React
- Axios
- Deployed on [Vercel](https://vercel.com)

**Backend**
- FastAPI (Python)
- TensorFlow / EfficientNet-B0 (classification model)
- Grad-CAM (explainability)
- PostgreSQL on [Neon](https://neon.com) (scan record storage)
- API deployed on [Render](https://render.com) (Docker)

**Infra**
- Docker / docker-compose (local orchestration)

## Architecture

```
┌──────────────────┐        ┌───────────────────┐        ┌───────────────┐
│ Next.js Frontend │  ───▶  │  FastAPI Backend  │  ───▶  │  PostgreSQL   │
│    (Vercel)      │  ◀───  │     (Render)      │  ◀───  │    (Neon)     │
└──────────────────┘        └───────────────────┘        └───────────────┘
        │                             │
        │                             ▼
        │                   EfficientNet-B0 + Grad-CAM
        ▼                    (TensorFlow inference)
 getUserMedia (Live Camera)
```

## Model

- **Backbone:** EfficientNet-B0 (ImageNet pretrained), 224×224 input
- **Head:** GlobalAveragePooling → BatchNorm → Dropout → Dense(256) → BatchNorm → Dropout → Softmax(4)
- **Training:** two phases — (1) train the head with the base frozen, (2) fine-tune the top blocks with BatchNorm layers kept frozen
- **Augmentation:** rotation, shifts, shear, zoom, horizontal flip, brightness

## Dataset Setup

Trained on the [Eye Diseases Classification](https://www.kaggle.com/datasets/gunavenkatdoddi/eye-diseases-classification) dataset (Normal, Diabetic Retinopathy, Glaucoma, Cataract; ~4,200 fundus images). The images are **not stored in this repo**.

1. Install the Kaggle CLI and add your API token (`pip install kaggle`)
2. Download and extract into `backend/dataset/`:
   ```bash
   cd backend
   kaggle datasets download -d gunavenkatdoddi/eye-diseases-classification
   ```
3. Make sure these four folders sit directly inside `backend/dataset/`:
   `Normal Retina`, `Diabetic Retinopathy`, `Glaucoma`, `Cataract`
4. Train:
   ```bash
   python train.py
   ```
   The best model is saved to `backend/weights/retina_model.h5`.

## Project Structure

```
retinal-screening/
├── frontend/             # Next.js app
│   ├── app/              # App Router pages
│   ├── components/       # UI components (Uploader, LiveMonitor, etc.)
│   └── .env.local        # NEXT_PUBLIC_API_URL (not committed)
├── backend/              # FastAPI service
│   ├── main.py           # API entrypoint
│   ├── ai_engine.py      # Model loading, inference, Grad-CAM
│   ├── database.py       # Database connection
│   ├── models.py         # SQLAlchemy models
│   ├── train.py          # Model training script
│   ├── Dockerfile
│   └── requirements.txt
├── docker-compose.yml
├── .gitignore
└── README.md
```

## Getting Started

### Prerequisites
- Node.js 18+
- Python 3.9 (TensorFlow 2.13 does not support newer Python versions)
- A PostgreSQL database (e.g. a free [Neon](https://neon.com) project)

### Backend Setup

```bash
cd backend
py -3.9 -m venv venv
venv\Scripts\activate        # Windows
pip install -r requirements.txt
```

Set your database connection string, then run:
```bash
set DATABASE_URL=postgresql://user:password@host/dbname?sslmode=require
uvicorn main:app --reload --port 8000
```

### Frontend Setup

```bash
cd frontend
npm install
```

Create `frontend/.env.local`:
```
NEXT_PUBLIC_API_URL=http://localhost:8000
```

Then run:
```bash
npm run dev
```

Visit `http://localhost:3000`.

### Docker (optional)

```bash
docker-compose up --build
```

## Environment Variables

| Variable | Where | Description |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | Frontend | URL of the deployed/local FastAPI backend |
| `DATABASE_URL` | Backend | PostgreSQL connection string (Neon) |

Never commit real connection strings or credentials.

## API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/predict` | Upload an image, returns disease class, confidence, and risk level |
| `GET` | `/stats` | Returns total scans processed |

## Limitations

- Trained on a modest public dataset (~4,200 images) aggregated from several sources, so performance on images from other cameras may vary
- Hosted on free tiers: the backend may take up to a minute to wake after idle periods
- Uploaded scan images are stored on the API server's local disk and may be cleared when the service restarts

## Disclaimer

⚠️ This tool is for **research and educational purposes only**. It is **not a certified clinical diagnostic device** and should not be used as a substitute for professional medical evaluation.

## Author

**Praneet S**
- GitHub: [@Praneet9310](https://github.com/Praneet9310)
- LinkedIn: [praneet-s](https://linkedin.com/in/praneet-s-344740329)
