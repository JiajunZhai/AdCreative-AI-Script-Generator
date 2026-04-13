import pytest
from fastapi.testclient import TestClient
import sys
import os

# Ensure backend directory is in PYTHONPATH so tests can import modules directly
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from main import app

@pytest.fixture
def client():
    return TestClient(app)
