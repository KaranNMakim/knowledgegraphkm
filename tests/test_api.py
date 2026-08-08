from fastapi.testclient import TestClient

from kgkm.database import initialize_database
from kgkm.main import app


def test_health_endpoint():
    client = TestClient(app)
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"


def test_graph_sync_builds_nodes_and_edges():
    initialize_database()
    client = TestClient(app)
    response = client.post("/api/graph/sync")
    assert response.status_code == 200
    graph = response.json()
    assert len(graph["nodes"]) >= 7
    assert len(graph["edges"]) >= 7
    assert any(node["type"] == "Person" for node in graph["nodes"])
    assert any(edge["relationship"] == "WORKS_IN" for edge in graph["edges"])
