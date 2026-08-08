from pydantic import BaseModel, Field


class GraphNode(BaseModel):
    id: str
    label: str
    type: str


class GraphEdge(BaseModel):
    source: str
    target: str
    relationship: str


class KnowledgeGraph(BaseModel):
    nodes: list[GraphNode] = Field(default_factory=list)
    edges: list[GraphEdge] = Field(default_factory=list)


class Employee(BaseModel):
    id: int
    name: str
    department: str
    title: str


class Project(BaseModel):
    id: int
    name: str
    owner: str
    status: str
