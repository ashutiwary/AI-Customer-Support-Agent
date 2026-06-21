import json
from datetime import datetime, timezone
from pathlib import Path

LOG_FILE = Path(__file__).resolve().parent.parent / "data" / "agent_logs.json"


def _read_logs():

    if not LOG_FILE.exists():
        return []

    with open(LOG_FILE, "r") as f:
        return json.load(f)

def _write_logs(logs):

    with open(LOG_FILE, "w") as f:
        json.dump(logs, f, indent=2)

def log_decision(customer_id, order_id, decision, reason, message, reasoning, guardrail_overridden):

    logs = _read_logs()

    logs.append({
        "id": len(logs) + 1,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "customer_id": customer_id,
        "order_id": order_id,
        "decision": decision,
        "reason": reason,
        "message": message,
        "reasoning": reasoning,
        "guardrail_overridden": guardrail_overridden
    })

    _write_logs(logs)

def get_recent_logs(limit=100):

    logs = _read_logs()

    return list(reversed(logs))[:limit]
