# Building CraveHub Cafe Executable

This guide explains how to create a standalone `.exe` file for Windows (or `.app` for macOS) from your PyQt6 application.

## Prerequisites

1. **Python 3.12** (or compatible version)
2. **PyInstaller** (already in requirements.txt)
3. **All dependencies installed** in your virtual environment

## Step 1: Activate Virtual Environment

```bash
# On Windows
venv\Scripts\activate

# On macOS/Linux
source venv/bin/activate
```

## Step 2: Install/Verify PyInstaller

```bash
pip install pyinstaller
```

## Step 3: Build the Executable

### Option A: Using the Spec File (Recommended)

```bash
pyinstaller build_exe.spec
```

### Option B: Using Command Line

```bash
pyinstaller --name="CraveHubCafe" ^
    --windowed ^
    --onefile ^
    --add-data "frontend;frontend" ^
    --add-data "database/schema.sql;database" ^
    --add-data "assets;assets" ^
    --hidden-import=PyQt6.QtWebEngineWidgets ^
    --hidden-import=PyQt6.QtWebChannel ^
    --hidden-import=PyQt6.QtWebEngineCore ^
    --icon=assets/logo.png ^
    main.py
```

**For macOS/Linux**, use `:` instead of `;` in `--add-data`:
```bash
pyinstaller --name="CraveHubCafe" \
    --windowed \
    --onefile \
    --add-data "frontend:frontend" \
    --add-data "database/schema.sql:database" \
    --add-data "assets:assets" \
    --hidden-import=PyQt6.QtWebEngineWidgets \
    --hidden-import=PyQt6.QtWebChannel \
    --hidden-import=PyQt6.QtWebEngineCore \
    --icon=assets/logo.png \
    main.py
```

## Step 4: Find Your Executable

After building, you'll find:
- **Windows**: `dist/CraveHubCafe.exe`
- **macOS**: `dist/CraveHubCafe.app`
- **Linux**: `dist/CraveHubCafe`

## Database Handling

### ✅ Automatic Initialization

The database **will be automatically initialized** when the app runs for the first time. The `database/db.py` file checks if tables exist and creates them if not.

### ✅ Data Persistence

**Yes, your database data will be preserved!** Here's how:

1. **In Development**: Database is stored at `cravehub.db` in the project root
2. **In Executable**: Database is stored as `cravehub.db` **next to the executable file** (not inside the bundle)

This means:
- ✅ Each user gets their own database file
- ✅ Database persists between app updates
- ✅ Data is not lost when you rebuild the executable
- ✅ Database is accessible and can be backed up

### Database Location

- **Development**: `C:\Users\...\crave_hub\cravehub.db`
- **Production**: `C:\Users\...\Desktop\CraveHubCafe.exe` and `C:\Users\...\Desktop\cravehub.db` (same folder)

## Important Notes

### 1. First Run
- On first run, the app will create `cravehub.db` next to the executable
- The schema will be automatically applied from `schema.sql` (bundled in the .exe)

### 2. Existing Data
- If you want to include existing data, copy `cravehub.db` to the same folder as the executable
- Or use the seed script before building to populate initial data

### 3. Testing
- Test the executable in a clean folder to ensure it works standalone
- The database will be created automatically on first run

### 4. Distribution
When distributing your app:
- Include `CraveHubCafe.exe` (or `.app`)
- Optionally include `cravehub.db` if you want to ship with initial data
- Users can run the .exe and it will create its own database

## Troubleshooting

### Issue: "Module not found" errors
**Solution**: Add missing modules to `hiddenimports` in `build_exe.spec`

### Issue: WebEngine not working
**Solution**: Ensure `PyQt6.QtWebEngineWidgets` and related modules are in `hiddenimports`

### Issue: Database not found
**Solution**: Check that `database/schema.sql` is included in `datas` in the spec file

### Issue: Assets (images, CSS) not loading
**Solution**: Verify all asset paths are included in `datas` in the spec file

### Issue: Large file size
**Solution**: This is normal for PyQt6 apps (usually 100-200MB). PyInstaller bundles Python, Qt, and all dependencies.

## File Structure After Build

```
dist/
├── CraveHubCafe.exe    # Your executable
└── (other files if not --onefile)

# When user runs the app, database is created here:
├── cravehub.db         # Created automatically on first run
```

## Advanced: Two-File Mode

If you want faster startup and smaller main file, use `--onedir` instead of `--onefile`:

```bash
pyinstaller --name="CraveHubCafe" --windowed --onedir ...
```

This creates a folder with the executable and dependencies.

## Summary

✅ **Database auto-initializes**: Yes, on first run  
✅ **Data persists**: Yes, stored next to executable  
✅ **Works standalone**: Yes, no Python installation needed  
✅ **Includes all assets**: Yes, bundled in executable  

Your app is ready to distribute! 🚀
