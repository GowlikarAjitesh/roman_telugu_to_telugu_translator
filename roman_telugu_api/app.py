import json
import os
import re
from pathlib import Path
from typing import Annotated

import torch
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from fastapi.staticfiles import StaticFiles

BASE_DIR = Path(__file__).resolve().parent
ARTIFACT_DIR = Path(os.getenv("ARTIFACT_DIR", BASE_DIR / "artifacts"))
WEB_DIR = BASE_DIR / "web"
CHECKPOINT_PATH = ARTIFACT_DIR / "seq2seq.pt"
VOCAB_PATH = ARTIFACT_DIR / "vocab.json"
MODEL_REPO_ID = os.getenv(
    "MODEL_REPO_ID", "ajiteshkittu/romanTeluguToTeluguTranslator"
)
TOKEN_PATTERN = re.compile(r'([.,!?;:"\'()\[\]{}\-—…])')
DEVICE = torch.device("cpu")


def tokenize(text: str) -> list[str]:
    return re.sub(TOKEN_PATTERN, r" \1 ", text).split()


class Encoder(torch.nn.Module):
    def __init__(self, vocab_size: int, embedding_dim: int, hidden_dim: int):
        super().__init__()
        self.embedding = torch.nn.Embedding(vocab_size, embedding_dim, padding_idx=0)
        self.lstm = torch.nn.LSTM(embedding_dim, hidden_dim, batch_first=True)

    def forward(self, source: torch.Tensor):
        embedded = self.embedding(source)
        return self.lstm(embedded)


class Decoder(torch.nn.Module):
    def __init__(self, vocab_size: int, embedding_dim: int, hidden_dim: int):
        super().__init__()
        self.embedding = torch.nn.Embedding(vocab_size, embedding_dim, padding_idx=0)
        self.lstm = torch.nn.LSTM(embedding_dim, hidden_dim, batch_first=True)
        self.fc_out = torch.nn.Linear(hidden_dim, vocab_size)

    def forward(self, token: torch.Tensor, hidden, cell):
        embedded = self.embedding(token)
        outputs, (hidden, cell) = self.lstm(embedded, (hidden, cell))
        return self.fc_out(outputs), hidden, cell


class Seq2Seq(torch.nn.Module):
    def __init__(self, config: dict):
        super().__init__()
        self.encoder = Encoder(
            config["input_vocab_size"], config["embedding_dim"], config["hidden_dim"]
        )
        self.decoder = Decoder(
            config["output_vocab_size"], config["embedding_dim"], config["hidden_dim"]
        )


if not CHECKPOINT_PATH.is_file():
    from huggingface_hub import hf_hub_download

    CHECKPOINT_PATH = Path(
        hf_hub_download(
            repo_id=MODEL_REPO_ID,
            repo_type="space",
            filename="artifacts/seq2seq.pt",
        )
    )

if not VOCAB_PATH.is_file():
    from huggingface_hub import hf_hub_download

    VOCAB_PATH = Path(
        hf_hub_download(
            repo_id=MODEL_REPO_ID,
            repo_type="space",
            filename="artifacts/vocab.json",
        )
    )

with CHECKPOINT_PATH.open("rb") as file:
    checkpoint = torch.load(file, map_location=DEVICE, weights_only=True)
with VOCAB_PATH.open(encoding="utf-8") as file:
    vocabs = json.load(file)

config = checkpoint["config"]
roman_tokens = vocabs["roman"]
telugu_tokens = vocabs["telugu"]
roman_to_id = {token: i for i, token in enumerate(roman_tokens)}
special = vocabs["special_tokens"]
model = Seq2Seq(config).to(DEVICE)
model.load_state_dict(checkpoint["state_dict"])
model.eval()

app = FastAPI(title="Roman Telugu Translator", version="1.0.0")
allowed_origins = [origin.strip() for origin in os.getenv("CORS_ORIGINS", "*").split(",")]
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type"],
)


class TranslateRequest(BaseModel):
    text: Annotated[str, Field(min_length=1, max_length=4000)]


@app.get("/health")
def health():
    return {"status": "ok", "device": str(DEVICE)}


@app.post("/translate")
def translate(request: TranslateRequest):
    source_tokens = tokenize(request.text)
    if not source_tokens:
        raise HTTPException(status_code=400, detail="Text contains no tokens")
    max_length = int(config["max_length"])
    if len(source_tokens) > max_length:
        raise HTTPException(
            status_code=400,
            detail=f"Input has {len(source_tokens)} tokens; maximum is {max_length}",
        )

    unknown_id = roman_to_id[special["unk"]]
    source_ids = [roman_to_id.get(token, unknown_id) for token in source_tokens]
    source = torch.tensor([source_ids], dtype=torch.long, device=DEVICE)
    generated = []

    with torch.inference_mode():
        _, (hidden, cell) = model.encoder(source)
        current = torch.tensor([[telugu_tokens.index(special["sos"])]], dtype=torch.long)
        eos_id = telugu_tokens.index(special["eos"])
        blocked_ids = {
            telugu_tokens.index(special["pad"]),
            telugu_tokens.index(special["sos"]),
        }

        for _ in range(max_length):
            logits, hidden, cell = model.decoder(current, hidden, cell)
            next_id = int(logits[0, -1].argmax().item())
            if next_id == eos_id:
                break
            if next_id not in blocked_ids:
                generated.append(telugu_tokens[next_id])
            current = torch.tensor([[next_id]], dtype=torch.long)
        generated = [token for token in generated if token != special["unk"]]
    return {"translation": " ".join(generated)}


app.mount("/", StaticFiles(directory=WEB_DIR, html=True), name="web")


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        app,
        host=os.getenv("HOST", "0.0.0.0"),
        port=int(os.getenv("PORT", "7860")),
    )
