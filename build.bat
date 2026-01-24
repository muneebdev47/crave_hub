@echo off
echo Building CraveHub Cafe Executable...
echo.

REM Activate virtual environment
call venv\Scripts\activate.bat

REM Build using spec file
pyinstaller build_exe.spec

echo.
echo Build complete! Check the 'dist' folder for CraveHubCafe.exe
echo.
pause
