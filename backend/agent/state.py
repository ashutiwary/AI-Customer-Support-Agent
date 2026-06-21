from typing import Literal, TypedDict

from pydantic import BaseModel


class RefundDecision(BaseModel):

    decision: Literal["Approved", "Denied", "Manual Review"]
    reason: str
    message: str


class RefundState(TypedDict):

    customer_id: str
    order_id: str

    customer: dict
    order: dict

    policy: str

    validation_result: dict

    reasoning: list

    final_response: dict

    guardrail_overridden: bool