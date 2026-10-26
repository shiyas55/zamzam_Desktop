==============================================================================
                    ZAMZAM FOODS — FULL KIT DEPLOYMENT
       Enterprise Wholesale Billing & Daily Route Dispatch System
==============================================================================

DEFAULT MASTER LOGIN ACCOUNTS:
  • Master Admin:
      Username: admin
      Password: zamzam@2026
  • Owner Account:
      Username: shiyas
      Password: zamzam@2026
  • Drivers:
      Usernames: driver_f, driver_a, driver_s
      Password : zamzam@2026

------------------------------------------------------------------------------
WINDOWS INSTRUCTIONS (1-CLICK SETUP):
------------------------------------------------------------------------------
Step 1: If Python is not installed yet on this PC:
        Double-click "Step_1_Install_Python_3.12.exe"
        (IMPORTANT: Check the box "[x] Add python.exe to PATH" during installation)

Step 2: Double-click "1_START_ZAMZAM_APP.bat"
        - Automatically starts your local database engine silently in the background.
        - Opens Zamzam Foods in a standalone, dedicated desktop window (Edge App Mode).
        - Automatically places a "Zamzam Foods" shortcut with official icon on your Desktop!
        - Login with "admin" / "zamzam@2026". All October 14 data & 130 shops load instantly!

Step 3 (Optional - Auto-Start Backend on PC Power On):
        Double-click "2_ENABLE_AUTOSTART_ON_BOOT.bat"
        - From now on, whenever your PC turns ON, the backend starts automatically.
        - When PC turns OFF, it cleanly powers off.
        - Completely silent in the background (no black terminal window!).

To Stop the Backend manually:
  • Double-click "stop_backend_windows.bat"

To Turn Off Auto-Start:
  • Double-click "disable_autostart_windows.bat"

------------------------------------------------------------------------------
macOS INSTRUCTIONS:
------------------------------------------------------------------------------
Step 1: Start the backend:
        Open Terminal in this folder and run:
        .venv/bin/python backend/manage.py runserver 127.0.0.1:8000

Step 2: Open Zamzam Foods:
        Open http://127.0.0.1:8000/ in your browser.

Step 3 (Optional - Auto-Start on Mac Boot):
        Run "./enable_autostart_mac.sh" in Terminal.
        To remove auto-start later, run "./disable_autostart_mac.sh".

==============================================================================
Support / Verification:
  Backend URL : http://127.0.0.1:8000/api/v1/
  Health Check: http://127.0.0.1:8000/api/health/
==============================================================================
