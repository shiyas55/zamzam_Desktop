; Zamzam Foods NSIS Installer Script
; Modern, high-compression Windows installer for Zamzam Foods Desktop

!include "MUI2.nsh"
!include "FileFunc.nsh"

; General Configuration
Name "Zamzam Foods"
Caption "Zamzam Foods Setup"
OutFile "../frontend/src-tauri/target/x86_64-pc-windows-msvc/release/bundle/nsis/Zamzam Foods_1.0.3_x64-setup.exe"
InstallDir "$LOCALAPPDATA\Programs\Zamzam Foods"
InstallDirRegKey HKCU "Software\Zamzam Foods" "Install_Dir"
RequestExecutionLevel user
SetCompressor /SOLID lzma

; Interface Settings
!define MUI_ABORTWARNING
!define MUI_ICON "../frontend/src-tauri/icons/icon.ico"
!define MUI_UNICON "../frontend/src-tauri/icons/icon.ico"

; Installer Pages
!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES

!define MUI_FINISHPAGE_RUN "$INSTDIR\Zamzam Foods.exe"
!define MUI_FINISHPAGE_RUN_TEXT "Launch Zamzam Foods"
!insertmacro MUI_PAGE_FINISH

; Uninstaller Pages
!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES

; Languages
!insertmacro MUI_LANGUAGE "English"

Section "Zamzam Foods Application" SecApp
  SetOutPath "$INSTDIR"
  
  ; Application Files
  File "/oname=Zamzam Foods.exe" "../frontend/src-tauri/target/x86_64-pc-windows-msvc/release/Zamzam Foods.exe"
  File "../frontend/src-tauri/icons/icon.ico"

  ; Store installation folder in registry
  WriteRegStr HKCU "Software\Zamzam Foods" "Install_Dir" "$INSTDIR"

  ; Create Uninstaller
  WriteUninstaller "$INSTDIR\uninstall.exe"

  ; Add/Remove Programs Registry Entries
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\ZamzamFoods" "DisplayName" "Zamzam Foods — Enterprise Distribution Management"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\ZamzamFoods" "UninstallString" '"$INSTDIR\uninstall.exe"'
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\ZamzamFoods" "DisplayIcon" '"$INSTDIR\icon.ico"'
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\ZamzamFoods" "Publisher" "Zamzam Foods"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\ZamzamFoods" "DisplayVersion" "1.0.3"

  ; Shortcuts
  CreateDirectory "$SMPROGRAMS\Zamzam Foods"
  CreateShortcut "$SMPROGRAMS\Zamzam Foods\Zamzam Foods.lnk" "$INSTDIR\Zamzam Foods.exe" "" "$INSTDIR\icon.ico" 0
  CreateShortcut "$SMPROGRAMS\Zamzam Foods\Uninstall Zamzam Foods.lnk" "$INSTDIR\uninstall.exe" "" "$INSTDIR\uninstall.exe" 0
  CreateShortcut "$DESKTOP\Zamzam Foods.lnk" "$INSTDIR\Zamzam Foods.exe" "" "$INSTDIR\icon.ico" 0
SectionEnd

Section "Uninstall"
  ; Remove shortcuts
  Delete "$DESKTOP\Zamzam Foods.lnk"
  Delete "$SMPROGRAMS\Zamzam Foods\Zamzam Foods.lnk"
  Delete "$SMPROGRAMS\Zamzam Foods\Uninstall Zamzam Foods.lnk"
  RMDir "$SMPROGRAMS\Zamzam Foods"

  ; Remove application files
  Delete "$INSTDIR\Zamzam Foods.exe"
  Delete "$INSTDIR\icon.ico"
  Delete "$INSTDIR\uninstall.exe"
  RMDir "$INSTDIR"

  ; Remove Registry Keys
  DeleteRegKey HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\ZamzamFoods"
  DeleteRegKey HKCU "Software\Zamzam Foods"
SectionEnd
