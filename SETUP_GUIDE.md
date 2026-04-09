# PostgreSQL Migration & Bug Fix Guide

## Overview
This guide covers:
1. **Database Migration**: SQLite → PostgreSQL
2. **Bug Fixes**: 
   - Fields showing as 0 after idle + refresh
   - Profile changing roles across tabs
   - Multi-tab synchronization issues

---

## Part 1: PostgreSQL Setup & Migration

### Step 1: Install PostgreSQL

**Windows:**
```bash
# Download and install from: https://www.postgresql.org/download/windows/
# Or use Chocolatey:
choco install postgresql
```

**Linux (Ubuntu/Debian):**
```bash
sudo apt update
sudo apt install postgresql postgresql-contrib
```

**macOS:**
```bash
brew install postgresql
```

### Step 2: Create PostgreSQL Database & User

```bash
# Start PostgreSQL service (if not running)
# Windows: Services → postgresql-x64-* → Start
# Linux: sudo systemctl start postgresql
# macOS: brew services start postgresql

# Connect to PostgreSQL
psql -U postgres

# In PostgreSQL CLI:
CREATE DATABASE mess_billing;
CREATE USER mess_user WITH PASSWORD 'your_secure_password';
ALTER ROLE mess_user SET client_encoding TO 'utf8';
ALTER ROLE mess_user SET default_transaction_isolation TO 'read committed';
ALTER ROLE mess_user SET default_transaction_deferrable TO on;
ALTER ROLE mess_user SET timezone TO 'Asia/Kolkata';
GRANT ALL PRIVILEGES ON DATABASE mess_billing TO mess_user;
\q
```

### Step 3: Update Environment Configuration

Create/copy `.env` file in `backend/` directory:

```bash
cd backend/
cp .env.example .env
```

Edit `.env` with your PostgreSQL credentials:

```env
DEBUG=True
SECRET_KEY=django-insecure-your-secret-key-2024

# PostgreSQL Configuration
DB_ENGINE=django.db.backends.postgresql
DB_NAME=mess_billing
DB_USER=mess_user
DB_PASSWORD=your_secure_password
DB_HOST=localhost
DB_PORT=5432

ALLOWED_HOSTS=localhost,127.0.0.1
CORS_ALLOWED_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
```

### Step 4: Update Django Settings to Load .env

The `settings.py` has been updated to use environment variables. If not already done, ensure `python-dotenv` is installed:

```bash
pip install python-dotenv
```

Update `backend/config/settings.py` (top of file):

```python
import os
from pathlib import Path
from datetime import timedelta
from dotenv import load_dotenv

load_dotenv()
BASE_DIR = Path(__file__).resolve().parent.parent
```

### Step 5: Install & Upgrade Dependencies

```bash
cd backend/
pip install -r requirements.txt --upgrade
```

The updated `requirements.txt` now includes `psycopg2-binary==2.9.9` for PostgreSQL support.

### Step 6: Run Migrations

```bash
cd backend/
python manage.py migrate
```

### Step 7: Create Superuser (if needed)

```bash
python manage.py createsuperuser
```

### Step 8: Back Up old SQLite Data (Optional)

```bash
# If you want to keep the old SQLite database
cp db.sqlite3 db.sqlite3.backup
```

---

## Part 2: Bug Fixes Applied

### Bug #1: Fields Showing as 0 After Idle & Refresh

**Root Cause:** SQLite concurrent access limitations + browser caching

**Fix Applied:**
- ✅ Migrated to PostgreSQL (handles concurrent requests properly)
- ✅ Added `Cache-Control` headers in API responses
- ✅ Added timestamp-based cache busting in frontend API calls
- ✅ `ProfileView` now explicitly prevents browser caching

**What Changed:**
```python
# Backend - ProfileView now adds no-cache headers
response['Cache-Control'] = 'no-cache, no-store, must-revalidate'
response['Pragma'] = 'no-cache'
response['Expires'] = '0'
```

```javascript
// Frontend - API requests include cache busting timestamp
config.params = {
  ...config.params,
  _t: new Date().getTime(),
};
```

---

### Bug #2: Profile Changing Roles Across Tabs

**Root Cause:** 
- Concurrent requests causing stale data reads in SQLite
- No synchronization between browser tabs
- JWT token handling issues with multiple simultaneous requests

**Fix Applied:**
- ✅ PostgreSQL handles concurrent requests atomically
- ✅ Added periodic profile refresh (every 15 minutes)
- ✅ Added window focus event listener to refresh profile when tab comes into focus
- ✅ Improved request/response interceptor with better token refresh logic
- ✅ Added request deduplication to prevent race conditions

