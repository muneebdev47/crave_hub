# -*- mode: python ; coding: utf-8 -*-
# PyInstaller spec file for CraveHub Cafe

import os
from pathlib import Path
from PyInstaller.utils.hooks import collect_submodules

block_cipher = None

# Get the project root directory
# project_root = Path(__file__).resolve().parent

project_root = Path(os.getcwd())  # current directory where pyinstaller is run


# Data files to include
datas = [
    # Frontend files
    (str(project_root / 'frontend'), 'frontend'),
    # Database schema
    (str(project_root / 'database' / 'schema.sql'), 'database'),
    # Assets (logo, icons, styles)
    (str(project_root / 'assets'), 'assets'),
]

# Hidden imports (PyQt6 WebEngine needs these)
hiddenimports = [
    'PyQt6.QtWebEngineWidgets',
    'PyQt6.QtWebChannel',
    'PyQt6.QtWebEngineCore',
    'PyQt6.QtPrintSupport',
]

a = Analysis(
    [str(project_root / 'main.py')],
    pathex=[],
    binaries=[],
    datas=datas,
    hiddenimports=hiddenimports,
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.zipfiles,
    a.datas,
    [],
    name='CraveHubCafe',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=False,  # Set to True if you want to see console output for debugging
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
    icon=str(project_root / 'assets' / 'logo.png') if (project_root / 'assets' / 'logo.png').exists() else None,
)
