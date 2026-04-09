# Deployment Guide (Production)

This guide gives a reliable deployment path for this project.

## What Was Fixed For Deployment

- `backend/requirements.txt` is now portable and server-friendly.
- Backend now reads `CORS_ALLOWED_ORIGINS` and `CSRF_TRUSTED_ORIGINS` from environment variables.
- Backend now reads `SESSION_COOKIE_SECURE` and `CSRF_COOKIE_SECURE` from environment variables.
- Frontend API base URL is configurable through `VITE_API_BASE_URL`.

## Option A: Deploy Backend on Render + Frontend on Vercel/Netlify

## 1. Backend (Render)

1. Create a PostgreSQL database in Render.
2. Create a new Web Service from the `backend` folder.
3. Set these environment variables:

```env
DEBUG=False
SECRET_KEY=<your-strong-secret>
ALLOWED_HOSTS=<your-render-backend-domain>

DB_ENGINE=django.db.backends.postgresql
DB_NAME=<from-render-db>
DB_USER=<from-render-db>
DB_PASSWORD=<from-render-db>
DB_HOST=<from-render-db>
DB_PORT=5432

CORS_ALLOWED_ORIGINS=https://<your-frontend-domain>
CSRF_TRUSTED_ORIGINS=https://<your-frontend-domain>

SESSION_COOKIE_SECURE=True
CSRF_COOKIE_SECURE=True
```

4. Build command:

```bash
pip install -r requirements.txt && python manage.py collectstatic --noinput && python manage.py migrate
```

5. Start command:

```bash
gunicorn config.wsgi:application --bind 0.0.0.0:$PORT
```

6. (Optional) Seed initial data once:

```bash
python manage.py init_data
```

## 2. Frontend (Vercel/Netlify)

1. Deploy the `frontend` folder.
2. Set environment variable:

```env
VITE_API_BASE_URL=https://<your-render-backend-domain>/api
```

3. Build command:

```bash
npm ci && npm run build
```

4. Output directory: `dist`

## Option B: Single VPS (Nginx + Gunicorn + PostgreSQL)

Use this if you want one domain with same-origin API routing.

## 1. Server setup

```bash
sudo apt update
sudo apt install -y python3-venv python3-pip nginx postgresql postgresql-contrib
```

## 2. Backend setup

```bash
cd /var/www/messbillingproject/backend
python3 -m venv .venv
source .venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt
python manage.py migrate
python manage.py collectstatic --noinput
```

Create `.env` in `backend/` with production values:

```env
DEBUG=False
SECRET_KEY=<your-strong-secret>
ALLOWED_HOSTS=<your-domain>,www.<your-domain>

DB_ENGINE=django.db.backends.postgresql
DB_NAME=mess_billing
DB_USER=mess_user
DB_PASSWORD=<db-password>
DB_HOST=localhost
DB_PORT=5432

CORS_ALLOWED_ORIGINS=https://<your-domain>
CSRF_TRUSTED_ORIGINS=https://<your-domain>

SESSION_COOKIE_SECURE=True
CSRF_COOKIE_SECURE=True
```

Run backend with Gunicorn:

```bash
gunicorn config.wsgi:application --bind 127.0.0.1:8000 --workers 3
```

## 3. Frontend setup

```bash
cd /var/www/messbillingproject/frontend
npm ci
VITE_API_BASE_URL=/api npm run build
```

Copy frontend build to Nginx-served directory (example):

```bash
sudo mkdir -p /var/www/messbilling-frontend
sudo cp -r dist/* /var/www/messbilling-frontend/
```

## 4. Nginx config (single domain)

```nginx
server {
    listen 80;
    server_name <your-domain>;

    root /var/www/messbilling-frontend;
    index index.html;

    location / {
        try_files $uri /index.html;
    }

    location /api/ {
        proxy_pass http://127.0.0.1:8000/api/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /media/ {
        proxy_pass http://127.0.0.1:8000/media/;
    }

    location /static/ {
        alias /var/www/messbillingproject/backend/staticfiles/;
    }
}
```

Then enable HTTPS (recommended):

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d <your-domain>
```

## Post-Deployment Checklist

- Verify backend health: `https://<backend-domain>/api/auth/login/` responds.
- Verify frontend can log in and fetch profile.
- Verify payment receipt uploads work (`/media/receipts/...`).
- Verify token refresh after idle period.
- Verify multi-tab behavior (role/profile consistency).

## Common Issues

- `Invalid HTTP_HOST header`: add domain to `ALLOWED_HOSTS`.
- CORS error in browser: fix `CORS_ALLOWED_ORIGINS` and `CSRF_TRUSTED_ORIGINS`.
- Static files missing: run `collectstatic` and verify Nginx static path.
- 500 on startup: verify PostgreSQL credentials and migration state.
