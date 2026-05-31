"""
SQLite database helpers for Smart Farm.
Tables: users, sensor_readings, leaf_scans
"""

import sqlite3
import json
import config


def get_db():
    conn = sqlite3.connect(config.DATABASE_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    with get_db() as conn:
        conn.executescript("""
            CREATE TABLE IF NOT EXISTS users (
                id            INTEGER PRIMARY KEY AUTOINCREMENT,
                name          TEXT    NOT NULL,
                email         TEXT    UNIQUE NOT NULL,
                password_hash TEXT    NOT NULL,
                created_at    TEXT    NOT NULL
            );

            CREATE TABLE IF NOT EXISTS sensor_readings (
                id            INTEGER PRIMARY KEY AUTOINCREMENT,
                timestamp     TEXT    NOT NULL,
                temperature   REAL,
                humidity      REAL,
                soil_moisture REAL
            );

            CREATE TABLE IF NOT EXISTS leaf_scans (
                id         INTEGER PRIMARY KEY AUTOINCREMENT,
                timestamp  TEXT NOT NULL,
                disease    TEXT,
                confidence REAL,
                healthy    INTEGER,
                all_scores TEXT,
                image_b64  TEXT
            );
        """)


# ── Users ──────────────────────────────────────────────────────────────────────

def create_user(name, email, password_hash, created_at):
    with get_db() as conn:
        conn.execute(
            "INSERT INTO users (name, email, password_hash, created_at) VALUES (?,?,?,?)",
            (name, email, password_hash, created_at),
        )


def get_user_by_email(email):
    with get_db() as conn:
        row = conn.execute("SELECT * FROM users WHERE email = ?", (email,)).fetchone()
        return dict(row) if row else None


def get_user_by_id(user_id):
    with get_db() as conn:
        row = conn.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
        return dict(row) if row else None


# ── Sensor readings ────────────────────────────────────────────────────────────

def add_sensor_reading(timestamp, temperature, humidity, soil_moisture):
    with get_db() as conn:
        conn.execute(
            "INSERT INTO sensor_readings (timestamp, temperature, humidity, soil_moisture) VALUES (?,?,?,?)",
            (timestamp, temperature, humidity, soil_moisture),
        )


def get_sensor_history(limit=200):
    with get_db() as conn:
        rows = conn.execute(
            "SELECT timestamp, temperature, humidity, soil_moisture "
            "FROM sensor_readings ORDER BY id DESC LIMIT ?",
            (limit,),
        ).fetchall()
    return [dict(r) for r in reversed(rows)]


# ── Leaf scans ─────────────────────────────────────────────────────────────────

def add_leaf_scan(timestamp, disease, confidence, healthy, all_scores, image_b64):
    with get_db() as conn:
        conn.execute(
            "INSERT INTO leaf_scans (timestamp, disease, confidence, healthy, all_scores, image_b64) "
            "VALUES (?,?,?,?,?,?)",
            (timestamp, disease, confidence, int(healthy), json.dumps(all_scores), image_b64),
        )
