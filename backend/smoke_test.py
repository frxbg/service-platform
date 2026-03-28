import sys
try:
    from app.main import app
    from fastapi.testclient import TestClient
    
    client = TestClient(app)
    response = client.get("/docs")
    if response.status_code == 200:
        print("Smoke test passed: successfully imported app and fetched /docs.")
        sys.exit(0)
    else:
        print(f"Smoke test failed: /docs returned {response.status_code}")
        sys.exit(1)
except Exception as e:
    print(f"Smoke test failed during import/startup: {e}")
    sys.exit(1)
