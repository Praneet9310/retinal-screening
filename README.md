# 👁️ Retinal Diagnostics AI

**Explainable AI-powered retinal disease classification system** using EfficientNet-B4 and Grad-CAM, with real-time live camera screening.

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
- 📹 **Live Retinal Monitor** — real-time camera capture with manual or auto-scan (every 4s) modes
- 🔥 **Grad-CAM Explainability** — visual heatmap overlay showing which regions drove the prediction
- 📊 **Confidence Scoring** — per-prediction confidence percentage with risk-level banding
- 🗄️ **Scan History** — total scans processed, persisted via PostgreSQL
- 📱 **Responsive UI** — works across desktop and mobile

## Tech Stack

**Frontend**
- Next.js (App Router) + TypeScript
- React
- Axios
- Deployed on [Vercel](https://vercel.com)

**Backend**
- FastAPI (Python)
- TensorFlow / EfficientNet-B4 (classification model)
- Grad-CAM (explainability)
- PostgreSQL (scan record storage)
- Deployed on [Render](https://render.com)

**Infra**
- Docker / docker-compose (local orchestration)
- GitHub Actions-ready structure

## Architecture

```
┌─────────────────┐         ┌──────────────────┐         ┌──────────────┐
│  Next.js Frontend │  ───▶  │  FastAPI Backend   │  ───▶  │  PostgreSQL   │
│  (Vercel)          │  ◀──   │  (Render)          │  ◀──   │  (Render)     │
└─────────────────┘         └──────────────────┘         └──────────────┘
        │                            │
        │                            ▼
        │                   EfficientNet-B4 + Grad-CAM
        ▼                     (TensorFlow inference)
  getUserMedia (Live Camera)
```

## Project Structure

```
retinal-screening/
├── frontend/           # Next.js app
│   ├── app/             # App Router pages
│   ├── components/      # UI components (Uploader, LiveMonitor, etc.)
│   └── .env.local        # NEXT_PUBLIC_API_URL
├── backend/            # FastAPI service
│   ├── main.py           # API entrypoint
│   ├── models/           # ML model + Grad-CAM logic
│   └── requirements.txt
├── docker-compose.yml
├── .gitignore
└── README.md
```

## Getting Started

### Prerequisites
- Node.js 18+
- Python 3.9+
- PostgreSQL (or use the Dockerized version)

### Backend Setup

```bash
cd backend
python -m venv venv
venv\Scripts\activate        # Windows
pip install -r requirements.txt
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

## API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/predict` | Upload an image, returns disease class, confidence, and risk level |
| `GET` | `/stats` | Returns total scans processed |

## Disclaimer

⚠️ This tool is for **research and educational purposes only**. It is **not a certified clinical diagnostic device** and should not be used as a substitute for professional medical evaluation.

## Author

**Praneet S**
- GitHub: [@Praneet9310](https://github.com/Praneet9310)
- LinkedIn: [praneet-s](https://linkedin.com/in/praneet-s-344740329)
