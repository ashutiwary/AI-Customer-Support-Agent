import logging

from dotenv import load_dotenv

from livekit import agents
from livekit.agents import Agent, AgentServer, AgentSession, JobContext, ModelSettings, cli, inference
from livekit.agents.llm import ChatContext, ChatChunk, FunctionTool
from livekit.plugins import groq

from langchain_core.messages import HumanMessage, AIMessage

from agent.chat_agent import chat_agent

load_dotenv()

logger = logging.getLogger("refund-voice-agent")
logger.setLevel(logging.INFO)


class RefundVoiceAgent(Agent):

    def __init__(self):
        super().__init__(
            instructions="You are a refund support voice assistant."
        )

    async def llm_node(
        self,
        chat_ctx: ChatContext,
        tools: list[FunctionTool],
        model_settings: ModelSettings
    ):
        logger.info("llm_node called, chat_ctx has %d items", len(chat_ctx.items))

        history = [
            HumanMessage(item.text_content) if item.role == "user"
            else AIMessage(item.text_content)
            for item in chat_ctx.items
            if item.type == "message" and item.role in ("user", "assistant")
        ]

        logger.info("built history with %d messages: %s", len(history), history)

        try:
            chunk_count = 0

            async for _mode, chunk in chat_agent.astream(
                {"messages": history},
                stream_mode=["messages"]
            ):
                msg_chunk, _meta = chunk

                if (
                    msg_chunk.type == "AIMessageChunk"
                    and msg_chunk.content
                    and not msg_chunk.tool_call_chunks
                ):
                    chunk_count += 1
                    yield msg_chunk.content

            logger.info("llm_node finished, yielded %d chunks", chunk_count)

        except Exception:
            logger.exception("llm_node failed")
            raise


server = AgentServer()


@server.rtc_session(agent_name="refund-voice-agent")
async def entrypoint(ctx: JobContext):

    await ctx.connect()

    session = AgentSession(
        stt=groq.STT(model="whisper-large-v3-turbo"),
        llm=inference.LLM(model="openai/gpt-4o-mini"),
        tts=inference.TTS(model="cartesia/sonic-2")
    )

    await session.start(agent=RefundVoiceAgent(), room=ctx.room)


if __name__ == "__main__":
    cli.run_app(server)
