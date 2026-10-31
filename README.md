---
title: Roman Telugu Translator API
sdk: docker
app_port: 7860
---
# Roman Telugu → Telugu Translator

This Docker app serves both the browser text editor at `/` and the inference API from the same origin. It uses the exported LSTM Seq2Seq checkpoint hosted in the public Hugging Face Space `ajiteshkittu/romanTeluguToTeluguTranslator`; `huggingface_hub` downloads it automatically if it is not present locally. The token vocabularies are included in `artifacts/vocab.json`.

## Local run

Use Python 3.11 and install the CPU PyTorch wheel plus API dependencies:

```bash
pip install --index-url https://download.pytorch.org/whl/cpu torch==2.5.1
pip install -r requirements.txt
# Either command starts the app; app.py downloads the missing checkpoint first.
python app.py
# Or run it with Uvicorn directly:
uvicorn app:app --host 0.0.0.0 --port 7860
```

Health check: `GET http://localhost:7860/health`

Translate: `POST http://localhost:7860/translate` with JSON `{"text":"nuvu ela unnav?"}`.

## Deploy the combined app

The existing Space `ajiteshkittu/romanTeluguToTeluguTranslator` can host this app as a Docker Space. First authenticate the Hugging Face CLI with `hf auth login` (complete the browser sign-in locally; do not share an access token). Then upload this folder to the Space root:

```bash
hf upload ajiteshkittu/romanTeluguToTeluguTranslator /home/cs24m118/practice/projects/p1/roman_telugu_api . --repo-type space --exclude "artifacts/roman_telugu_model.zip" --exclude "**/__pycache__/**" --commit-message "Deploy translator editor and API"
```

The Docker metadata and configuration are already in this README and `Dockerfile`; the upload changes the existing Space from Static to Docker. Space builds can take several minutes because the CPU PyTorch wheel is large. Once the Space is running, open its public Space URL to use the editor; `/health` and `/docs` expose API status and interactive docs.

The editor uses the same-origin API by default, so no separate Vercel deployment or CORS configuration is required. The 201 MiB PyTorch checkpoint is kept outside GitHub's normal file storage and fetched from the public Hugging Face Space; Vercel can still host the frontend separately if desired.

## Request/response

`POST /translate` accepts `{ "text": "..." }` and returns `{ "translation": "..." }`. Inputs are limited to 4,000 characters and 40 tokens. `GET /docs` provides interactive API docs.

This export is the notebook's current model and vocabulary. The notebook's latest recorded losses were train `3.7351` and validation `2.6123`; treat output quality as experimental and evaluate further before relying on it.

## Frontend editor

The responsive static browser editor is in [`web/`](web/README.md). It supports paste/type, translation, copy, an example, clearing, and Ctrl/⌘+Enter. Its API URL can be changed under Connection settings; when the page is hosted alongside the API, the same-origin URL is used automatically.
