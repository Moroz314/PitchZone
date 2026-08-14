# PitchZone

Турнирная платформа нового поколения для киберфутбола — честные турниры, мгновенные выплаты, прозрачный рейтинг.

## Структура монорепозитория

```
pitchzone/
├── apps/
│   ├── web/          # Next.js 15 (App Router) — фронтенд
│   └── api/          # NestJS — бэкенд API
├── packages/
│   ├── ui/           # Общие React UI-компоненты
│   └── config/       # Общие конфиги (ESLint, TypeScript, Tailwind)
├── docker-compose.yml
├── turbo.json
└── package.json
```

## Требования

- **Node.js** >= 20
- **npm** >= 10
- **Docker** и **Docker Compose** (для PostgreSQL и Redis)

## Быстрый старт

### 1. Клонирование и установка зависимостей

```bash
git clone <repo-url> pitchzone
cd pitchzone
npm install
```

### 2. Настройка переменных окружения

```bash
cp .env.example .env
```

Отредактируйте `.env` при необходимости. Значения по умолчанию подходят для локальной разработки.

### 3. Запуск инфраструктуры (PostgreSQL + Redis)

```bash
docker compose up -d
```

Проверить статус контейнеров:

```bash
docker compose ps
```

### 4. Инициализация базы данных

```bash
npm run db:push --workspace=@pitchzone/api
npm run db:seed --workspace=@pitchzone/api
```

### 5. Запуск dev-серверов

Запуск всех приложений одновременно через Turborepo:

```bash
npm run dev
```

Или по отдельности:

```bash
# Frontend — http://localhost:3000
npm run dev --workspace=@pitchzone/web

# Backend API — http://localhost:4000/api
npm run dev --workspace=@pitchzone/api
```

### 6. Проверка работоспособности

| Сервис     | URL                              |
| ---------- | -------------------------------- |
| Web        | http://localhost:3000            |
| API        | http://localhost:4000/api        |
| Health     | http://localhost:4000/api/health |
| PostgreSQL | localhost:5432                   |
| Redis      | localhost:6379                   |

| `/login` | Страница входа |
| `/register` | Регистрация |
| `/leaderboard` | Рейтинг игроков |
| `/players/:id` | Профиль игрока |
| `/teams/:id` | Профиль команды |

### Демо-аккаунты (после seed)

| Email              | Пароль    | Ник         |
| ------------------ | --------- | ----------- |
| neon@pitchzone.gg  | demo12345 | NeonStriker |
| cyber@pitchzone.gg | demo12345 | CyberKeeper |
| pitch@pitchzone.gg | demo12345 | PitchMaster |

## Auth (Этап 2)

- **Email/пароль** — регистрация и вход через `/register` и `/login`
- **Discord OAuth** — добавьте `DISCORD_CLIENT_ID` и `DISCORD_CLIENT_SECRET` в `.env`
- **Steam OpenID** — кнопка на странице входа, callback через API (`STEAM_API_KEY` опционален)

## Полезные команды

```bash
# Миграции и seed БД
npm run db:push --workspace=@pitchzone/api
npm run db:seed --workspace=@pitchzone/api

# Сборка всех пакетов
npm run build

# Линтинг
npm run lint

# Форматирование кода
npm run format

# Проверка форматирования (без изменений)
npm run format:check

# Остановка Docker-сервисов
docker compose down

# Остановка с удалением данных
docker compose down -v
```

## Pre-commit хуки

Проект использует **Husky** + **lint-staged**. При каждом коммите автоматически:

1. Запускается ESLint с автоисправлением
2. Применяется Prettier форматирование

Хуки устанавливаются автоматически при `npm install` (скрипт `prepare`).

## Пакеты

| Пакет               | Описание                                          |
| ------------------- | ------------------------------------------------- |
| `@pitchzone/web`    | Next.js фронтенд (App Router, Tailwind CSS)       |
| `@pitchzone/api`    | NestJS REST API                                   |
| `@pitchzone/ui`     | Общие UI-компоненты (React)                       |
| `@pitchzone/config` | Shared ESLint, TypeScript и Tailwind конфигурации |

## Следующие этапы

См. [cyberfootball-platform-plan.md](./cyberfootball-platform-plan.md) — Этап 4: Матчи и результаты.

## Турниры (Этап 3)

### API эндпоинты

| Метод | URL                                     | Описание                   |
| ----- | --------------------------------------- | -------------------------- |
| GET   | `/api/tournaments`                      | Список турниров            |
| GET   | `/api/tournaments/slug/:slug`           | Детали + участники + сетка |
| POST  | `/api/tournaments`                      | Создать турнир (JWT)       |
| PATCH | `/api/tournaments/:id`                  | Обновить (организатор)     |
| POST  | `/api/tournaments/:id/register`         | Регистрация участника      |
| POST  | `/api/tournaments/:id/generate-bracket` | Генерация сетки            |
| PATCH | `/api/tournaments/matches/:matchId`     | Обновить счёт матча        |

### WebSocket (live-сетка)

- Namespace: `http://localhost:4000/tournaments`
- События: `tournament:update`, `bracket:update`, `match:update`
- Клиент подключается через `socket.io-client` на странице турнира

### Форматы сетки

- **Single Elimination** — полная генерация с BYE и автопродвижением
- **Round Robin** — все пары участников
- Double Elimination / Swiss — заглушки (следующие версии)
