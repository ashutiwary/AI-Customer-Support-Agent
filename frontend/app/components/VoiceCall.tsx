"use client";

import { useEffect, useRef, useState } from "react";
import {
  Room,
  RoomEvent,
  Track,
  RemoteTrack,
  RemoteParticipant,
  ConnectionState,
} from "livekit-client";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000";

type CallState = "idle" | "connecting" | "connected" | "error";

const log = (...args: unknown[]) => console.log("[voice]", ...args);

export default function VoiceCall({
  onActiveChange,
}: {
  onActiveChange?: (active: boolean) => void;
}) {
  const [callState, setCallState] = useState<CallState>("idle");
  const [errorText, setErrorText] = useState<string | null>(null);

  useEffect(() => {
    onActiveChange?.(callState === "connected");
  }, [callState, onActiveChange]);

  const roomRef = useRef<Room | null>(null);
  const audioContainerRef = useRef<HTMLDivElement>(null);

  const handleStart = async () => {
    setErrorText(null);
    setCallState("connecting");

    try {
      log("fetching token from", `${API_URL}/voice/token`);
      const res = await fetch(`${API_URL}/voice/token`);
      log("token response status", res.status);

      if (!res.ok) {
        throw new Error(`/voice/token returned ${res.status}`);
      }

      const { token, url, room: roomName } = await res.json();
      log("got token, room:", roomName, "livekit url:", url);

      const room = new Room();
      roomRef.current = room;

      room.on(RoomEvent.ConnectionStateChanged, (state: ConnectionState) => {
        log("connection state changed ->", state);
      });

      room.on(RoomEvent.ParticipantConnected, (p: RemoteParticipant) => {
        log("participant connected:", p.identity);
      });

      room.on(RoomEvent.ParticipantDisconnected, (p: RemoteParticipant) => {
        log("participant disconnected:", p.identity);
      });

      room.on(RoomEvent.TrackSubscribed, (track: RemoteTrack, _pub, participant) => {
        log("track subscribed:", track.kind, "from", participant.identity);
        if (track.kind === Track.Kind.Audio) {
          const el = track.attach();
          audioContainerRef.current?.appendChild(el);
          log("audio element attached and playing");
        }
      });

      room.on(RoomEvent.TrackUnsubscribed, (track: RemoteTrack) => {
        log("track unsubscribed:", track.kind);
      });

      room.on(RoomEvent.DataReceived, (payload: Uint8Array) => {
        log("data received, bytes:", payload.length);
      });

      room.on(RoomEvent.Disconnected, (reason) => {
        log("room disconnected, reason:", reason);
        setCallState("idle");
        roomRef.current = null;
      });

      log("connecting to room...");
      await room.connect(url, token);
      log("room connected. remote participants:", room.remoteParticipants.size);

      log("enabling microphone...");
      await room.localParticipant.setMicrophoneEnabled(true);
      log("microphone enabled");

      setCallState("connected");
    } catch (error) {
      console.error("[voice] start call failed:", error);
      setErrorText(
        error instanceof Error ? error.message : "Couldn't start the voice call. Please try again."
      );
      setCallState("error");
      roomRef.current?.disconnect();
      roomRef.current = null;
    }
  };

  const handleHangUp = () => {
    roomRef.current?.disconnect();
    roomRef.current = null;
    setCallState("idle");
  };

  return (
    <div className="flex items-center gap-3">
      <div ref={audioContainerRef} className="hidden" />

      {callState === "idle" || callState === "error" ? (
        <button
          onClick={handleStart}
          className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white text-sm px-3 py-1.5 rounded-lg"
        >
          🎤 Start Voice Call
        </button>
      ) : (
        <button
          onClick={handleHangUp}
          className="flex items-center gap-2 bg-red-500 hover:bg-red-600 text-white text-sm px-3 py-1.5 rounded-lg"
        >
          {callState === "connecting" ? "Connecting..." : "📞 Hang Up"}
        </button>
      )}

      {callState === "connected" && (
        <span className="text-xs text-emerald-700 bg-emerald-100 px-2 py-1 rounded-full">
          Live - speak now
        </span>
      )}

      {errorText && (
        <span className="text-xs text-red-600">{errorText}</span>
      )}
    </div>
  );
}
