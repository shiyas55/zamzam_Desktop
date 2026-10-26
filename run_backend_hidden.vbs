' ==============================================================================
' Zamzam Foods — Silent Background Backend Runner (No Console Window)
' ==============================================================================
Set WshShell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
currentDir = fso.GetParentFolderName(WScript.ScriptFullName)
WshShell.CurrentDirectory = currentDir

' 0 = Hide window completely (SW_HIDE)
' False = Do not wait for script to finish; run continuously in background
WshShell.Run "cmd.exe /c """"" & currentDir & "\start_backend_windows.bat"" /silent""", 0, False
