# MedVault — API Documentation

## Base URL

- **Development**: `http://localhost:8000`
- **Production**: TBD

## Current Endpoints

### Health Check

```
GET /api/health
```

**Response** `200 OK`:
```json
{
  "status": "ok",
  "service": "medvault-backend"
}
```

---

## Planned Endpoints (Not Yet Implemented)

### Authentication
| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/auth/register` | Register a new user |
| POST | `/api/auth/login` | Authenticate and receive JWT |
| POST | `/api/auth/refresh` | Refresh authentication token |

### Users
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/users/me` | Get current user profile |
| PATCH | `/api/users/me` | Update current user profile |

### Medical Records
| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/records` | Create a new medical record |
| GET | `/api/records` | List records (filtered by role/consent) |
| GET | `/api/records/{id}` | Get a specific record |

### Consent
| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/consent` | Grant consent for record access |
| GET | `/api/consent` | List consent entries |
| PATCH | `/api/consent/{id}` | Update consent (revoke/modify) |

### Access Requests
| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/access-requests` | Request access to a record |
| GET | `/api/access-requests` | List access requests |
| PATCH | `/api/access-requests/{id}` | Approve/deny a request |

### Audit Log
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/audit` | Query audit log entries |

---

## Authentication

Authentication will use JWT tokens in future phases. Currently, no authentication is required.

## Error Format

All errors follow a consistent format:

```json
{
  "detail": "Human-readable error description"
}
```
