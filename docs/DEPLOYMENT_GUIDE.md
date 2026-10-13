# Avora Bank: Production Deployment Guide

This guide details how to deploy Avora Bank on an enterprise Linux server (Ubuntu 22.04 / 24.04 LTS), containerized using **Docker Compose** or as native services managed by **PM2** and **Nginx**.

---

## Method 1: Containerized Deployment (Recommended)

### Prerequisites
- Docker Engine >= 26.0
- Docker Compose v2 (included with Docker CLI)
- A registered domain name pointing to the server IP (e.g. `avorabank.com`)

### 1. Clone & Configure Environment
```bash
git clone https://github.com/Nimeth11/Digital-Investment-Wallet-Platform.git /opt/avorabank
cd /opt/avorabank
cp .env.example .env
```
Edit `.env` and configure:
```env
PORT=80
DATABASE_URL="mysql://db_user:secure_password@db_host:3306/avorabank_prod?sslmode=require"
JWT_SECRET="your_generated_cryptographic_jwt_secret"
JWT_REFRESH_SECRET="your_generated_cryptographic_refresh_secret"
CORS_ORIGIN="https://avorabank.com"
```

### 2. Launch Containers
```bash
docker compose up -d --build
```
This starts:
- **`avora-reverse-proxy`**: Nginx with rate limiting, Gzip, and DDoS protection on port 80/443.
- **`avora-api-engine`**: Node 20 Express API running on port 5000 with dumb-init.
- **`avora-web-portal`**: Next.js Standalone SSR container on port 3000.

### 3. Initialize Database & Seed
```bash
docker compose exec server npx prisma db push
docker compose exec server npx prisma db seed
```

### 4. Enable Let's Encrypt SSL (HTTPS)
Install Certbot on host:
```bash
sudo apt install certbot -y
sudo certbot certonly --webroot -w /var/www/certbot -d avorabank.com -d www.avorabank.com
```
Mount certificates in `docker-compose.yml` under `reverse-proxy` volume mappings:
```yaml
- /etc/letsencrypt/live/avorabank.com/fullchain.pem:/etc/nginx/ssl/fullchain.pem:ro
- /etc/letsencrypt/live/avorabank.com/privkey.pem:/etc/nginx/ssl/privkey.pem:ro
```

---

## Method 2: Native VPS Deployment (PM2 + Systemd)

### 1. Install Node.js & PM2
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs nginx
sudo npm install -g pm2
```

### 2. Build the Application
```bash
npm run build
```

### 3. Start PM2 in Cluster Mode
```bash
pm2 start ecosystem.config.js --env production
pm2 save
pm2 startup
```

### 4. Setup Automated Daily Backups
Add a cron job using `crontab -e`:
```cron
0 2 * * * /opt/avorabank/scripts/backup-db.sh >> /var/log/avora_backup.log 2>&1
```

---

## 5. Automated CI/CD & Updates
To roll out updates with zero downtime:
```bash
./scripts/deploy.sh
```
This pulls the latest commits, recompiles Prisma, executes standalone builds, reloads PM2/Docker clusters without dropping connections, and verifies `/api/v1/health`.

