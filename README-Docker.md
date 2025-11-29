# Docker Deployment Guide

## Quick Start - Run Everything

From the repository root:

```bash
docker compose up --build
```

This will start:
- **PostgreSQL** on port `5432`
- **Backend API** on port `8000`
- **Frontend Dashboard** on port `3000`

Access the dashboard at: **http://localhost:3000**

---

## Services

### Database (PostgreSQL)
- Port: `5432`
- User: `ouaa`
- Password: `ouaa`
- Database: `ouaa`
- Schema auto-applied from `Ou3a Joura Backend/schema.sql`

### Backend (FastAPI)
- Port: `8000`
- API docs: http://localhost:8000/docs
- Health check: http://localhost:8000/api/v1/health

### Frontend (React + Nginx)
- Port: `3000` (mapped from nginx port 80)
- Dashboard: http://localhost:3000
- API calls automatically proxied to backend via nginx

---

## Individual Services

### Build and run backend only:
```bash
cd "Ou3a Joura Backend"
docker build -t ouaa-backend .
docker run -p 8000:8000 --env DATABASE_URL="postgresql://ouaa:ouaa@host.docker.internal:5432/ouaa" ouaa-backend
```

### Build and run frontend only:
```bash
cd "Ou3a Joura Frontend"
docker build -t ouaa-frontend .
docker run -p 3000:80 ouaa-frontend
```

---

## Production Deployment

For production, update the following:

1. **Change database credentials** in `docker-compose.yml`
2. **Set proper CORS origins** in backend `main.py`
3. **Configure environment variables**:
   ```bash
   docker compose --env-file .env.prod up -d
   ```
4. **Use a reverse proxy** (Traefik, Caddy) for HTTPS
5. **Add volume for persistent uploads** if needed

---

## Useful Commands

```bash
# Stop all services
docker compose down

# Stop and remove volumes (⚠️ deletes database data)
docker compose down -v

# View logs
docker compose logs -f

# View logs for specific service
docker compose logs -f backend
docker compose logs -f frontend

# Rebuild after code changes
docker compose up --build

# Run in background (detached)
docker compose up -d

# Check running containers
docker compose ps
```

---

## Troubleshooting

### Frontend can't reach backend
- Make sure all services are on the same network (`ouaa-network`)
- Check nginx proxy config points to `http://backend:8000`

### Database connection failed
- Verify PostgreSQL is running: `docker compose ps`
- Check connection string in backend environment

### Port already in use
- Change port mappings in `docker-compose.yml`:
  ```yaml
  ports:
    - "8080:8000"  # backend on 8080 instead
    - "3001:80"    # frontend on 3001 instead
  ```
