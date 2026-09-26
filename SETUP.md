# Setup

Full notes: [README.md](./README.md). This is the short path to a running copy.

## Local

1. Install **Node 22+** and **Docker**.
2. Clone and install:

   ```bash
   git clone https://github.com/anilpokhariyal/chesslab.git
   cd chesslab
   npm install
   ```

3. Start MySQL:

   ```bash
   docker compose up -d mysql
   ```

4. Copy env and set the local URL:

   ```bash
   cp .env.example .env.local
   ```

   In `.env.local`:

   ```
   APP_URL=http://localhost:3000
   DATABASE_URL=mysql://chesslab:chesslab@127.0.0.1:3306/chesslab
   MYSQL_URL=mysql://chesslab:chesslab@127.0.0.1:3306/chesslab
   ```

5. Create tables:

   ```bash
   npx prisma db push
   ```

6. Dev server:

   ```bash
   npm run dev
   ```

   Open http://localhost:3000

Sign-up OTP: if SMTP is unset, open `data/last-email.txt` for the code.

## Docker (app + MySQL)

Create a `.env` next to `docker-compose.yml` with at least `AUTH_SECRET` (`openssl rand -hex 32`). Then:

```bash
docker compose up -d
npx prisma db push
```

`db push` uses `DATABASE_URL` from `.env.local` or the shell (host `127.0.0.1`, not `mysql`).

## Common failures

| Symptom | Fix |
|---|---|
| `Set DATABASE_URL` | Copy `.env.example` → `.env.local` and restart `npm run dev` |
| Prisma / table errors | MySQL up? Then `npx prisma db push` |
| Port 3306 in use | Stop the other MySQL, or change the compose port and `DATABASE_URL` |
| Stockfish missing | Re-run `npm install` (postinstall copies WASM) |
| OTP never arrives | Check SMTP, or read `data/last-email.txt` |
