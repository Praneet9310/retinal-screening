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
