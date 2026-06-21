from agent.store import get_recent_logs


def get_admin_sessions(limit: int = 100):
    return {"sessions": get_recent_logs(limit=limit)}
