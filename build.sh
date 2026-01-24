#!/bin/bash
echo "Building CraveHub Cafe Executable..."
echo ""

# Activate virtual environment
source venv/bin/activate

# Build using spec file
pyinstaller build_exe.spec

echo ""
echo "Build complete! Check the 'dist' folder for CraveHubCafe"
echo ""
