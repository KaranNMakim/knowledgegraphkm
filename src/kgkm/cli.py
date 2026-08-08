import argparse

import uvicorn

from kgkm.database import initialize_database


def main() -> None:
    parser = argparse.ArgumentParser(description="KnowledgeGraphKM development server")
    parser.add_argument("--host", default="0.0.0.0")
    parser.add_argument("--port", default=8000, type=int)
    parser.add_argument("--init-db", action="store_true", help="Initialize the internal database")
    args = parser.parse_args()

    if args.init_db:
        initialize_database()
        print("Internal database initialized.")
        return

    uvicorn.run("kgkm.main:app", host=args.host, port=args.port, reload=False)


if __name__ == "__main__":
    main()
