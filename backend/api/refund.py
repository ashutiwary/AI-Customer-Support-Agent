from agent.graph import graph

from api.models import RefundRequest


def process_refund(request: RefundRequest):

    initial_state = {
        "customer_id": request.customer_id,
        "order_id": request.order_id,

        "customer": {},
        "order": {},
        "policy": "",

        "validation_result": {},

        "reasoning": [],

        "final_response": {}
    }

    result = graph.invoke(initial_state)

    return {
        "decision": result["final_response"],
        "reasoning": result["reasoning"]
    }