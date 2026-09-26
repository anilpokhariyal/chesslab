# ChessLab

Local-first chess site: analyze PGN / Chess.com / Lichess games with Stockfish in the browser, train puzzles and openings, play bots, and use a coaching bot. Accounts, games, and progress live in MySQL (Prisma).

Live image (optional): [`anilpokhariya/chesslab`](https://hub.docker.com/r/anilpokhariya/chesslab)  
Source: https://github.com/anilpokhariyal/chesslab

## Requirements

- Node.js 22+
- npm
- MySQL 8 (easiest: Docker)

Analyzer, puzzles, and bots work without an account. Sign-up needs MySQL. Email OTP needs SMTP; without it the code is written to `data/last-email.txt`.

Short checklist: [SETUP.md](./SETUP.md).

## Setup (local)

```bash
git clone https://github.com/anilpokhariyal/chesslab.git
cd chesslab
npm install
```

`npm install` generates the Prisma client and copies Stockfish WASM into `public/stockfish/`.

### 1. MySQL

```bash
docker compose up -d mysql
```

That starts MySQL 8.4 on `127.0.0.1:3306`. Put `MYSQL_PASSWORD` and `MYSQL_ROOT_PASSWORD` in a sibling `.env` (not committed). The database and app user are both `chesslab`.

### 2. Env

```bash
cp .env.example .env.local
```

For local work set:

```
APP_URL=http://localhost:3000
DATABASE_URL=   # mysql://USER:PASSWORD@127.0.0.1:3306/chesslab
MYSQL_URL=      # same as DATABASE_URL
AUTH_SECRET=    # optional locally; a file is created under data/.secret
```

Leave SMTP blank to skip real email.

### 3. Schema

```bash
npx prisma db push
```

Creates `users`, `profiles`, `games`, `game_notes`, `analyses`, `analysis_moves`.

### 4. Run

```bash
npm run dev
```

Open http://localhost:3000

```bash
npm run check    # unit checks
npm run build    # production build
npm start        # serve that build (still needs DATABASE_URL)
```

## Environment

| Variable | Required | Notes |
|---|---|---|
| `DATABASE_URL` | Yes (accounts) | Prisma. `mysql://USER:PASSWORD@host:3306/chesslab` |
| `MYSQL_URL` | Fallback | Used if `DATABASE_URL` is unset |
| `APP_URL` | Prod | Public origin for SEO, OTP links, cookies |
| `AUTH_SECRET` | Prod | `openssl rand -hex 32` |
| `APP_NAME` | No | Default ChessLab |
| `SMTP_HOST` `SMTP_USER` `SMTP_PASS` | For real OTP | Gmail: smtp.gmail.com, port 587, App Password |
| `SMTP_FROM` `SMTP_FROM_NAME` | With SMTP | From address and name |
| `SMTP_PORT` `SMTP_SECURE` | No | 587 / false by default |
| `OTP_MINUTES` | No | Default 10 |

Do not commit `.env.local` or `/data`.

## Docker (full stack)

Sibling `.env` next to `docker-compose.yml` (not committed):

```
AUTH_SECRET=
MYSQL_PASSWORD=
MYSQL_ROOT_PASSWORD=
SMTP_HOST=smtp.gmail.com
SMTP_USER=
SMTP_PASS=
SMTP_FROM=
```

Then:

```bash
docker compose up -d
```

App on http://localhost:3000, MySQL on 3306. Pull `anilpokhariya/chesslab:latest` or build:

```bash
docker build --platform linux/amd64 -t anilpokhariya/chesslab:latest .
docker compose up -d
```

The image does not run migrations. After MySQL is healthy:

```bash
export DATABASE_URL   # mysql://USER:PASSWORD@127.0.0.1:3306/chesslab
npx prisma db push
```

After a schema change, `db push` again and rebuild the image.

## What runs where

- **Browser:** Stockfish, board, puzzles, play, coach
- **Server:** accounts, OTP, profile, games, analyses, Chess.com/Lichess proxies
- **MySQL:** users + progress (not PGN uploads of guests)

## License

App code is yours in this repo. Stockfish is GPL-3.0 (WASM copy in `public/stockfish/`). Puzzles and opening names come from public Lichess APIs.
