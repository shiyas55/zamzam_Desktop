# Zamzam Foods — Windows Installation & Operation Guide (Aiven Cloud Edition)

> **Architecture:** 100% Free — Zero Railway ($0/mo), Zero Vercel ($0/mo)  
> **Database:** Live Online Aiven PostgreSQL Cloud Database  
> **Application:** Native Windows Desktop Application (`.exe`)  
> **Backend:** Local High-Performance Engine on Windows (`http://127.0.0.1:8000`)

---

## Table of Contents
1. [Overview & How It Works](#1-overview--how-it-works)
2. [Step 1: Install Python (First Time Only)](#step-1-install-python-first-time-only)
3. [Step 2: Download the Project Folder](#step-2-download-the-project-folder)
4. [Step 3: Run the First-Time Engine Setup](#step-3-run-the-first-time-engine-setup)
5. [Step 4: Install the Desktop App (.exe)](#step-4-install-the-desktop-app-exe)
6. [Step 5: Daily Usage & Automatic Shortcut](#step-5-daily-usage--automatic-shortcut)
7. [Step 6: Optional — Auto-Start with Windows](#step-6-optional--auto-start-with-windows)
8. [Troubleshooting & FAQ](#troubleshooting--faq)

---

## 1. Overview & How It Works

```
┌─────────────────────────────────────────────────────────────┐
│                     Your Windows PC                         │
│                                                             │
│  ┌───────────────────────┐       ┌───────────────────────┐  │
│  │  Zamzam Foods Desktop │ ────> │ Local Backend Engine  │  │
│  │      (.EXE App)       │ <──── │  (127.0.0.1:8000)     │  │
│  └───────────────────────┘       └───────────┬───────────┘  │
└──────────────────────────────────────────────┼──────────────┘
                                               │ (Encrypted TLS 1.3)
                                               ▼
                         ┌───────────────────────────────────────────┐
                         │    Aiven PostgreSQL Cloud Database        │
                         │ (Authoritative Real-Time Data Storage)    │
                         └───────────────────────────────────────────┘
```

* **No Monthly Fees:** Zero subscription cost. You do not pay Railway or Vercel.
* **Live Cloud Database:** All data is safely stored on Aiven PostgreSQL Cloud (`pg-65e4170-zamzamfoods.h.aivencloud.com`).
* **Offline Safety:** Local engine runs directly on your PC with zero network latency for user interactions.

---

## Step 1: Install Python (First Time Only)

1. Open your browser and download Python:
   👉 **[https://www.python.org/downloads/](https://www.python.org/downloads/)**
2. Click **"Download Python 3.12"** (or any version 3.10+).
3. Run the installer file (`python-3.x.x-amd64.exe`).
4. ⚠️ **MANDATORY STEP:** At the very bottom of the installer window, check:
   > ☑ **Add python.exe to PATH**
5. Click **"Install Now"** and click **Close** once finished.

---

## Step 2: Download the Project Folder

Choose either method:

### Method A: Download ZIP (Recommended for Non-Developers)
1. Go to: **[github.com/shiyas55/zamzamfoods](https://github.com/shiyas55/zamzamfoods)**
2. Click the green **`<> Code`** button ➔ Click **`Download ZIP`**.
3. Right-click the downloaded `.zip` file ➔ Click **"Extract All..."**.
4. Choose a folder location, for example: `C:\ZamzamFoods`.

### Method B: Git Clone (For Developers)
Open Command Prompt (`cmd`) and run:
```cmd
git clone https://github.com/shiyas55/zamzamfoods.git C:\ZamzamFoods
cd C:\ZamzamFoods
```

---

## Step 3: Run the First-Time Engine Setup

1. Open the extracted `zamzamfoods` folder.
2. Find the file: **`start_backend_windows.bat`**.
3. **Double-click it.**
4. The script will automatically:
   * Create the Python virtual environment (`.venv`).
   * Download and install all required packages (`Django`, `DRF`, `psycopg2-binary`, etc.).
   * Connect to your online **Aiven PostgreSQL** database.
   * Run database migrations automatically.
   * Start the server on `http://127.0.0.1:8000`.
5. You will see:
   ```
   ==============================================================================
    BACKEND SERVER RUNNING AT: http://127.0.0.1:8000/api/v1/
    ONLINE DATABASE          : Aiven PostgreSQL Cloud
    NO RAILWAY / NO VERCEL   : 100% Free Local Setup
   ==============================================================================
   ```

---

## Step 4: Install the Desktop App (.exe)

1. Go to your GitHub repository actions page:
   👉 **[github.com/shiyas55/zamzamfoods/actions](https://github.com/shiyas55/zamzamfoods/actions)**
2. Click the latest successful run: **`Build Desktop App (Windows .EXE & macOS .DMG)`**.
3. Scroll down to the **Artifacts** section at the bottom.
4. Download **`windows-exe`**.
5. Extract the `.zip` file and run:
   **`Zamzam Foods_x64-setup.exe`** (or `Zamzam Foods.exe`).
6. Complete the setup wizard.

---

## Step 5: Daily Usage & Automatic Shortcut

You never need to run complicated terminal commands.

Inside your `zamzamfoods` folder:
1. Double-click: **`start_zamzam_all.bat`**.
2. **On First Run:** It **automatically creates a `Zamzam Foods` shortcut on your Windows Desktop** with the application icon.
3. It starts the local backend service in the background and opens the application window.
4. From now on, you can simply **double-click the "Zamzam Foods" icon on your Desktop**!

---

## Step 6: Optional — Auto-Start with Windows

If you want the application to **start automatically every morning when the computer turns on**:

1. Inside your `zamzamfoods` folder, find:
   **`enable_autostart_windows.bat`**
2. **Double-click it once.**
3. A green confirmation will appear:
   `[SUCCESS] Zamzam Foods will now start automatically whenever Windows turns on!`
4. Done! Every time Windows boots, the engine launches silently in the background.

---

## Troubleshooting & FAQ

### Q1: `python` is not recognized as an internal or external command?
* **Solution:** Re-run the Python installer, select **Modify**, and make sure the **"Add Python to environment variables"** checkbox is selected.

### Q2: How do I know if it is connected to Aiven Cloud?
* When `start_backend_windows.bat` runs, it prints `Checking database schema on Aiven Cloud...`. If internet is working, it verifies all 128 customer records immediately.

### Q3: What happens if the internet goes down?
* Aiven requires an active internet connection to load and save cloud data. Ensure your PC is connected to Wi-Fi, Ethernet, or a mobile hotspot.

### Q4: Can I use this on multiple Windows PCs?
* **Yes!** You can install this exact folder and `.exe` on as many Windows computers as you want. All of them connect to the **same single Aiven Cloud Database**, so orders made on PC #1 immediately appear on PC #2.

---

*Zamzam Foods Wholesale & Distribution Management System*
