# 🐘 Zamzam Foods — PostgreSQL Migration & Multi-PC Client Setup Guide

This guide explains how to:
1. **Auto-run WhatsApp & Backend together** on the Server PC.
2. **Back up your existing SQLite database**.
3. **Migrate from SQLite to PostgreSQL** without losing any customer orders or prices.
4. **Configure Client PCs** to access PostgreSQL and WhatsApp seamlessly across your local network (LAN).

---

## 🏗️ Architecture Overview: Server PC vs. Client PC

```
                   ┌────────────────────────────────────────┐
                   │               SERVER PC                │
                   │                                        │
                   │  1. PostgreSQL Database (Port 5432)   │
                   │  2. Django Backend Engine (Port 8000)  │
                   │  3. WhatsApp Web Bridge (Port 3005)   │
                   └──────────────────┬─────────────────────┘
                                      │ Local WiFi / LAN Cable
                                      │ (e.g. 192.168.1.100)
                   ┌──────────────────┴─────────────────────┐
                   │               CLIENT PC                │
                   │                                        │
                   │  • Zero Database Installation Needed   │
                   │  • Zero Python Installation Needed     │
                   │  • Opens App / Chrome to Server IP     │
                   └────────────────────────────────────────┘
```

---

## Part 1: Auto-Run WhatsApp & Backend on Server Boot

You **do not need to start WhatsApp separately**. The project has a silent startup runner:

1. On the **Server PC**, run:
   ```cmd
   enable_autostart_windows.bat
   ```
2. This configures Windows to launch `run_all_hidden.vbs` on boot, which starts:
   - **Django Backend** on port `8000`
   - **WhatsApp Automation Bridge** on port `3005`
   - Automatically adds Windows Firewall permissions for ports `8000` and `3005`.
3. To start them manually anytime, simply double-click:
   ```cmd
   start_zamzam_all.bat
   ```

---

## Part 2: Step-by-Step SQLite to PostgreSQL Migration

### Method A: 1-Click Automated Migration (Recommended)

We have created an automated migration assistant script in your project folder:
1. Stop your backend if it is running.
2. Double-click **`migrate_sqlite_to_postgres.bat`**.
3. The script will:
   - Automatically make a timestamped backup of `db.sqlite3` in the `backups/` folder.
   - Export all customers, products, routes, orders, and payments to JSON.
   - Prompt you for your PostgreSQL URL (e.g. `postgres://postgres:password@localhost:5432/zamzam_foods` or Cloud Postgres).
   - Create all tables in PostgreSQL (`python manage.py migrate`).
   - Transfer all records into PostgreSQL (`python manage.py loaddata`).
   - Automatically restart the backend and WhatsApp services.

---

### Method B: Manual Step-by-Step Migration

If you prefer executing the steps manually on the **Server PC**:

#### 1. Take a Full Backup of Current SQLite Data
Open Command Prompt in your project directory:
```cmd
cd /d "C:\Users\YourUser\Documents\zamzam foods"
.venv\Scripts\python.exe backend\manage.py dumpdata --natural-foreign --natural-primary -e contenttypes -e auth.Permission --indent 2 > backups\sqlite_backup.json
copy backend\db.sqlite3 backups\db.sqlite3.bak
```

#### 2. Install & Prepare PostgreSQL on Server PC
1. Download and install PostgreSQL for Windows: [postgresql.org/download/windows](https://www.postgresql.org/download/windows/)
2. Open **SQL Shell (psql)** or **pgAdmin 4** and create the database:
   ```sql
   CREATE DATABASE zamzam_foods;
   ```

#### 3. Update `backend/.env`
Open `backend/.env` in Notepad and update line 8:
```env
# Change from:
# DATABASE_URL=sqlite:///db.sqlite3

# To your PostgreSQL connection:
DATABASE_URL=postgres://postgres:your_password@localhost:5432/zamzam_foods
```
*(If using a Cloud PostgreSQL like Aiven or Supabase, paste your cloud URL here).*

#### 4. Build Tables & Load Data
In Command Prompt:
```cmd
# Create all PostgreSQL tables
.venv\Scripts\python.exe backend\manage.py migrate

# Restore all your orders, shops, and prices into PostgreSQL
.venv\Scripts\python.exe backend\manage.py loaddata backups\sqlite_backup.json
```

#### 5. Verify & Start Services
Double click `start_zamzam_all.bat`.

---

## Part 3: Client PC Setup Guide

> [!IMPORTANT]
> **DO NOT install PostgreSQL or Python on the Client PC!**  
> The Client PC simply communicates with the Server PC over your shop WiFi / router.

### Step 1: Find the Server PC's IP Address
On the **Server PC**:
1. Press `Win + R`, type `cmd`, and press Enter.
2. Type:
   ```cmd
   ipconfig
   ```
3. Look for **IPv4 Address** under your WiFi or Ethernet adapter (e.g., `192.168.1.100`).

---

### Step 2: Ensure Firewall Allows Port 8000 & 3005 on Server PC
On the **Server PC**, open Command Prompt as Administrator and run:
```cmd
netsh advfirewall firewall add rule name="Zamzam Backend" dir=in action=allow protocol=TCP localport=8000
netsh advfirewall firewall add rule name="Zamzam WhatsApp" dir=in action=allow protocol=TCP localport=3005
```
*(This was already added to `enable_autostart_windows.bat`)*.

---

### Step 3: Connect from the Client PC
On the **Client PC**:
1. Open Google Chrome, Microsoft Edge, or the Zamzam Foods desktop application.
2. If accessing via web browser, navigate to:
   ```
   http://192.168.1.100:8000
   ```
   *(Replace `192.168.1.100` with the actual Server IP)*.
3. If using the installed Desktop App:
   - On the login screen, click **Server URL** (or gear icon).
   - Enter `http://192.168.1.100:8000` and click **Save**.
   - Log in with your username and password.

---

### Step 4: WhatsApp Scanning & Invoicing from Client PC
- In **Settings** &rarr; **WhatsApp Laptop Bridge**, the Client PC automatically detects the bridge at:
  ```
  http://192.168.1.100:3005
  ```
- Clicking **Link WhatsApp (Scan QR)** opens the QR code directly from the Server PC!
- Whenever staff on the Client PC click **Send Bill via WhatsApp**, the invoice image or PDF is generated and sent through the central WhatsApp linked on the Server PC!
