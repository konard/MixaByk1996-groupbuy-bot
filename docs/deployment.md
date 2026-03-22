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

## 1.6 Продакшен: доступ по IP-адресу сервера

После запуска `docker-compose -f docker-compose.prod.yml up -d` сервис доступен по IP сервера (без настройки домена и SSL):

- **Фронтенд (админ-панель):** `http://<IP_СЕРВЕРА>/`
- **API:** `http://<IP_СЕРВЕРА>/api/`
- **WebSocket:** `ws://<IP_СЕРВЕРА>/ws/chat/`
- **Health check:** `http://<IP_СЕРВЕРА>/health`

> **Примечание:** При первом запуске без SSL-сертификата nginx автоматически генерирует
> временный самоподписанный сертификат. Сервис работает по HTTP (порт 80) без ограничений.
> HTTPS (порт 443) будет использовать самоподписанный сертификат до настройки Let's Encrypt.

### Устранение ошибки «password authentication failed»

Если в логах контейнера `core` видно:
```
password authentication failed for user "postgres"
```

**Причина:** Docker-том `postgres_data` уже существует с другим паролем. PostgreSQL
игнорирует переменную `POSTGRES_PASSWORD` если том уже инициализирован.

**Решение:**
```bash
# Вариант 1: Используйте скрипт (интерактивный режим)
bash scripts/setup-prod.sh --reset-db

# Вариант 2: Вручную удалите том и перезапустите
docker compose -f docker-compose.prod.yml down
docker volume rm groupbuy-bot_postgres_data
docker compose -f docker-compose.prod.yml up -d
```

> **ВНИМАНИЕ:** Удаление тома приведёт к потере всех данных в базе!

## 2. Настройка домена и бесплатного SSL (Let's Encrypt) — продакшен

### 2.0 Привязка домена к VDS-серверу (ihor-hosting.ru)

> Эта инструкция подходит для панели управления хостингом **billing.ihor-hosting.ru**.

#### Автоматическая привязка через скрипт

Для удобства в проекте есть скрипт `setup-domain.sh`, который:
- определяет IP-адрес сервера автоматически
- выводит пошаговую инструкцию по настройке DNS в панели хостинга
- ожидает распространения DNS и проверяет что домен указывает на сервер
- после подтверждения DNS автоматически запускает получение SSL-сертификата

```bash
# Убедитесь что в .env заданы DOMAIN и CERTBOT_EMAIL, затем:
bash scripts/setup-domain.sh

# Или передайте параметры напрямую:
bash scripts/setup-domain.sh --domain example.com --email admin@example.com

# Только проверить DNS без получения сертификата:
bash scripts/setup-domain.sh --check-only
```

#### Ручная привязка (пошагово)

**Шаг 1. Узнайте IP-адрес вашего VDS-сервера**

1. Войдите в панель управления: https://billing.ihor-hosting.ru/
2. Перейдите в раздел **«Мои услуги»** → выберите ваш VDS-сервер.
3. Скопируйте **IPv4-адрес** (например: `185.123.45.67`).

Либо определите IP прямо на сервере:
```bash
curl -s https://api.ipify.org
```

**Шаг 2. Зарегистрируйте или перенесите домен**

- Если домен уже куплен в другом месте, перейдите в его DNS-настройки у регистратора.
- Если домен куплен на ihor-hosting.ru: в панели перейдите в раздел **«Домены»** → выберите домен → **«DNS-управление»**.

**Шаг 3. Создайте A-записи для домена**

В разделе управления DNS создайте (или обновите) следующие записи:

| Тип | Имя (Host) | Значение (Value) | TTL |
|-----|-----------|------------------|-----|
| A   | `@`       | `185.123.45.67`  | 300 |
| A   | `www`     | `185.123.45.67`  | 300 |

- **`@`** — корневой домен (`example.com`)
- **`www`** — поддомен `www.example.com`
- **TTL 300** — изменения вступят в силу через ~5 минут (до 24 часов при смене NS-серверов)

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

# Запуск единого скрипта настройки (проверяет окружение, получает SSL и запускает сервисы)
bash scripts/setup-prod.sh
```

Скрипт `setup-prod.sh` автоматически:
1. Проверяет наличие `.env` и всех обязательных переменных
2. Обнаруживает устаревший том PostgreSQL (причина ошибки `password authentication failed`) и предлагает его сбросить
3. Запускает временный Nginx для прохождения ACME-проверки Let's Encrypt
4. Получает SSL-сертификат для вашего домена
5. Запускает все сервисы и проверяет доступность API

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

### Ошибка «password authentication failed for user postgres»

**Симптом:** контейнер `groupbuy-core` завершается с паникой:
```
Failed to create database pool: Database(PgDatabaseError { severity: Fatal, code: "28P01",
message: "password authentication failed for user \"postgres\"" })
```
и контейнер `groupbuy-core` помечается как `unhealthy`.

**Причина:** Docker-том `groupbuy_postgres_data` уже существует — он был создан при
предыдущем запуске с другим значением `DB_PASSWORD`. PostgreSQL **игнорирует**
переменную `POSTGRES_PASSWORD`, если том уже инициализирован, и продолжает
использовать старый пароль. Приложение же подключается с новым паролем из `.env` —
отсюда ошибка аутентификации.

**Решение:**

Используйте скрипт `setup-prod.sh`, который автоматически обнаружит проблему и
предложит сбросить том:

```bash
bash scripts/setup-prod.sh
```

Или, если данные в БД можно удалить (первоначальная установка), передайте флаг:

```bash
bash scripts/setup-prod.sh --reset-db
```

Для ручного исправления:

```bash
# 1. Остановить все контейнеры
docker compose -f docker-compose.prod.yml down