**What Changed:**
```javascript
// Frontend - AuthContext now:
// 1. Refreshes profile every 15 minutes
// 2. Refreshes on window focus
// 3. Prevents concurrent requests
// 4. Deduplicates requests with refs

useEffect(() => {
  window.addEventListener('focus', handleFocus);
  // ...refresh profile on window focus
}, [token, fetchProfile]);

useEffect(() => {
  const intervalId = setInterval(() => {
    fetchProfile(true); // Periodic refresh
  }, 15 * 60 * 1000); // Every 15 minutes
}, [token, fetchProfile]);
```

---

### Bug #3: Multi-Tab Synchronization Issues

**Root Cause:** 
- Each tab had independent context state
- No communication between tabs
- Stale JWT tokens in tabs

**Fix Applied:**
- ✅ Better token refresh mechanism (shared localStorage listener)
- ✅ Periodic global profile refresh
- ✅ Window focus event triggers profile sync
- ✅ RequestResponse interceptors properly handle 401 errors

**How It Works:**
1. When one tab refreshes token → stored in localStorage
2. Other tabs can access the same refresh token
3. When tab comes into focus → automatic profile refresh
4. Every 15 minutes → all tabs sync profile data
5. If token expires → 401 triggers automatic refresh

---

## Part 3: Additional Security Enhancements

Added to `settings.py`:

```python
# Atomic database transactions
DATABASES = {
    'default': {
        'ATOMIC_REQUESTS': True,
        'CONN_MAX_AGE': 600,  # Connection pooling
        # ...
    }
}

# Session security
SESSION_COOKIE_HTTPONLY = True
SESSION_COOKIE_SECURE = False  # Set to True in production with HTTPS
SESSION_COOKIE_SAMESITE = 'Lax'

# CSRF protection
CSRF_COOKIE_HTTPONLY = True
CSRF_COOKIE_SECURE = False  # Set to True in production with HTTPS
CSRF_COOKIE_SAMESITE = 'Lax'
```

---

## Testing the Fixes

### Test 1: Multi-Tab Synchronization
1. Login to the app
2. Open 3 tabs: tab A, B, C
3. On Tab A: Go to Profile
4. On Tab B: Go to Bills
5. On Tab C: Go to Attendance
6. Refresh all 3 tabs simultaneously
7. ✅ All tabs should show correct user data (same role/fields)

### Test 2: Idle Time Recovery
1. Login to the app
2. Wait 2-3 minutes without activity
3. Refresh the page
4. ✅ Fields should NOT show 0
5. ✅ User role should be correct

### Test 3: Window Focus Sync
1. Login to the app
2. Open DevTools → Edit user in database
3. Switch away from the browser window
4. After 5+ seconds, switch back to browser
5. ✅ Profile should auto-refresh with new data

---

## Performance Configuration

### For Development:
```env
DEBUG=True
DB_CONN_MAX_AGE=600
```

### For Production:
```env
DEBUG=False
SECRET_KEY=<use-strong-random-key>
DB_CONN_MAX_AGE=3600
SESSION_COOKIE_SECURE=True
CSRF_COOKIE_SECURE=True
```

---

## Troubleshooting

### Issue: "psycopg2 not found"
```bash
pip install psycopg2-binary
```

### Issue: "Connection refused" to PostgreSQL
- Check if PostgreSQL is running
- Verify `.env` credentials match your PostgreSQL user
- Ensure database exists: `psql -l`

### Issue: Fields still showing 0 after migration
- Clear browser cache: Ctrl+Shift+Delete
- Restart development server
- Ensure `requirements.txt` was installed: `pip list | grep psycopg`

### Issue: "role change" still happening
- Force update all browser tabs:
  - Press Ctrl+F5 (hard refresh) on all tabs
  - Or: DevTools → Storage → Clear all
- Ensure backend services are restarted

---

## Rollback (if needed)

To revert to SQLite:

1. Revert `.env` database settings to SQLite
2. Restore from `db.sqlite3.backup` 
3. Don't run migrations (they're irreversible on SQLite)
4. Restart server

---

## Next Steps

1. ✅ Migrate database to PostgreSQL
2. ✅ Test bug fixes
3. ✅ Clear browser cache on all clients
4. ✅ Restart application servers
5. ✅ Monitor for any issues

---

**Questions or issues?** Check the Django logs:
```bash
python manage.py runserver --verbosity 3
```
