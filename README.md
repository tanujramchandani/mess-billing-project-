# Mess Billing Management System

A full-stack web application for managing hostel mess billing, attendance tracking, payments, and dispute resolution. Built with Django REST Framework and React.

## Features

- **Role-Based Access Control** — Three user roles: Student, Contractor, and Warden, each with distinct permissions
- **Attendance Tracking** — Daily attendance marking (individual and bulk), monthly summaries, and trend analysis
- **Mess Rate Management** — Configure daily mess charges per month/year
- **Automated Bill Generation** — Monthly bills calculated from attendance records and daily rates
- **Payment Processing** — Support for cash, online, and cheque payments with receipt upload and verification workflow
- **Dispute Resolution** — Students raise disputes, contractors respond, wardens resolve
- **Analytics Dashboards** — Role-specific dashboards with charts, stats, and trend data
- **Audit Logging** — Tracks all actions for compliance and activity monitoring

## Tech Stack

### Backend
- Python 3.x
- Django 4.2
- Django REST Framework 3.15
- SimpleJWT (JWT authentication)
- SQLite (development database)

### Frontend
- React 19
- Vite 6
- Tailwind CSS 4
- React Router 7
- Axios
- Recharts (charts)
- Headless UI

## Project Structure

```
messbillingproject/
├── backend/
│   ├── config/            # Django settings, root URLs, WSGI
│   ├── accounts/          # User authentication & management
│   ├── attendance/        # Attendance & mess rate management
│   ├── billing/           # Bill generation & management
│   ├── payments/          # Payment processing & verification
│   ├── disputes/          # Dispute handling & resolution
│   ├── analytics/         # Dashboard & reporting endpoints
│   ├── audit_logs/        # Activity tracking
│   ├── manage.py
│   └── requirements.txt
│
└── frontend/
    ├── src/
    │   ├── pages/         # Page components (Dashboard, Bills, etc.)
    │   ├── components/    # Reusable UI components
    │   ├── services/      # API integration (Axios)
    │   ├── context/       # React context (AuthContext)
    │   ├── App.jsx        # Routing & app shell
    │   └── main.jsx       # Entry point
    ├── package.json
    └── vite.config.js
```

## Getting Started

### Prerequisites

- Python 3.8+
- Node.js 18+
- npm or yarn

### Backend Setup

```bash
cd backend

# Create and activate virtual environment
python -m venv venv
venv\Scripts\activate        # Windows
# source venv/bin/activate   # macOS/Linux

# Install dependencies
pip install -r requirements.txt

# Run database migrations
python manage.py migrate

# (Optional) Load initial seed data
python manage.py init_data

# Start the development server
python manage.py runserver
```

The backend runs at `http://localhost:8000`.

### Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Start the development server
npm run dev
```

The frontend runs at `http://localhost:5173` and proxies API requests to the backend.

### Production Build

```bash
cd frontend
npm run build
```

## API Endpoints

### Authentication (`/api/auth/`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register/` | Register a new user |
| POST | `/api/auth/login/` | Login and receive JWT tokens |
| POST | `/api/auth/token/refresh/` | Refresh access token |
| GET/PUT | `/api/auth/profile/` | View or update profile |
| POST | `/api/auth/change-password/` | Change password |
| GET | `/api/auth/users/` | List all users (warden only) |
| GET | `/api/auth/students/` | List students |

### Attendance (`/api/attendance/`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/attendance/` | List attendance records |
| POST | `/api/attendance/` | Mark attendance |
| POST | `/api/attendance/bulk/` | Bulk mark attendance |
| GET | `/api/attendance/summary/` | Monthly attendance summary |
| GET | `/api/attendance/my/` | Student's own attendance |

### Mess Rates (`/api/mess-rates/`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/mess-rates/` | List all mess rates |
| POST | `/api/mess-rates/` | Create a mess rate |
| GET | `/api/mess-rates/active/` | Get active mess rate |

### Bills (`/api/bills/`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/bills/` | List bills |
| POST | `/api/bills/generate/` | Generate monthly bills |
| GET | `/api/bills/{id}/` | Bill detail |
| GET | `/api/bills/my/` | Student's own bills |

### Payments (`/api/payments/`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/payments/` | List payments |
| POST | `/api/payments/` | Submit a payment |
| POST | `/api/payments/{id}/verify/` | Verify a payment |
| POST | `/api/payments/{id}/reject/` | Reject a payment |
| GET | `/api/payments/my/` | Student's own payments |

### Disputes (`/api/disputes/`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/disputes/` | List disputes |
| POST | `/api/disputes/` | Create a dispute |
| POST | `/api/disputes/{id}/respond/` | Contractor responds |
| POST | `/api/disputes/{id}/resolve/` | Warden resolves |
| POST | `/api/disputes/{id}/reject/` | Warden rejects |
| GET | `/api/disputes/my/` | Student's own disputes |

### Analytics (`/api/analytics/`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/analytics/dashboard/` | Role-specific dashboard stats |
| GET | `/api/analytics/attendance-trends/` | Attendance trend data |
| GET | `/api/analytics/billing-summary/` | Monthly billing summary |
| GET | `/api/analytics/dispute-stats/` | Dispute statistics |
| GET | `/api/analytics/payment-stats/` | Payment statistics |

### Audit Logs (`/api/audit-logs/`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/audit-logs/` | List audit logs |
| GET | `/api/audit-logs/{id}/` | Audit log detail |

## User Roles & Permissions

| Feature | Student | Contractor | Warden |
|---------|---------|------------|--------|
| View own attendance | Yes | — | — |
| Mark attendance | — | Yes | Yes |
| Manage mess rates | — | Yes | — |
| Generate bills | — | Yes | — |
| View own bills | Yes | — | — |
| Submit payments | Yes | — | — |
| Verify/reject payments | — | Yes | Yes |
| Raise disputes | Yes | — | — |
| Respond to disputes | — | Yes | — |
| Resolve/reject disputes | — | — | Yes |
| View analytics dashboard | Yes | Yes | Yes |
| View audit logs | — | — | Yes |

## Authentication

The application uses JWT (JSON Web Tokens) for authentication:

- **Access Token** — Valid for 1 day
- **Refresh Token** — Valid for 7 days, rotated on each refresh
- Tokens are stored in `localStorage` and attached to requests via Axios interceptors
- Automatic token refresh on 401 responses with redirect to login on failure

## Configuration

### Backend (`backend/config/settings.py`)

Key settings to update for production:

- `SECRET_KEY` — Change to a secure random string
- `DEBUG` — Set to `False`
- `ALLOWED_HOSTS` — Specify your domain(s)
- `CORS_ALLOWED_ORIGINS` — Update with your frontend URL
- Database — Switch from SQLite to PostgreSQL or another production database

### Frontend (`frontend/vite.config.js`)

- API proxy target defaults to `http://localhost:8000`
- Update for production deployment as needed

## License

This project is for educational purposes.
