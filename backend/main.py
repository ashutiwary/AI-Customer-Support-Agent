from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse

from api.models import RefundRequest, ChatRequest
from api.refund import process_refund
from api.chat import process_chat, stream_chat
from api.admin import get_admin_sessions
from api.voice import create_voice_token

app = FastAPI(
    title="AI Refund Agent"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def home():
    return {
        "message": "AI Refund Agent Running"
    }

@app.post("/refund")
def refund(request: RefundRequest):
    return process_refund(request)

@app.post("/chat")
def chat(request: ChatRequest):
    return process_chat(request)

@app.post("/chat/stream")
def chat_stream(request: ChatRequest):
    return StreamingResponse(stream_chat(request), media_type="application/x-ndjson")

@app.get("/admin/sessions")
def admin_sessions(limit: int = 100):
    return get_admin_sessions(limit=limit)

@app.get("/voice/token")
def voice_token():
    return create_voice_token()