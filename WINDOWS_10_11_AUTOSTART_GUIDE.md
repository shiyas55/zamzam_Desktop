# Zamzam Foods — Windows 10 & Windows 11 Auto-Start & WhatsApp Setup Guide

This guide explains how to set up Zamzam Foods so that both the **SQLite Backend** and **WhatsApp Automation Bridge** start automatically in the background every time your Windows 10 or Windows 11 PC powers on.

---

## 3 Easy Steps on Windows 10 / Windows 11

In the main `zamzam foods` folder, you will see 3 numbered files:

```text
📁 zamzam foods/
  ├── 1_START_ZAMZAM_APP.bat           (Starts the Desktop App + Creates Desktop Shortcut)
  ├── 2_ENABLE_AUTOSTART_ON_BOOT.bat   (One-Click Setup: Starts Backend & WhatsApp on PC boot)
  └── 3_TEST_ZAMZAM_SERVICES.bat       (Runs automated system test + Live WhatsApp dispatch test)
```

---

### Step 1: Install Requirements (One-time only)

1. **Python 3.12**:
   - Double-click `Step_1_Install_Python_3.12.exe` (or download from [python.org](https://www.python.org/)).
   - ⚠️ **Important**: Check the box **"[x] Add python.exe to PATH"** before clicking Install.
2. **Node.js (LTS)**:
   - Download and run the Windows installer from [nodejs.org](https://nodejs.org/).
   - Click Next with standard default settings.

---

### Step 2: Enable Auto-Start on PC Power-On

👉 **Double-click `2_ENABLE_AUTOSTART_ON_BOOT.bat`**

This script configures Windows 10 / 11 using 3 redundant mechanisms:
1. **Windows Startup Folder** (`shell:startup`): Creates `ZamzamFoods_AutoStart.lnk` pointing to `run_all_hidden.vbs`.
2. **Windows Registry Run Key**: Registers `HKCU\Software\Microsoft\Windows\CurrentVersion\Run`.
3. **Windows Scheduled Tasks**: Creates a scheduled task triggered on Windows user logon.

> **100% Invisible**: Both the Django Backend (port 8000) and the WhatsApp Automation Bridge (port 3005) run completely hidden in the background. No black command prompt windows will appear on startup.

---

### Step 3: Link Your WhatsApp (One-time only)

1. Open your browser and go to:
   👉 **http://localhost:3005/qr**
2. On your phone:
   - Open **WhatsApp**
   - Tap **Settings / 3-dots** > **Linked Devices** > **Link a Device**
   - Point your phone camera at the QR code on your computer screen.
3. Once scanned, your session is saved permanently in `.wwebjs_auth/`.
4. WhatsApp stays connected automatically even after PC restarts!

---

### Step 4: Run the Auto-Test Script

👉 **Double-click `3_TEST_ZAMZAM_SERVICES.bat`**

The automated test script will:
- ✅ Check Python 3.12 installation
- ✅ Check Node.js installation
- ✅ Verify Backend server is listening on `http://127.0.0.1:8000`
- ✅ Verify WhatsApp Bridge is listening on `http://localhost:3005`
- ✅ Display your connected phone number and profile name
- ✅ Verify Auto-Start registration in Windows
- 📱 **Live Test**: Allows you to type any phone number and sends a live WhatsApp verification message immediately!

---

### Everyday Use

- Whenever you turn on your Windows 10/11 PC:
  - Backend & WhatsApp start automatically in the background.
- Whenever you want to open Zamzam Foods:
  - Double-click the **"Zamzam Foods"** shortcut on your Desktop (or `1_START_ZAMZAM_APP.bat`).
  - The app opens instantly (0-second wait).
- Whenever you turn off your PC:
  - Windows shuts down all services safely without data corruption.

---

### How to Disable Auto-Start Anytime
If you ever want to stop backend/WhatsApp from auto-starting on boot, double-click:
👉 **`disable_autostart_windows.bat`**
