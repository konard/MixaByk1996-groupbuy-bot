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

## 2. Настройка домена и бесплатного SSL (Let's Encrypt) — продакшен

### 2.0 Привязка домена к VDS-серверу (ihor-hosting.ru)

> Эта инструкция подходит для панели управления хостингом **billing.ihor-hosting.ru**.

**Шаг 1. Узнайте IP-адрес вашего VDS-сервера**

1. Войдите в панель управления: https://billing.ihor-hosting.ru/
2. Перейдите в раздел **«Мои услуги»** → выберите ваш VDS-сервер.
3. Скопируйте **IPv4-адрес** (например: `185.123.45.67`).

**Шаг 2. Зарегистрируйте или перенесите домен**

- Если домен уже куплен в другом месте, перейдите в его DNS-настройки у регистратора.
- Если домен куплен на ihor-hosting.ru: в панели перейдите в раздел **«Домены»** → выберите домен → **«DNS-управление»**.

**Шаг 3. Создайте A-запись для домена**

В разделе управления DNS создайте (или обновите) следующие записи:

| Тип | Имя (Host) | Значение (Value) | TTL |
|-----|-----------|------------------|-----|
| A   | `@`       | `185.123.45.67`  | 300 |
| A   | `www`     | `185.123.45.67`  | 300 |

- **`@`** — корневой домен (`example.com`)
- **`www`** — поддомен `www.example.com`
- **TTL 300** — изменения вступят в силу через 5 минут (до 24 часов при смене NS)

**Шаг 4. Проверьте распространение DNS**

```bash
# На вашем компьютере или сервере:
nslookup your-domain.com
# или
dig your-domain.com A +short
# Должен вернуть IP вашего сервера
```

> **Важно:** Не переходите к шагу получения SSL-сертификата, пока DNS не обновился и домен не указывает на IP сервера.

---

### 2.1 Автоматическое получение бесплатного SSL-сертификата (Let's Encrypt)

Проект настроен для автоматического получения и обновления SSL-сертификата через **Let's Encrypt** (бесплатный центр сертификации) с использованием **Certbot** в Docker.

#### Подготовка

Добавьте в файл `.env` следующие переменные:

```env
# Ваш домен (должен уже указывать на IP сервера через DNS)
DOMAIN=your-domain.com

# Email для уведомлений от Let's Encrypt (напр. об истечении срока)
CERTBOT_EMAIL=your@email.com
```

#### Первоначальное получение сертификата

```bash
# Клонирование и переход в директорию проекта
git clone https://github.com/MixaByk1996/groupbuy-bot.git
cd groupbuy-bot

# Настройка переменных окружения
cp .env.example .env
nano .env   # заполните все переменные, включая DOMAIN и CERTBOT_EMAIL

# Запуск скрипта инициализации SSL
bash scripts/init-letsencrypt.sh

# После успешного получения сертификата — запуск всех сервисов
docker compose -f docker-compose.prod.yml up -d
```

Скрипт `init-letsencrypt.sh` автоматически:
1. Запускает временный Nginx для прохождения ACME-проверки Let's Encrypt
2. Получает SSL-сертификат для вашего домена
3. Сохраняет сертификаты в `infrastructure/nginx/ssl/`

#### Автоматическое обновление сертификата

Сертификаты Let's Encrypt действуют **90 дней**. Контейнер `certbot` в `docker-compose.prod.yml` автоматически проверяет необходимость обновления каждые 12 часов и обновляет сертификат, когда до истечения остаётся менее 30 дней.

Чтобы nginx подхватил обновлённый сертификат, добавьте cron-задачу для перезапуска:

```bash
# Добавить задачу в crontab
(crontab -l 2>/dev/null; echo "0 3 1 * * cd /opt/groupbuy && docker compose -f docker-compose.prod.yml exec -T certbot certbot renew --quiet && docker compose -f docker-compose.prod.yml restart nginx") | crontab -
```

#### Проверка SSL

После запуска сервисов проверьте, что HTTPS работает:

```bash
# Проверка HTTP→HTTPS редиректа
curl -I http://your-domain.com

# Проверка HTTPS и сертификата
curl -I https://your-domain.com

# Подробная информация о сертификате
openssl s_client -connect your-domain.com:443 -servername your-domain.com < /dev/null 2>/dev/null | openssl x509 -noout -dates
```

---

## 3. Развёртывание на двух серверах (продакшен)

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

### 3.1 Настройка Сервера 2 (API/Бот)

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

### 3.2 Настройка Сервера 1 (Чат)

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

### 3.3 Настройка SSL (Let's Encrypt)

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

### 3.4 Настройка автоматического обновления сертификатов

```bash
# Cron задача
echo "0 3 1 * * certbot renew --quiet && docker-compose -f docker-compose.two-server.yml restart nginx-api" | crontab -
```

## 4. Разработка React фронтенда (локально)

```bash
cd groupbuy-bot/frontend-react
npm install
npm run dev
# Фронтенд будет доступен на http://localhost:3000
```

## 5. Сборка WASM модуля (для клиентской логики на Rust)

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

## 6. Локальная разработка Rust бэкенда

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

## 7. Обновление сервиса

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

## 8. Резервное копирование

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

## 9. Мониторинг

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

## 10. Устранение неполадок

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

## 11. Интеграция с Cyclops (Точка Банк)

Проект использует сервис **Cyclops** от Точка Банка для обработки платежей через номинальный счёт.

### 11.1 Предварительные требования

- Расчётный счёт в Точка Банке
- Согласованные документы (оферта, закрывающие документы)
- Статический IP-адрес сервера (для Pre-слоя)

### 11.2 Генерация ключей

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

### 11.3 Настройка переменных окружения

Добавьте в `.env`:

```env
# Точка Банк (Cyclops)
TOCHKA_API_URL=https://pre.tochka.com/api/v1/cyclops
TOCHKA_NOMINAL_ACCOUNT=<номер_номинального_счёта>
TOCHKA_PLATFORM_ID=<id_площадки>
TOCHKA_PRIVATE_KEY_PATH=/opt/groupbuy/keys/tochka_private.pem
TOCHKA_PUBLIC_KEY_PATH=/opt/groupbuy/keys/tochka_public.pem
```

### 11.4 Проверка связи с API

```bash
# Тест echo-запроса (требуется подпись)
curl -X POST $TOCHKA_API_URL \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"echo","params":{"text":"test"},"id":"1"}'
```

### 11.5 Процесс подключения

1. **Pre-слой (тестирование)**:
   - Отправить IP-адрес и публичный ключ в техподдержку
   - Получить доступ к тестовой площадке
   - Реализовать и протестировать все методы API

2. **Prod-слой (продакшен)**:
   - Сгенерировать новую пару ключей для Prod
   - Открыть номинальный счёт
   - Подписать акты
   - Получить данные площадки на Prod

### 11.6 Устранение неполадок Cyclops

| Ошибка | Причина | Решение |
|--------|---------|---------|
| `403` | Неверный IP или подпись | Проверить whitelist IP, кодировку, подпись |
| `504` | Таймаут | Увеличить таймаут до 60 сек |
| `4408` | Документ не загружен | Дождаться загрузки (до 5 мин) |
| `4436` | Ошибка комплаенс | Платёж не прошёл проверку 115-ФЗ |

### 11.7 Документация

- [Техническое задание на настройку сервера](./SERVER-SETUP-TZ.md)
- [Документация Cyclops](https://docs.tochka.com/cyclops)
- Telegram-канал: «Точка | номинальный счёт для онлайн-платформ»
