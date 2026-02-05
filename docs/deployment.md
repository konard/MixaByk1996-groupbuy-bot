# Инструкция по развёртыванию сервиса совместных закупок

> **Примечание:** Для подробного технического задания на настройку сервера см. [SERVER-SETUP-TZ.md](./SERVER-SETUP-TZ.md)
>
> **Платёжная система:** Проект использует Точка Банк (Cyclops) для приёма и выплаты платежей. См. раздел «Интеграция с Cyclops» ниже.

## Требования к серверу

### Минимальные системные требования
- **ОС:** Ubuntu 22.04 LTS / Debian 12
- **CPU:** 2 ядра
- **RAM:** 4 ГБ
- **Диск:** 20 ГБ SSD
- **Сеть:** Статический IP-адрес, порты 80, 443, 8000

### Программное обеспечение
- Docker 24+ и Docker Compose 2.20+
- Git
- (Опционально) Nginx для внешнего reverse proxy

## 1. Развёртывание на одном сервере (разработка/тестирование)

### 1.1 Клонирование репозитория

```bash
git clone https://github.com/MixaByk1996/groupbuy-bot.git
cd groupbuy-bot
```

### 1.2 Настройка переменных окружения

```bash
cp .env.example .env
nano .env
```

Заполните файл `.env`:

```env
# База данных
DB_NAME=groupbuy
DB_USER=postgres
DB_PASSWORD=<НАДЁЖНЫЙ_ПАРОЛЬ>

# Telegram бот
TELEGRAM_TOKEN=<ТОКЕН_БОТА_ОТ_@BotFather>

# Платёжная система Точка Банк (Cyclops)
TOCHKA_API_URL=https://pre.tochka.com/api/v1/cyclops
# Для Production: https://api.tochka.com/api/v1/cyclops
TOCHKA_NOMINAL_ACCOUNT=<НОМЕР_НОМИНАЛЬНОГО_СЧЁТА>
TOCHKA_PLATFORM_ID=<ID_ПЛОЩАДКИ>
TOCHKA_PRIVATE_KEY_PATH=/opt/groupbuy/keys/tochka_private.pem
TOCHKA_PUBLIC_KEY_PATH=/opt/groupbuy/keys/tochka_public.pem

# JWT секрет
JWT_SECRET=<СЛУЧАЙНАЯ_СТРОКА_32_СИМВОЛА>

# Уровень логирования
RUST_LOG=info,groupbuy_api=debug
LOG_LEVEL=INFO
```

### 1.3 Запуск сервисов

```bash
docker-compose up -d
```

### 1.4 Проверка работоспособности

```bash
# Проверка статуса контейнеров
docker-compose ps

# Проверка API
curl http://localhost:8000/api/users/

# Проверка логов
docker-compose logs core
docker-compose logs bot
```

### 1.5 Доступ к сервису

- **API:** http://localhost:8000/api/
- **React фронтенд:** http://localhost:3000/

## 2. Развёртывание на двух серверах (продакшен)

### Архитектура

```
┌─────────────────────────┐     ┌─────────────────────────┐
│   Сервер 1 (Чат)        │     │   Сервер 2 (API/Бот)    │
│                         │     │                         │
│  ┌──────────────────┐   │     │  ┌──────────────────┐   │
│  │  Nginx (SSL)     │   │     │  │  Nginx (SSL)     │   │
│  └────────┬─────────┘   │     │  └────────┬─────────┘   │
│           │              │     │           │              │
│  ┌────────┴─────────┐   │     │  ┌────────┴─────────┐   │
│  │  WebSocket Server │   │     │  │  Rust API (core) │   │
│  └────────┬─────────┘   │     │  └────────┬─────────┘   │
│           │              │     │           │              │
│  ┌────────┴─────────┐   │     │  ┌────────┴─────────┐   │
│  │  Redis (Chat)    │   │     │  │  PostgreSQL       │   │
│  └──────────────────┘   │     │  │  Redis (API)      │   │
│                         │     │  │  Bot + Adapter     │   │
│                         │     │  │  React Frontend    │   │
│                         │     │  └──────────────────┘   │
└─────────────────────────┘     └─────────────────────────┘
```

