import sqlite3
from pathlib import Path

DB_PATH = Path(__file__).resolve().parents[2] / "data" / "internal.db"

SCHEMA_SQL = """
CREATE TABLE IF NOT EXISTS departments (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS employees (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    title TEXT NOT NULL,
    department_id INTEGER NOT NULL REFERENCES departments(id)
);

CREATE TABLE IF NOT EXISTS projects (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    status TEXT NOT NULL,
    owner_id INTEGER NOT NULL REFERENCES employees(id)
);

CREATE TABLE IF NOT EXISTS project_members (
    project_id INTEGER NOT NULL REFERENCES projects(id),
    employee_id INTEGER NOT NULL REFERENCES employees(id),
    PRIMARY KEY (project_id, employee_id)
);
"""

SEED_SQL = """
INSERT OR IGNORE INTO departments (id, name) VALUES
    (1, 'Engineering'),
    (2, 'Product'),
    (3, 'Data Science');

INSERT OR IGNORE INTO employees (id, name, title, department_id) VALUES
    (1, 'Alex Chen', 'Staff Engineer', 1),
    (2, 'Jordan Lee', 'Product Manager', 2),
    (3, 'Sam Rivera', 'Data Scientist', 3),
    (4, 'Taylor Kim', 'Backend Engineer', 1);

INSERT OR IGNORE INTO projects (id, name, status, owner_id) VALUES
    (1, 'Customer Graph', 'active', 1),
    (2, 'Search Relevance', 'active', 3),
    (3, 'Onboarding Flow', 'planning', 2);

INSERT OR IGNORE INTO project_members (project_id, employee_id) VALUES
    (1, 1), (1, 4), (1, 3),
    (2, 3), (2, 4),
    (3, 2), (3, 1);
"""


def connect() -> sqlite3.Connection:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    connection = sqlite3.connect(DB_PATH)
    connection.row_factory = sqlite3.Row
    return connection


def initialize_database() -> None:
    with connect() as connection:
        connection.executescript(SCHEMA_SQL)
        connection.executescript(SEED_SQL)
        connection.commit()


def list_employees() -> list[dict]:
    query = """
        SELECT e.id, e.name, e.title, d.name AS department
        FROM employees e
        JOIN departments d ON d.id = e.department_id
        ORDER BY e.id
    """
    with connect() as connection:
        return [dict(row) for row in connection.execute(query)]


def list_projects() -> list[dict]:
    query = """
        SELECT p.id, p.name, p.status, owner.name AS owner
        FROM projects p
        JOIN employees owner ON owner.id = p.owner_id
        ORDER BY p.id
    """
    with connect() as connection:
        return [dict(row) for row in connection.execute(query)]
