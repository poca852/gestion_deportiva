"""Sync supabase/migrations from production schema_migrations export."""
import json
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_DIR = os.path.join(ROOT, "supabase", "migrations")
EXPORT = os.path.join(
    os.path.expanduser("~"),
    ".cursor",
    "projects",
    "d-programacion-real-libertad-real-libertad-app",
    "agent-tools",
    "b0a04e42-46f7-4832-a01a-733902c09e90.txt",
)

LEGACY_FILES = [
    "20250531120000_academia_config.sql",
    "20250531140000_rls_storage_hardening.sql",
    "20250601000000_convocatoria_firma_sello.sql",
    "20250601120000_entrenador_categorias_multiples.sql",
    "20250601130000_fix_handle_new_user_trigger.sql",
    "20250601140000_alumno_talla_documento_padre.sql",
    "20250601150000_alumno_nivel_firma.sql",
    "20250601160000_alumno_fecha_ingreso.sql",
    "20250601170000_cleanup_alumno_firma.sql",
    "20250602000000_multi_tenant_academias.sql",
]


def load_migrations(path: str) -> list[dict]:
    with open(path, encoding="utf-8") as f:
        data = json.load(f)
    text = data["result"]
    match = re.search(
        r"<untrusted-data-[^>]+>\s*(\[.*\])\s*</untrusted-data-", text, re.DOTALL
    )
    if not match:
        raise RuntimeError("Could not parse migration export")
    return json.loads(match.group(1))


def main() -> int:
    export_path = sys.argv[1] if len(sys.argv) > 1 else EXPORT
    migrations = load_migrations(export_path)
    os.makedirs(OUT_DIR, exist_ok=True)

    for m in migrations:
        filename = f"{m['version']}_{m['name']}.sql"
        sql = "\n\n".join(m.get("statements") or []).strip() + "\n"
        path = os.path.join(OUT_DIR, filename)
        with open(path, "w", encoding="utf-8", newline="\n") as f:
            f.write(sql)
        print(f"wrote {filename}")

    for legacy in LEGACY_FILES:
        path = os.path.join(OUT_DIR, legacy)
        if os.path.exists(path):
            os.remove(path)
            print(f"removed legacy {legacy}")

    print(f"done: {len(migrations)} production migrations")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
