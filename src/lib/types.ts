export type AuthProvider = "personal" | "sso_google" | "sso_microsoft";

export type ConnectorType =
  | "csv"
  | "postgres"
  | "mysql"
  | "mssql"
  | "mongodb"
  | "sqlite";

export type RelationshipStatus = "suggested" | "confirmed" | "rejected" | "manual";

export interface User {
  id: string;
  email: string;
  name: string;
  password_hash: string | null;
  provider: AuthProvider;
  provider_subject: string | null;
  created_at: string;
}

export interface Project {
  id: string;
  owner_id: string;
  name: string;
  description: string;
  is_demo: number;
  created_at: string;
  updated_at: string;
}

export interface Connector {
  id: string;
  project_id: string;
  name: string;
  type: ConnectorType;
  config_json: string;
  status: "idle" | "connected" | "error";
  last_sync_at: string | null;
  created_at: string;
}

export interface TableMeta {
  id: string;
  connector_id: string;
  project_id: string;
  name: string;
  row_count: number;
  description: string | null;
}

export interface ColumnMeta {
  id: string;
  table_id: string;
  name: string;
  data_type: string;
  sample_values_json: string;
  distinct_count: number;
  null_ratio: number;
  description: string | null;
  is_pk: number;
}

export interface Relationship {
  id: string;
  project_id: string;
  source_table_id: string;
  source_column_id: string;
  target_table_id: string;
  target_column_id: string;
  confidence: number;
  overlap_ratio: number;
  shared_values: number;
  status: RelationshipStatus;
  rationale: string;
  created_at: string;
}

export interface OntologyEntry {
  id: string;
  project_id: string;
  raw_text: string;
  parsed_json: string;
  created_at: string;
}

export interface DictionaryEntry {
  id: string;
  project_id: string;
  entity_type: "table" | "column" | "relationship" | "concept";
  entity_id: string | null;
  name: string;
  definition: string;
  source: "inferred" | "ontology" | "user";
  updated_at: string;
}

export interface GraphNode {
  id: string;
  label: string;
  type: "table" | "column" | "concept";
  meta?: Record<string, unknown>;
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  label: string;
  confidence?: number;
  status?: RelationshipStatus;
}
