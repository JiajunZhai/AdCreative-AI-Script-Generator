from __future__ import annotations

import os
from dotenv import set_key

# We assume the .env file is located at the root of the backend directory.
ENV_FILE = os.path.join(os.path.dirname(__file__), ".env")

def update_env_var(key: str, value: str) -> None:
    """
    Safely update or create a key in the .env file and update os.environ.
    If the value is empty, we don't necessarily delete it, we can just set it to empty.
    """
    if not os.path.exists(ENV_FILE):
        open(ENV_FILE, "a").close()
    
    # Write to the file preserving other comments/spacing
    set_key(ENV_FILE, key, value)
    
    # Also update the current process memory so immediate logic uses the new key
    os.environ[key] = value
