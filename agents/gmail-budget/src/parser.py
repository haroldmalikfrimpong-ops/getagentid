"""AI-powered email parser — extracts financial data from emails using Claude."""

import json
import anthropic
import os

client = None
MODEL = "claude-haiku-4-5-20251001"

PARSE_PROMPT = """You are a financial email parser. Analyze this email and extract transaction data.

Return ONLY valid JSON — no other text.

If this email contains a financial transaction (purchase, payment, subscription, refund, income):
{{
    "is_financial": true,
    "type": "expense" or "income" or "refund",
    "amount": number (always positive),
    "currency": "GBP" or "USD" or "EUR",
    "vendor": "company name",
    "category": one of ["food", "transport", "entertainment", "shopping", "subscriptions", "bills", "health", "education", "travel", "transfers", "salary", "freelance", "other"],
    "description": "brief description of what was bought/paid",
    "is_subscription": true/false,
    "subscription_frequency": "monthly" or "yearly" or "weekly" or null
}}

If this email is NOT about a financial transaction (marketing, newsletters, social media, etc):
{{
    "is_financial": false
}}

Rules:
- Extract the EXACT amount paid, not shipping or tax separately
- If multiple items, use the total amount
- "Order confirmed" = expense
- "Payment received" or "You've been paid" = income
- "Refund" or "credit" = refund
- Subscription renewals = expense with is_subscription=true
- Bank statements or balance alerts = NOT a transaction (is_financial: false)
- Delivery updates with no price = NOT a transaction
- If you can't determine the amount, set is_financial to false

Email from: {sender}
Subject: {subject}
Date: {date}
Body:
{body}"""


def init():
    global client
    key = os.environ.get("ANTHROPIC_API_KEY")
    if key:
        client = anthropic.Anthropic(api_key=key)


def parse_email(email):
    """Parse an email and return financial data, or None if not financial."""
    if not client:
        init()
    if not client:
        return None

    try:
        prompt = PARSE_PROMPT.format(
            sender=email["from"],
            subject=email["subject"],
            date=email["date"],
            body=email["body"][:2000],
        )

        response = client.messages.create(
            model=MODEL,
            max_tokens=300,
            messages=[{"role": "user", "content": prompt}],
        )

        text = response.content[0].text.strip()

        if "```" in text:
            text = text.split("```")[1]
            if text.startswith("json"):
                text = text[4:]
            text = text.strip()

        result = json.loads(text)

        if not result.get("is_financial"):
            return None

        return result

    except json.JSONDecodeError:
        return None
    except Exception as e:
        print(f"Parse error: {e}")
        return None