### 2.1 Настройка Сервера 2 (API/Бот)

```bash
# Клонирование
git clone https://github.com/MixaByk1996/groupbuy-bot.git
cd groupbuy-bot

# Настройка окружения
cp .env.example .env
nano .env
# Заполнить все переменные + CORE_API_URL

# Запуск сервисов
docker-compose -f docker-compose.two-server.yml up -d \
  core bot telegram-adapter frontend-react postgres redis-api nginx-api
```

### 2.2 Настройка Сервера 1 (Чат)

```bash
# Клонирование
git clone https://github.com/MixaByk1996/groupbuy-bot.git
cd groupbuy-bot

# Настройка окружения
cp .env.example .env
nano .env
# Установить CORE_API_URL=http://<IP_СЕРВЕРА_2>:8000/api

# Запуск сервисов
docker-compose -f docker-compose.two-server.yml up -d \
  websocket-server redis-chat nginx-chat
```

### 2.3 Настройка SSL (Let's Encrypt)

На каждом сервере:

```bash
# Установка certbot
sudo apt install certbot

# Получение сертификата
sudo certbot certonly --standalone -d your-domain.com

# Копирование сертификатов
sudo mkdir -p infrastructure/nginx/ssl/
sudo cp /etc/letsencrypt/live/your-domain.com/fullchain.pem \
  infrastructure/nginx/ssl/
sudo cp /etc/letsencrypt/live/your-domain.com/privkey.pem \
  infrastructure/nginx/ssl/
sudo chmod 600 infrastructure/nginx/ssl/privkey.pem

# Перезапуск nginx
docker-compose -f docker-compose.two-server.yml restart nginx-api
```

### 2.4 Настройка автоматического обновления сертификатов

```bash
# Cron задача
echo "0 3 1 * * certbot renew --quiet && docker-compose -f docker-compose.two-server.yml restart nginx-api" | crontab -
```

## 3. Разработка React фронтенда (локально)

```bash
cd groupbuy-bot/frontend-react
npm install
npm run dev
# Фронтенд будет доступен на http://localhost:3000
```

## 4. Сборка WASM модуля (для клиентской логики на Rust)

```bash
# Установка wasm-pack
curl https://rustwasm.github.io/wasm-pack/installer/init.sh -sSf | sh

# Сборка WASM модуля
cd groupbuy-bot/wasm-utils
wasm-pack build --target web --out-dir ../frontend-react/src/wasm

# В React коде:
# import init, { validate_phone, format_currency } from './wasm/groupbuy_wasm';
# await init();
```

## 5. Локальная разработка Rust бэкенда

```bash
# Установка Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# Запуск PostgreSQL и Redis (нужны для бэкенда)
docker-compose up -d postgres redis

# Настройка переменных окружения
export DATABASE_URL=postgresql://postgres:password@localhost:5432/groupbuy
export PORT=8000

# Запуск бэкенда
cd groupbuy-bot/core-rust
cargo run
```

## 6. Обновление сервиса

```bash
cd groupbuy-bot

# Получение обновлений
git pull

# Пересборка и перезапуск
docker-compose build
docker-compose up -d

# Проверка логов
docker-compose logs -f core
```

## 7. Резервное копирование

### PostgreSQL

```bash
# Создание бэкапа
docker-compose exec postgres pg_dump -U postgres groupbuy > backup_$(date +%Y%m%d).sql

# Восстановление
cat backup_20260201.sql | docker-compose exec -T postgres psql -U postgres groupbuy
```

### Автоматическое резервное копирование (cron)

```bash
echo "0 2 * * * cd /opt/groupbuy && docker-compose exec -T postgres pg_dump -U postgres groupbuy | gzip > /backups/groupbuy_\$(date +\%Y\%m\%d).sql.gz" | crontab -
```

## 8. Мониторинг

### Проверка здоровья сервисов

```bash
# Статус всех контейнеров
docker-compose ps

# Логи конкретного сервиса
docker-compose logs -f --tail=100 core

# Использование ресурсов
docker stats
```

### Полезные команды

