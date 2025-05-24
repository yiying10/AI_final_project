import json
from pathlib import Path

DATA_FILE = Path(__file__).parent.parent.parent / "data" / "world.json"

def read_json():
    with open(DATA_FILE, encoding="utf-8") as f:
        return json.load(f)