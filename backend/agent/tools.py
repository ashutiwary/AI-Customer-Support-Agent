import json
from pathlib import Path

from langchain_core.tools import tool


BASE_DIR = Path(__file__).resolve().parent.parent

CUSTOMERS_FILE = BASE_DIR / "data" / "customers.json"
ORDERS_FILE = BASE_DIR / "data" / "orders.json"
POLICY_FILE = BASE_DIR / "data" / "refund_policy.txt"


def get_customer(customer_id: str):

    with open(CUSTOMERS_FILE, "r") as f:
        customers = json.load(f)

    for customer in customers:
        if customer["customer_id"].casefold() == customer_id.strip().casefold():
            return customer

    return None

def get_order(order_id: str):

    with open(ORDERS_FILE, "r") as f:
        orders = json.load(f)

    for order in orders:
        if order["order_id"].casefold() == order_id.strip().casefold():
            return order

    return None

def get_policy():

    with open(POLICY_FILE, "r") as f:
        return f.read()

def validate_refund(customer, order):

    if customer is None:
        return {
            "decision": "Denied",
            "reason": "Customer not found."
        }

    if order is None:
        return {
            "decision": "Denied",
            "reason": "Order not found."
        }

    # Rule 0
    if order["customer_id"] != customer["customer_id"]:
        return {
            "decision": "Denied",
            "reason": "Order does not belong to this customer."
        }

    # Rule 1
    if order["days_since_purchase"] > 30:
        return {
            "decision": "Denied",
            "reason": "Refund request exceeds 30 days."
        }

    # Rule 2
    if order["final_sale"]:
        return {
            "decision": "Denied",
            "reason": "Item marked as Final Sale."
        }

    # Rule 3
    if customer["refund_count"] > 5:
        return {
            "decision": "Manual Review",
            "reason": "Customer has more than 5 refunds."
        }

    # Rule 4
    if order["damaged"]:
        return {
            "decision": "Approved",
            "reason": "Product damaged during delivery."
        }

    # Rule 5
    if order["product_type"] == "Digital":
        return {
            "decision": "Denied",
            "reason": "Digital products are not refundable."
        }

    return {
        "decision": "Approved",
        "reason": "Eligible under refund policy."
    }

@tool
def get_customer_info(customer_id: str) -> dict:
    """Fetch the customer's record (tier, refund_count, etc.) by customer ID."""
    return get_customer(customer_id) or {"error": "Customer not found"}

@tool
def get_order_info(order_id: str) -> dict:
    """Fetch the order's record (amount, days_since_purchase, product_type, final_sale, damaged) by order ID."""
    return get_order(order_id) or {"error": "Order not found"}

@tool
def get_refund_policy() -> str:
    """Return the full refund policy text that governs refund decisions."""
    return get_policy()