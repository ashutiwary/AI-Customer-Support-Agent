import json

from langchain_core.messages import HumanMessage, AIMessage

from agent.chat_agent import chat_agent
from agent.store import get_recent_logs

from api.models import ChatRequest


def process_chat(request: ChatRequest):

    history = [
        HumanMessage(message.content) if message.role == "user"
        else AIMessage(message.content)
        for message in request.messages
    ]

    try:

        result = chat_agent.invoke({"messages": history})

        reply = result["messages"][-1].content

        reasoning = []

        for message in result["messages"]:
            if message.type == "tool" and message.name == "process_refund_request":
                recent = get_recent_logs(limit=1)
                if recent:
                    reasoning = recent[0]["reasoning"]

    except Exception:

        reply = "Sorry, I'm having trouble right now. Please try again."
        reasoning = []

    return {
        "reply": reply,
        "reasoning": reasoning
    }

def stream_chat(request: ChatRequest):

    history = [
        HumanMessage(message.content) if message.role == "user"
        else AIMessage(message.content)
        for message in request.messages
    ]

    try:

        for _mode, chunk in chat_agent.stream(
            {"messages": history},
            stream_mode=["messages"]
        ):
            msg_chunk, _meta = chunk

            if msg_chunk.type == "tool" and msg_chunk.name == "process_refund_request":
                recent = get_recent_logs(limit=1)
                reasoning = recent[0]["reasoning"] if recent else []
                yield json.dumps({"type": "reasoning", "lines": reasoning}) + "\n"

            elif msg_chunk.type == "AIMessageChunk":
                if msg_chunk.tool_call_chunks:
                    yield json.dumps({
                        "type": "status",
                        "text": "Checking your refund request..."
                    }) + "\n"
                elif msg_chunk.content:
                    yield json.dumps({"type": "token", "text": msg_chunk.content}) + "\n"

        yield json.dumps({"type": "done"}) + "\n"

    except Exception:

        yield json.dumps({
            "type": "error",
            "text": "Sorry, I'm having trouble right now. Please try again."
        }) + "\n"
        yield json.dumps({"type": "done"}) + "\n"