```bash
# Перезапуск одного сервиса
docker-compose restart core

# Просмотр переменных окружения
docker-compose exec core env

# Подключение к БД
docker-compose exec postgres psql -U postgres groupbuy

# Очистка старых Docker образов
docker system prune -f
```

## 9. Устранение неполадок

### Бэкенд не стартует (ошибка подключения к БД)
```bash
# Проверить что PostgreSQL запущен и здоров
docker-compose ps postgres
docker-compose logs postgres

# Проверить переменные окружения
docker-compose exec core env | grep DATABASE
```

### 400 ошибки на /api/users/
Убедитесь что фронтенд отправляет поле `platform_user_id` при регистрации.

### WebSocket не подключается
```bash
# Проверить что WebSocket сервер работает
docker-compose logs websocket-server

# Проверить CORS настройки
curl -v http://localhost:8000/ws/chat/
```

### Telegram бот не отвечает
```bash
# Проверить токен и логи
docker-compose logs bot
docker-compose logs telegram-adapter

# Проверить что TELEGRAM_TOKEN установлен
docker-compose exec bot env | grep TELEGRAM
```

## 10. Интеграция с Cyclops (Точка Банк)

Проект использует сервис **Cyclops** от Точка Банка для обработки платежей через номинальный счёт.

### 10.1 Предварительные требования

- Расчётный счёт в Точка Банке
- Согласованные документы (оферта, закрывающие документы)
- Статический IP-адрес сервера (для Pre-слоя)

### 10.2 Генерация ключей

```bash
# Создать директорию для ключей
mkdir -p /opt/groupbuy/keys
chmod 700 /opt/groupbuy/keys

# Сгенерировать приватный ключ
openssl genpkey -algorithm RSA -out /opt/groupbuy/keys/tochka_private.pem -pkeyopt rsa_keygen_bits:4096

# Сгенерировать публичный ключ
openssl rsa -in /opt/groupbuy/keys/tochka_private.pem -pubout -out /opt/groupbuy/keys/tochka_public.pem

# Установить права доступа
chmod 600 /opt/groupbuy/keys/tochka_private.pem
chmod 644 /opt/groupbuy/keys/tochka_public.pem
```

> **Важно:** Для Pre и Prod слоёв используются **разные** пары ключей!

### 10.3 Настройка переменных окружения

Добавьте в `.env`:

```env
# Точка Банк (Cyclops)
TOCHKA_API_URL=https://pre.tochka.com/api/v1/cyclops
TOCHKA_NOMINAL_ACCOUNT=<номер_номинального_счёта>
TOCHKA_PLATFORM_ID=<id_площадки>
TOCHKA_PRIVATE_KEY_PATH=/opt/groupbuy/keys/tochka_private.pem
TOCHKA_PUBLIC_KEY_PATH=/opt/groupbuy/keys/tochka_public.pem
```

### 10.4 Проверка связи с API

```bash
# Тест echo-запроса (требуется подпись)
curl -X POST $TOCHKA_API_URL \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"echo","params":{"text":"test"},"id":"1"}'
```

### 10.5 Процесс подключения

1. **Pre-слой (тестирование)**:
   - Отправить IP-адрес и публичный ключ в техподдержку
   - Получить доступ к тестовой площадке
   - Реализовать и протестировать все методы API

2. **Prod-слой (продакшен)**:
   - Сгенерировать новую пару ключей для Prod
   - Открыть номинальный счёт
   - Подписать акты
   - Получить данные площадки на Prod

### 10.6 Устранение неполадок Cyclops

| Ошибка | Причина | Решение |
|--------|---------|---------|
| `403` | Неверный IP или подпись | Проверить whitelist IP, кодировку, подпись |
| `504` | Таймаут | Увеличить таймаут до 60 сек |
| `4408` | Документ не загружен | Дождаться загрузки (до 5 мин) |
| `4436` | Ошибка комплаенс | Платёж не прошёл проверку 115-ФЗ |

### 10.7 Документация

- [Техническое задание на настройку сервера](./SERVER-SETUP-TZ.md)
- [Документация Cyclops](https://docs.tochka.com/cyclops)
- Telegram-канал: «Точка | номинальный счёт для онлайн-платформ»
