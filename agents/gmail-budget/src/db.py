"""Budget database — tracks all spending, income, and subscriptions."""

import sqlite3
import os
from datetime import datetime, timezone

DB_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data", "budget.db")


def get_conn():
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    conn = get_conn()
    c = conn.cursor()

    c.execute("""
        CREATE TABLE IF NOT EXISTS transactions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            type TEXT NOT NULL,
            amount REAL NOT NULL,
            currency TEXT DEFAULT 'GBP',
            vendor TEXT,
            category TEXT,
            description TEXT,
            email_id TEXT UNIQUE,
            email_from TEXT,
            email_subject TEXT,
            email_date TEXT,
            logged_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
    """)

    c.execute("""
        CREATE TABLE IF NOT EXISTS subscriptions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            amount REAL NOT NULL,
            currency TEXT DEFAULT 'GBP',
            frequency TEXT DEFAULT 'monthly',
            next_due TEXT,
            vendor_email TEXT,
            active INTEGER DEFAULT 1,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
    """)

    c.execute("""
        CREATE TABLE IF NOT EXISTS budget (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            category TEXT NOT NULL UNIQUE,
            monthly_limit REAL NOT NULL,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
    """)

    conn.commit()
    conn.close()


def add_transaction(type, amount, currency="GBP", vendor=None, category=None,
                    description=None, email_id=None, email_from=None,
                    email_subject=None, email_date=None):
    conn = get_conn()
    c = conn.cursor()
    try:
        c.execute("""
            INSERT OR IGNORE INTO transactions
            (type, amount, currency, vendor, category, description,
             email_id, email_from, email_subject, email_date)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (type, amount, currency, vendor, category, description,
              email_id, email_from, email_subject, email_date))
        conn.commit()
        return c.lastrowid
    except Exception:
        return None
    finally:
        conn.close()


def add_subscription(name, amount, currency="GBP", frequency="monthly",
                     next_due=None, vendor_email=None):
    conn = get_conn()
    c = conn.cursor()
    c.execute("""
        INSERT INTO subscriptions (name, amount, currency, frequency, next_due, vendor_email)
        VALUES (?, ?, ?, ?, ?, ?)
    """, (name, amount, currency, frequency, next_due, vendor_email))
    conn.commit()
    conn.close()


def get_monthly_spending(year=None, month=None):
    now = datetime.now(timezone.utc)
    year = year or now.year
    month = month or now.month
    start = f"{year}-{month:02d}-01"
    if month == 12:
        end = f"{year + 1}-01-01"
    else:
        end = f"{year}-{month + 1:02d}-01"

    conn = get_conn()
    c = conn.cursor()
    c.execute("""
        SELECT category, SUM(amount) as total, COUNT(*) as count
        FROM transactions
        WHERE type = 'expense' AND email_date >= ? AND email_date < ?
        GROUP BY category ORDER BY total DESC
    """, (start, end))
    rows = [dict(r) for r in c.fetchall()]

    c.execute("""
        SELECT SUM(amount) as total FROM transactions
        WHERE type = 'expense' AND email_date >= ? AND email_date < ?
    """, (start, end))
    total = c.fetchone()["total"] or 0
    conn.close()

    return {"total": total, "by_category": rows, "month": f"{year}-{month:02d}"}


def get_recent_transactions(limit=20):
    conn = get_conn()
    c = conn.cursor()
    c.execute("SELECT * FROM transactions ORDER BY email_date DESC LIMIT ?", (limit,))
    rows = [dict(r) for r in c.fetchall()]
    conn.close()
    return rows


def get_active_subscriptions():
    conn = get_conn()
    c = conn.cursor()
    c.execute("SELECT * FROM subscriptions WHERE active = 1 ORDER BY next_due")
    rows = [dict(r) for r in c.fetchall()]
    conn.close()
    return rows


init_db()
