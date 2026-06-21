from typing import Literal

from pydantic import BaseModel


class RefundRequest(BaseModel):
    customer_id: str
    order_id: str

class ChatMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str

class ChatRequest(BaseModel):
    messages: list[ChatMessage]