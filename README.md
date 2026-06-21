# AI Refund Agent

An AI-powered refund desk for an e-commerce store. A customer gives a customer ID and an order ID through chat or a live voice call, and an LLM agent looks up the order, reads the refund policy, and decides whether the refund is approved, denied, or needs manual review. A deterministic rule engine checks every decision after the agent makes it, so the system stays genuinely agentic (the model actually reasons and calls tools) without ever shipping a wrong or hallucinated answer to a customer.

There's also an admin dashboard that shows every decision the agent has ever made, across chat, voice, and the raw API, including a flag for any case where the rule engine had to correct the model.

This was built as a take-home style project, so it intentionally avoids a database. All persistence is a single JSON file.

## Why it's built this way

The core idea is that the LLM should be doing real work, not just dressing up a decision tree. So the agent gets three tools (look up customer, look up order, read the policy text) and has to figure out on its own which ones to call and in what order, then reason over the policy in plain English and land on a decision.

Because LLMs occasionally get this wrong, even with the right tools and the right policy in front of them, a second pass runs right after the agent decides. It re-derives the correct answer with plain Python if/else logic and compares it against what the model said. If the decision is wrong, it gets overridden. If the decision happens to be right but the model's stated reason doesn't match policy (this actually happened during testing, the model picked the correct label but invented a believable-sounding wrong reason), the reason gets corrected too. Either way it's logged, and the admin dashboard shows a "guardrail override" badge whenever this kicks in.

Chat and voice both go through the exact same decision graph. The voice worker doesn't have its own separate logic, it just converts the live conversation into the same format the chat agent expects and streams the reply back through text-to-speech. So a fix to the chat agent's behavior automatically applies to voice calls too.

## Features

- Conversational refund chat with streaming replies (the answer types itself out instead of appearing all at once)
- A live "Agent Activity" panel next to the chat that shows every tool call and reasoning step as it happens
- Voice calls through LiveKit, speak to the agent and hear it answer back
- An admin dashboard listing every decision ever made, with the full reasoning trace for each one
- A rule-based guardrail that double-checks the LLM's decision and reason before anything reaches the customer
- Case-insensitive customer and order ID lookup, so "c001" and "C001" both work
- No database. Everything is read from and written to plain JSON files

## Tech stack

Backend: Python, FastAPI, LangChain, LangGraph, Groq (LLM), LiveKit Agents (voice).

Frontend: Next.js, React, TypeScript, Tailwind CSS, livekit-client.

## Project structure

```
ai-refund-agent/
├── README.md
├── .gitignore
├── backend/
│   ├── main.py
│   ├── voice_agent.py
│   ├── requirements.txt
│   ├── .env.example
│   ├── api/
│   │   ├── models.py
│   │   ├── refund.py
│   │   ├── chat.py
│   │   ├── admin.py
│   │   └── voice.py
│   ├── agent/
│   │   ├── state.py
│   │   ├── llm.py
│   │   ├── tools.py
│   │   ├── nodes.py
│   │   ├── graph.py
│   │   ├── chat_agent.py
│   │   └── store.py
│   └── data/
│       ├── customers.json
│       ├── orders.json
│       └── refund_policy.txt
└── frontend/
    ├── package.json
    └── app/
        ├── layout.tsx
        ├── globals.css
        ├── page.tsx
        ├── admin/
        │   └── page.tsx
        ├── components/
        │   └── VoiceCall.tsx
        └── lib/
            └── reasoningStyle.ts
```

`main.py` is the FastAPI app and routes. `voice_agent.py` is the LiveKit voice worker, it runs as its own process. `api/` holds the route handlers, `agent/` holds the LangGraph decision graph, the guardrail logic (in `tools.py`), and the chat agent. `data/` holds the sample customers/orders and the policy text (the decision log file gets created here at runtime and is gitignored).

A few things are left out of the diagram on purpose: standard config files (`next.config.ts`, `tsconfig.json`, `eslint.config.mjs`, `postcss.config.mjs`), the `public/` folder of default Next.js icons, and a handful of `test_*.py` scripts in `backend/` left over from development. Those are now in `.gitignore` too, they were never meant to ship.

## Prerequisites

- Python 3.11 or newer
- Node.js 18 or newer
- A free Groq API key (https://console.groq.com)
- A LiveKit project, only needed if you want to test voice calls (https://livekit.io)

## Setup

### 1. Backend

```bash
cd backend
python -m venv venv

# Windows
venv\Scripts\activate

# macOS / Linux
source venv/bin/activate

pip install -r requirements.txt
```

Copy `.env.example` to `.env` and fill in your keys:

```bash
cp .env.example .env
```

```
GROQ_API_KEY=your_groq_key_here
LIVEKIT_URL=your_livekit_url_here
LIVEKIT_API_KEY=your_livekit_key_here
LIVEKIT_API_SECRET=your_livekit_secret_here
```

The LIVEKIT_* values are only required if you plan to test the voice call feature. Without them the chat and admin features work fine, the voice button just won't connect.

### 2. Frontend

```bash
cd frontend
npm install
```

## Running the app

You need up to three terminals running at the same time, depending on whether you want voice calls too.

**Terminal 1, backend API:**

```bash
cd backend
venv\Scripts\activate
uvicorn main:app --reload
```

Runs on http://127.0.0.1:8000

**Terminal 2, frontend:**

```bash
cd frontend
npm run dev
```

Runs on http://localhost:3000

**Terminal 3, voice worker (optional, only for voice calls):**

```bash
cd backend
venv\Scripts\activate
python voice_agent.py dev
```

This is a separate long-running process, it does not hot reload. If you change any code under `agent/` and want the voice call to pick it up, stop this process and start it again.

Once everything is up, open http://localhost:3000, type something like "I'd like a refund for order ORD001, my customer ID is C001", and watch the reasoning panel on the right fill in as the agent works. Visit `/admin` to see the full decision history.

## Sample data to try

Customer IDs C001 through C015 and order IDs ORD001 through ORD015 are seeded in `backend/data/`. A few worth trying:

- C001 / ORD001, a damaged item within 30 days, gets approved
- C003 / ORD003, purchased 45 days ago, gets denied for exceeding the refund window
- C005 / ORD005, marked final sale, gets denied
- C009, has more than 5 past refunds, triggers manual review on any of their orders
- C004 / ORD004, a digital product, gets denied since digital items aren't refundable

## API endpoints

| Method | Path | Purpose |
|---|---|---|
| POST | /refund | Run the decision graph directly with a customer ID and order ID |
| POST | /chat | Send a chat message, get a full reply back |
| POST | /chat/stream | Same as above but streamed as the reply is generated |
| GET | /admin/sessions | List logged decisions, newest first |
| GET | /voice/token | Mint a LiveKit token for a new voice call |

## Known limitations

This is a demo project, not a production system. A few things to be upfront about:

- The voice worker uses Groq for speech-to-text and LiveKit's hosted Cartesia model for text-to-speech. An all-LiveKit pipeline was tried first but its speech-to-text would not produce any transcription inside a live call, even though it worked fine in isolated testing. The hybrid setup is the result of picking what actually works over chasing a single-vendor setup.
- Groq's free tier has a daily token cap. If you hit it, the chat agent will return an error until the quota resets.
- There's no authentication anywhere, including the admin dashboard. Anyone with the URL can see every decision ever logged.
- CORS is wide open on the backend, which is fine for local use but would need locking down before deploying anywhere public.

## License

Not specified. This is a personal project, ask before reusing.
