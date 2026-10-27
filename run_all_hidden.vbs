' ==============================================================================
' Zamzam Foods — Silent Background Services Runner for Windows 10 / Windows 11
' Starts both SQLite Django Backend (8000) and WhatsApp Bridge (3005) invisibly
' ==============================================================================
Set WshShell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
currentDir = fso.GetParentFolderName(WScript.ScriptFullName)
WshShell.CurrentDirectory = currentDir

' Window style 0 = SW_HIDE (No console window, 100% invisible)
' False = Asynchronous (Runs in background continuously)

' 1. Start Django Backend on Port 8000
WshShell.Run "cmd.exe /c """ & currentDir & "\start_backend_windows.bat"" /silent", 0, False

' 2. Start WhatsApp Bridge on Port 3005
WshShell.Run "cmd.exe /c """ & currentDir & "\start_whatsapp_bridge.bat"" /silent", 0, False