# 2. Удалить том PostgreSQL (ВСЕ данные БД будут потеряны!)
docker volume rm groupbuy_postgres_data

# 3. Запустить сервисы заново
docker compose -f docker-compose.prod.yml up -d
```

> **Важно:** Перед удалением тома убедитесь, что у вас есть резервная копия данных
> (см. раздел «Резервное копирование»), или что это первоначальная установка.

### Бэкенд не стартует (другие ошибки подключения к БД)
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

## 11. Подключение ВКонтакте (VK)

### 11.1 Как получить VK_TOKEN

`VK_TOKEN` — это **токен доступа сообщества** (Community Access Token), который позволяет боту получать и отправлять сообщения через API ВКонтакте.

#### Шаги

**Шаг 1. Создайте сообщество ВКонтакте**

1. Войдите в ВКонтакте.
2. Нажмите **«Создать сообщество»** (в левой панели или по адресу vk.com/groups).
3. Выберите тип: **«Публичная страница»** или **«Группа»**.
4. Заполните название и нажмите **«Создать сообщество»**.

**Шаг 2. Включите обмен сообщениями**

1. Перейдите в **Управление → Сообщения**.
2. Включите опцию **«Сообщения сообщества»**.
3. Нажмите **«Сохранить»**.

**Шаг 3. Получите токен доступа**

1. Перейдите в **Управление → Настройки → Работа с API → Ключи доступа**.
2. Нажмите **«Создать ключ»**.
3. В появившемся окне отметьте разрешения:
   - **Сообщения сообщества** — обязательно
   - **Управление сообществом** — опционально (для расширенных функций)
   - **Фотографии** — опционально
4. Нажмите **«Создать»** и скопируйте сгенерированный токен.

> **Важно:** Токен показывается только один раз. Сохраните его сразу.

**Шаг 4. Включите Long Poll API**

1. В **Управление → Настройки → Работа с API** выберите вкладку **«Long Poll API»**.
2. Нажмите **«Подключить»** и выберите версию API **5.131** или выше.
3. В разделе **«Типы событий»** отметьте:
   - `message_new` — новые входящие сообщения
   - `message_event` — нажатия на кнопки (callback-кнопки)
4. Нажмите **«Сохранить»**.

**Шаг 5. Добавьте токен в конфигурацию**

```env
VK_TOKEN=vk1.a.xxxxxxxxxxxxxxxxxxxxxxxx...
```

#### Проверка токена

```bash
curl "https://api.vk.com/method/groups.getById?access_token=YOUR_TOKEN&v=5.131"
```

Успешный ответ содержит информацию о вашем сообществе.

### 11.2 Устранение проблем с VK

| Проблема | Причина | Решение |
|----------|---------|---------|
| `Invalid token` | Токен скопирован с пробелами | Убедитесь что нет пробелов в начале/конце |
| Бот не отвечает на сообщения | Long Poll API не включён | Включите Long Poll и выберите событие `message_new` |
| Кнопки не работают | Событие `message_event` не подключено | Добавьте `message_event` в типы событий Long Poll |
| `Permission denied` | Недостаточно прав у токена | Создайте новый токен с правом «Сообщения сообщества» |

---

## 12. Интеграция с Cyclops (Точка Банк)

Проект использует сервис **Cyclops** от Точка Банка для обработки платежей через номинальный счёт.

### 12.1 Предварительные требования

- Расчётный счёт в Точка Банке
- Согласованные документы (оферта, закрывающие документы)
- Статический IP-адрес сервера (для Pre-слоя)

### 12.2 Генерация ключей

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

### 12.3 Настройка переменных окружения

Добавьте в `.env`:

```env
# Точка Банк (Cyclops)
TOCHKA_API_URL=https://pre.tochka.com/api/v1/cyclops
TOCHKA_NOMINAL_ACCOUNT=<номер_номинального_счёта>
TOCHKA_PLATFORM_ID=<id_площадки>
TOCHKA_PRIVATE_KEY_PATH=/opt/groupbuy/keys/tochka_private.pem
TOCHKA_PUBLIC_KEY_PATH=/opt/groupbuy/keys/tochka_public.pem
```

### 12.4 Проверка связи с API

```bash
# Тест echo-запроса (требуется подпись)
curl -X POST $TOCHKA_API_URL \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"echo","params":{"text":"test"},"id":"1"}'
```

### 12.5 Процесс подключения

1. **Pre-слой (тестирование)**:
   - Отправить IP-адрес и публичный ключ в техподдержку
   - Получить доступ к тестовой площадке
   - Реализовать и протестировать все методы API

2. **Prod-слой (продакшен)**:
   - Сгенерировать новую пару ключей для Prod
   - Открыть номинальный счёт
   - Подписать акты
   - Получить данные площадки на Prod

### 12.6 Устранение неполадок Cyclops

| Ошибка | Причина | Решение |
|--------|---------|---------|
| `403` | Неверный IP или подпись | Проверить whitelist IP, кодировку, подпись |
| `504` | Таймаут | Увеличить таймаут до 60 сек |
| `4408` | Документ не загружен | Дождаться загрузки (до 5 мин) |
| `4436` | Ошибка комплаенс | Платёж не прошёл проверку 115-ФЗ |

### 12.7 Документация

- [Техническое задание на настройку сервера](./SERVER-SETUP-TZ.md)
- [Документация Cyclops](https://docs.tochka.com/cyclops)
- Telegram-канал: «Точка | номинальный счёт для онлайн-платформ»
