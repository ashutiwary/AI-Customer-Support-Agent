import os
import uuid

from dotenv import load_dotenv
from livekit import api

load_dotenv()


def create_voice_token():

    identity = f"customer-{uuid.uuid4().hex[:8]}"
    room_name = f"refund-{identity}"

    token = api.AccessToken(
        os.getenv("LIVEKIT_API_KEY"),
        os.getenv("LIVEKIT_API_SECRET")
    )

    token.with_identity(identity).with_name(identity).with_grants(
        api.VideoGrants(room_join=True, room=room_name)
    ).with_room_config(
        api.RoomConfiguration(
            agents=[api.RoomAgentDispatch(agent_name="refund-voice-agent")]
        )
    )

    return {
        "token": token.to_jwt(),
        "url": os.getenv("LIVEKIT_URL"),
        "room": room_name
    }
