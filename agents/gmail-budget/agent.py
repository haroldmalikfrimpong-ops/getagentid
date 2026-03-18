"""Gmail Budget Agent — scans emails, tracks spending, manages budget."""

import os
import json
from datetime import datetime, timezone
from dotenv import load_dotenv

load_dotenv()

from src import db, gmail, parser


def scan_emails(days=None):
    """Scan Gmail for money-related emails and log transactions. days=None scans all time."""
    if days:
        print(f"Scanning emails from last {days} days...")
    else:
        print("Scanning ALL emails for financial transactions...")

    service = gmail.get_service()
    emails = gmail.get_money_emails(service, days=days)
    print(f"Found {len(emails)} money-related emails")

    parser.init()

    new_transactions = 0
    for email in emails:
        # Skip if already processed
        existing = db.get_conn()
        c = existing.cursor()
        c.execute("SELECT id FROM transactions WHERE email_id = ?", (email["id"],))
        if c.fetchone():
            existing.close()
            continue
        existing.close()

        # Parse with AI
        result = parser.parse_email(email)
        if not result:
            continue

        # Log transaction
        tid = db.add_transaction(
            type=result["type"],
            amount=result["amount"],
            currency=result.get("currency", "GBP"),
            vendor=result.get("vendor"),
            category=result.get("category"),
            description=result.get("description"),
            email_id=email["id"],
            email_from=email["from"],
            email_subject=email["subject"],
            email_date=email["date"],
        )

        if tid:
            new_transactions += 1
            icon = "+" if result["type"] == "income" else "-"
            print(f"  {icon}£{result['amount']:.2f} | {result.get('vendor', 'Unknown')} | {result.get('category', '')}")

            # Log to AgentID hub
            try:
                from hub import log_transaction
                log_transaction(result["type"], result["amount"], result.get("currency", "GBP"),
                                result.get("vendor"), result.get("category"), result.get("description"))
            except Exception:
                pass

            # Track subscription
            if result.get("is_subscription"):
                db.add_subscription(
                    name=result.get("vendor", "Unknown"),
                    amount=result["amount"],
                    currency=result.get("currency", "GBP"),
                    frequency=result.get("subscription_frequency", "monthly"),
                    vendor_email=email["from"],
                )

    print(f"\n{new_transactions} new transactions logged")
    return new_transactions


def report():
    """Print monthly spending report."""
    spending = db.get_monthly_spending()
    subs = db.get_active_subscriptions()
    recent = db.get_recent_transactions(limit=10)

    print(f"\n{'='*50}")
    print(f"  Budget Report — {spending['month']}")
    print(f"{'='*50}")
    print(f"\n  Total spent: £{spending['total']:.2f}")

    if spending["by_category"]:
        print(f"\n  By category:")
        for cat in spending["by_category"]:
            print(f"    {cat['category'] or 'uncategorised':20s} £{cat['total']:>8.2f}  ({cat['count']} transactions)")

    if subs:
        monthly_subs = sum(s["amount"] for s in subs if s["frequency"] == "monthly")
        print(f"\n  Active subscriptions: {len(subs)} (£{monthly_subs:.2f}/month)")
        for s in subs:
            print(f"    {s['name']:20s} £{s['amount']:>8.2f}/{s['frequency']}")

    if recent:
        print(f"\n  Recent transactions:")
        for t in recent:
            icon = "+" if t["type"] == "income" else "-"
            print(f"    {t['email_date'][:10] if t['email_date'] else '?':10s} {icon}£{t['amount']:>8.2f} | {t['vendor'] or 'Unknown'}")

    print(f"\n{'='*50}")


if __name__ == "__main__":
    import sys

    if len(sys.argv) > 1 and sys.argv[1] == "report":
        report()
    elif len(sys.argv) > 1 and sys.argv[1] == "scan":
        days = int(sys.argv[2]) if len(sys.argv) > 2 else None
        scan_emails(days=days)
        report()
    elif len(sys.argv) > 1 and sys.argv[1] == "all":
        scan_emails(days=None)
        report()
    else:
        scan_emails(days=30)
        report()
