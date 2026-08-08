from pathlib import Path

from fastapi import FastAPI
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles

from kgkm import __version__
from kgkm.database import initialize_database, list_employees, list_projects
from kgkm.graph import build_knowledge_graph
from kgkm.models import Employee, KnowledgeGraph, Project

STATIC_DIR = Path(__file__).resolve().parent / "static"

app = FastAPI(title="KnowledgeGraphKM", version=__version__)
app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")


@app.on_event("startup")
def on_startup() -> None:
    initialize_database()


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "version": __version__}


@app.get("/", response_class=HTMLResponse)
def home() -> str:
    return (STATIC_DIR / "index.html").read_text()


@app.get("/api/employees", response_model=list[Employee])
def get_employees() -> list[Employee]:
    return [Employee(**row) for row in list_employees()]


@app.get("/api/projects", response_model=list[Project])
def get_projects() -> list[Project]:
    return [Project(**row) for row in list_projects()]


@app.post("/api/graph/sync", response_model=KnowledgeGraph)
def sync_graph() -> KnowledgeGraph:
    return build_knowledge_graph()


@app.get("/api/graph", response_model=KnowledgeGraph)
def get_graph() -> KnowledgeGraph:
    return build_knowledge_graph()
