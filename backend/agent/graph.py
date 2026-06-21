from langgraph.graph import StateGraph, END

from agent.state import RefundState

from agent.nodes import (
    agent_node,
    guardrail_node,
    log_node
)

workflow = StateGraph(RefundState)

workflow.add_node("agent", agent_node)
workflow.add_node("guardrail", guardrail_node)
workflow.add_node("log", log_node)

workflow.set_entry_point("agent")

workflow.add_edge("agent", "guardrail")
workflow.add_edge("guardrail", "log")
workflow.add_edge("log", END)

graph = workflow.compile()
