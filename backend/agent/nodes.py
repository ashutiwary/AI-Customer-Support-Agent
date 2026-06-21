from langchain_core.messages import HumanMessage
from langgraph.prebuilt import create_react_agent

from agent.tools import (
    get_customer,
    get_order,
    validate_refund,
    get_customer_info,
    get_order_info,
    get_refund_policy
)
from agent.llm import llm
from agent.store import log_decision

from agent.state import RefundState, RefundDecision

SYSTEM_PROMPT = """You are an AI refund agent for an e-commerce platform.

Given a customer ID and order ID, use the available tools to fetch the
customer record, the order record, and the refund policy. Reason over the
policy text against the customer/order facts, then decide one of:
Approved, Denied, Manual Review.

Always fetch the customer, order, and policy via tools before deciding -
never guess. Call each tool at most once - do not call a tool again if you
already have its result. Once you have the customer, order, and policy,
decide immediately. Keep the customer-facing message under 80 words."""

refund_agent = create_react_agent(
    model=llm,
    tools=[get_customer_info, get_order_info, get_refund_policy],
    prompt=SYSTEM_PROMPT,
    response_format=RefundDecision
)

def agent_node(state: RefundState):

    try:
        result = refund_agent.invoke({
            "messages": [
                HumanMessage(
                    f"Customer ID: {state['customer_id']}, "
                    f"Order ID: {state['order_id']}. "
                    "Please process this refund request."
                )
            ]
        })

        decision: RefundDecision = result["structured_response"]

        state["validation_result"] = {
            "decision": decision.decision,
            "reason": decision.reason
        }

        state["final_response"] = {
            "decision": decision.decision,
            "reason": decision.reason,
            "message": decision.message
        }

        for message in result["messages"]:

            tool_calls = getattr(message, "tool_calls", None)

            if tool_calls:
                for call in tool_calls:
                    state["reasoning"].append(
                        f"Agent called {call['name']}({call['args']})"
                    )

            elif message.type == "tool":
                state["reasoning"].append(
                    f"Tool '{message.name}' returned: {message.content}"
                )

            elif message.type == "ai" and message.content:
                state["reasoning"].append(
                    f"Agent reasoning: {message.content}"
                )

    except Exception as error:

        state["validation_result"] = {}
        state["final_response"] = {}

        state["reasoning"].append(
            f"Agent invocation failed: {error}"
        )

    return state

def guardrail_node(state: RefundState):

    customer = get_customer(state["customer_id"])
    order = get_order(state["order_id"])

    state["customer"] = customer
    state["order"] = order

    expected = validate_refund(customer, order)

    agent_decision = state.get("validation_result")

    if not agent_decision:

        state["final_response"] = {
            "decision": expected["decision"],
            "reason": expected["reason"],
            "message": f"Decision: {expected['decision']}. Reason: {expected['reason']}."
        }

        state["reasoning"].append(
            "LLM agent unavailable - used rule-based policy decision."
        )

        state["guardrail_overridden"] = False

    elif expected["decision"] != agent_decision["decision"]:

        state["final_response"] = {
            "decision": expected["decision"],
            "reason": expected["reason"],
            "message": f"Decision: {expected['decision']}. Reason: {expected['reason']}."
        }

        state["reasoning"].append(
            f"Guardrail override: policy rules require '{expected['decision']}' "
            f"({expected['reason']}), overriding agent's '{agent_decision['decision']}'."
        )

        state["guardrail_overridden"] = True

    elif expected["reason"] != agent_decision["reason"]:

        state["final_response"] = {
            "decision": expected["decision"],
            "reason": expected["reason"],
            "message": f"Decision: {expected['decision']}. Reason: {expected['reason']}."
        }

        state["reasoning"].append(
            f"Guardrail correction: decision '{expected['decision']}' was correct, but agent's "
            f"reason ('{agent_decision['reason']}') did not match policy rules - replaced with "
            f"'{expected['reason']}'."
        )

        state["guardrail_overridden"] = True

    else:

        state["reasoning"].append(
            "Guardrail check passed - agent decision matches policy rules."
        )

        state["guardrail_overridden"] = False

    return state

def log_node(state: RefundState):

    log_decision(
        customer_id=state["customer_id"],
        order_id=state["order_id"],
        decision=state["final_response"]["decision"],
        reason=state["final_response"]["reason"],
        message=state["final_response"]["message"],
        reasoning=state["reasoning"],
        guardrail_overridden=state.get("guardrail_overridden", False)
    )

    return state
