# +-------------------------------------------------------------------------+
# | PythonAnywhere WSGI Configuration for Zamzam Foods                      |
# +-------------------------------------------------------------------------+
# Instructions:
# In your PythonAnywhere Web tab, click on the "WSGI configuration file" link
# and replace its contents with the code below (replace YOUR_PYTHONANYWHERE_USERNAME with your actual username).

import os
import sys
from pathlib import Path

# 1. Update this to your PythonAnywhere username!
USERNAME = os.environ.get("USER", "YOUR_PYTHONANYWHERE_USERNAME")

# 2. Add backend project directory to python sys.path
PROJECT_DIR = f"/home/{USERNAME}/zamzamfoods/backend"
if PROJECT_DIR not in sys.path:
    sys.path.insert(0, PROJECT_DIR)

# 3. Environment variables
os.environ["DJANGO_SETTINGS_MODULE"] = "config.settings.production"
os.environ["DJANGO_ENV"] = "production"
os.environ["DJANGO_DEBUG"] = "False"
os.environ["DJANGO_SECRET_KEY"] = "zamzam-foods-production-secret-key-2026-safe"
os.environ["JWT_SECRET_KEY"] = "zamzam-jwt-production-secret-key-2026-safe"

# 4. Use Fast Local SQLite database with all 128 shops and 5 users
os.environ["DATABASE_URL"] = f"sqlite:////home/{USERNAME}/zamzamfoods/backend/db.sqlite3"

# 5. Serve Django WSGI application
from django.core.wsgi import get_wsgi_application
application = get_wsgi_application()
