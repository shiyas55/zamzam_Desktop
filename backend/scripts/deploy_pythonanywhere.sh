#!/usr/bin/env bash
# ==============================================================================
# Zamzam Foods — 1-Click PythonAnywhere Automated Setup Script
# ==============================================================================
set -e

echo "=== [1/5] Setting up Virtual Environment for Python 3.10 ==="
VENV_PATH="$HOME/.virtualenvs/zamzam-venv"
if [ ! -d "$VENV_PATH" ]; then
    python3.10 -m venv "$VENV_PATH"
fi
source "$VENV_PATH/bin/activate"

echo "=== [2/5] Installing Backend Dependencies ==="
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
BACKEND_DIR="$( cd "$SCRIPT_DIR/.." && pwd )"
cd "$BACKEND_DIR"

pip install --upgrade pip
pip install -r requirements.txt

echo "=== [3/5] Setting up Database (SQLite with 128 Shops & 5 Users) ==="
export DJANGO_SETTINGS_MODULE="config.settings.production"
export DJANGO_DEBUG="False"
export DJANGO_ENV="production"
export DATABASE_URL="sqlite:///$BACKEND_DIR/db.sqlite3"
export DJANGO_SECRET_KEY="zamzam-foods-production-secret-key-2026-safe"
export JWT_SECRET_KEY="zamzam-jwt-production-secret-key-2026-safe"

python manage.py migrate --noinput

# If db.sqlite3 doesn't have shops, restore from the clean backup fixture
SHOP_COUNT=$(python -c "
import django; django.setup()
from apps.customers.models import Customer
print(Customer.objects.count())
" 2>/dev/null || echo "0")

if [ "$SHOP_COUNT" -lt "10" ]; then
    echo "Importing 128 shops and 5 users from backup fixture..."
    python manage.py loaddata "$BACKEND_DIR/../backups/zamzam_shops_and_users_only.json"
fi

echo "=== [4/5] Collecting Static Files ==="
python manage.py collectstatic --noinput

echo ""
echo "=============================================================================="
echo "                   SETUP COMPLETE ON PYTHONANYWHERE!                        "
echo "=============================================================================="
echo "Next simple steps in your PythonAnywhere Dashboard:"
echo "1. Go to the 'Web' tab"
echo "2. If you don't have a web app yet, click 'Add a new web app' -> 'Manual configuration' -> 'Python 3.10'"
echo "3. In 'Virtualenv', enter:"
echo "   $HOME/.virtualenvs/zamzam-venv"
echo "4. In 'Code' section:"
echo "   Source code:  $BACKEND_DIR"
echo "   Working dir:  $BACKEND_DIR"
echo "5. Click on 'WSGI configuration file' link, delete everything and paste the code from:"
echo "   $BACKEND_DIR/pythonanywhere_wsgi.py"
echo "   (Replace YOUR_PYTHONANYWHERE_USERNAME with your actual username: $(whoami))"
echo "6. In 'Static files' section:"
echo "   URL: /static/      Directory: $BACKEND_DIR/staticfiles"
echo "7. Click the green 'Reload <yourusername>.pythonanywhere.com' button at the top!"
echo "=============================================================================="
