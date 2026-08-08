from kgkm.database import connect
from kgkm.models import GraphEdge, GraphNode, KnowledgeGraph


def build_knowledge_graph() -> KnowledgeGraph:
    nodes: dict[str, GraphNode] = {}
    edges: list[GraphEdge] = []

    with connect() as connection:
        for row in connection.execute("SELECT id, name FROM departments ORDER BY id"):
            node_id = f"dept:{row['id']}"
            nodes[node_id] = GraphNode(id=node_id, label=row["name"], type="Department")

        for row in connection.execute(
            "SELECT id, name, title, department_id FROM employees ORDER BY id"
        ):
            node_id = f"person:{row['id']}"
            nodes[node_id] = GraphNode(
                id=node_id,
                label=row["name"],
                type="Person",
            )
            edges.append(
                GraphEdge(
                    source=node_id,
                    target=f"dept:{row['department_id']}",
                    relationship="WORKS_IN",
                )
            )

        for row in connection.execute(
            """
            SELECT p.id, p.name, p.status, owner.name AS owner_name, owner.id AS owner_id
            FROM projects p
            JOIN employees owner ON owner.id = p.owner_id
            ORDER BY p.id
            """
        ):
            node_id = f"project:{row['id']}"
            nodes[node_id] = GraphNode(
                id=node_id,
                label=row["name"],
                type="Project",
            )
            edges.append(
                GraphEdge(
                    source=f"person:{row['owner_id']}",
                    target=node_id,
                    relationship="OWNS",
                )
            )

        for row in connection.execute(
            """
            SELECT pm.project_id, pm.employee_id
            FROM project_members pm
            ORDER BY pm.project_id, pm.employee_id
            """
        ):
            edges.append(
                GraphEdge(
                    source=f"person:{row['employee_id']}",
                    target=f"project:{row['project_id']}",
                    relationship="CONTRIBUTES_TO",
                )
            )

    return KnowledgeGraph(nodes=list(nodes.values()), edges=edges)
