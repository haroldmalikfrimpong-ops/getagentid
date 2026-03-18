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
    "amount": number (always positive, in the ORIGINAL currency as stated in the email),
    "currency": the currency symbol/code from the email — "GBP", "USD", "EUR", "NGN", "CAD", "AUD", "JPY", "CHF", "SEK", "INR", "BRL", "ZAR", "GHS", etc. Use whatever the email says.,
    "vendor": "company name",
    "category": one of:
      - "technology" — software, apps, SaaS, domains, hosting, hardware, gadgets, dev tools, AI subscriptions
      - "housing" — rent, mortgage, home insurance, repairs, furniture, utilities (gas, electric, water, council tax)
      - "food" — groceries, restaurants, takeaway, delivery, coffee
      - "transport" — fuel, Uber, bus, train, car insurance, car maintenance, parking
      - "entertainment" — Netflix, Spotify, gaming, cinema, events, concerts, streaming
      - "shopping" — clothes, Amazon orders, general retail, personal items
      - "subscriptions" — recurring payments that don't fit other categories
      - "bills" — phone bill, broadband, credit card payments, loan repayments
      - "health" — gym, dentist, medical, pharmacy, supplements
      - "education" — courses, books, certifications, tuition
      - "holidays" — flights, hotels, Airbnb, travel bookings, travel insurance
      - "investments" — crypto deposits, stock purchases, trading platform fees
      - "banking" — bank transfers between own accounts, fees, charges
      - "salary" — wages, freelance payments received
      - "freelance" — income from freelance/contract work
      - "gifts" — money sent to others, donations, birthday gifts
      - "other" — anything that doesn't fit above
    "description": "brief description of what was bought/paid",
    "is_subscription": true/false,
    "subscription_frequency": "monthly" or "yearly" or "weekly" or null
}}

If this email is NOT about a financial transaction (marketing, newsletters, social, promotions, notifications with no money amount):
{{
    "is_financial": false
}}

Rules:
- Extract the EXACT amount paid in the original currency — don't convert
- £ = GBP, $ = USD (unless context says AUD/CAD etc), € = EUR, ₦ = NGN
- If multiple items, use the total/grand total amount
- "Order confirmed" with a price = expense
- "Payment received" or "You've been paid" = income
- "Refund" or "credit back" = refund
- Subscription renewals = expense with is_subscription=true
- Bank statements or balance alerts with no specific transaction = NOT financial
- Delivery/shipping updates with no price = NOT financial
- Marketing emails saying "save 20%" = NOT financial (no actual purchase)
- If you can't determine the exact amount, set is_financial to false
- Crypto deposits/withdrawals TO an exchange = investments
- Wise/Revolut/PayPal transfers = banking

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
        import time
        time.sleep(0.5)

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
