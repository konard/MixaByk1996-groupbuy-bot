#!/bin/bash
# setup-prod.sh — проверка окружения и первый запуск на продакшен-сервере
#
# Решает проблему: "password authentication failed for user postgres"
# Причина: если Docker-том postgres_data уже существует (например, после
# предыдущего запуска с другим паролем), PostgreSQL игнорирует переменную
# POSTGRES_PASSWORD при старте и использует старый пароль из тома.
#
# Решает проблему: "failed to bind host port for 0.0.0.0:80 ... address already in use"
# Причина: порты 80 или 443 уже заняты другим процессом (nginx, Apache и т.д.).
# Скрипт определяет занятый процесс и предлагает его остановить.
#
# Использование:
#   bash scripts/setup-prod.sh            # интерактивный режим
#   bash scripts/setup-prod.sh --reset-db # сбросить том postgres и запустить заново

set -e

COMPOSE_FILE="docker-compose.prod.yml"
VOLUME_NAME="groupbuy_postgres_data"
RESET_DB=false

# --- Разбор аргументов ---
for arg in "$@"; do
  case "$arg" in
    --reset-db) RESET_DB=true ;;
    --help|-h)
      echo "Использование: bash scripts/setup-prod.sh [--reset-db]"
      echo ""
      echo "  --reset-db  Удалить существующий том PostgreSQL и начать с чистого листа."
      echo "              ВНИМАНИЕ: все данные БД будут потеряны!"
      exit 0
      ;;
  esac
done

echo "==> GroupBuy Bot — подготовка продакшен-окружения"
echo ""

# --- 1. Проверка наличия .env ---
if [ ! -f .env ]; then
  echo "ОШИБКА: файл .env не найден."
  echo "Скопируйте .env.example и заполните переменные:"
  echo "  cp .env.example .env && nano .env"
  exit 1
fi

# --- 2. Загрузка переменных из .env ---
# shellcheck disable=SC2046
export $(grep -v '^#' .env | grep -v '^$' | xargs)

# --- 3. Проверка обязательных переменных ---
MISSING_VARS=()
[ -z "${DB_NAME:-}" ]     && MISSING_VARS+=("DB_NAME")
[ -z "${DB_USER:-}" ]     && MISSING_VARS+=("DB_USER")
[ -z "${DB_PASSWORD:-}" ] && MISSING_VARS+=("DB_PASSWORD")
[ -z "${TELEGRAM_TOKEN:-}" ] && MISSING_VARS+=("TELEGRAM_TOKEN")
[ -z "${JWT_SECRET:-}" ]  && MISSING_VARS+=("JWT_SECRET")
[ -z "${DOMAIN:-}" ]      && MISSING_VARS+=("DOMAIN")
[ -z "${CERTBOT_EMAIL:-}" ] && MISSING_VARS+=("CERTBOT_EMAIL")

if [ ${#MISSING_VARS[@]} -gt 0 ]; then
  echo "ОШИБКА: в .env не заданы следующие обязательные переменные:"
  for v in "${MISSING_VARS[@]}"; do
    echo "  - $v"
  done
  echo ""
  echo "Откройте .env и заполните все переменные: nano .env"
  exit 1
fi

echo "  [OK] .env найден, обязательные переменные заданы"

# --- 4. Проверка установки Docker ---
if ! command -v docker &>/dev/null; then
  echo ""
  echo "ОШИБКА: Docker не установлен."
  echo "Установите Docker:"
  echo "  curl -fsSL https://get.docker.com | sh"
  echo "  sudo usermod -aG docker \$USER && newgrp docker"
  exit 1
fi

if ! docker compose version &>/dev/null; then
  echo ""
  echo "ОШИБКА: Docker Compose (плагин) не найден."
  echo "Убедитесь, что установлен Docker Engine >= 24 или выполните:"
  echo "  sudo apt-get install docker-compose-plugin"
  exit 1
fi

echo "  [OK] Docker и Docker Compose доступны"

# --- 5. Проверка занятости портов 80 и 443 ---
# Симптом: "failed to bind host port for 0.0.0.0:80 ... address already in use"
# Причина: другой процесс (nginx, Apache, Caddy и т.д.) уже слушает этот порт.

check_port() {
  local port="$1"
  local pid=""
  local service_name=""

  # Определяем PID процесса, занявшего порт
  if command -v ss &>/dev/null; then
    pid=$(ss -tlnp "sport = :${port}" 2>/dev/null \
      | grep -oP '(?<=pid=)\d+' | head -1)
  elif command -v lsof &>/dev/null; then
    pid=$(lsof -ti ":${port}" -sTCP:LISTEN 2>/dev/null | head -1)
  elif command -v fuser &>/dev/null; then
    pid=$(fuser "${port}/tcp" 2>/dev/null | awk '{print $1}')
  fi

  if [ -z "$pid" ]; then
    return 0  # Порт свободен
  fi

  # Определяем имя процесса по PID
  if [ -f "/proc/${pid}/comm" ]; then
    service_name=$(cat "/proc/${pid}/comm" 2>/dev/null)
  else
    service_name=$(ps -p "$pid" -o comm= 2>/dev/null || echo "неизвестен")
  fi

  echo ""
  echo "  [!] Порт ${port} занят процессом '${service_name}' (PID ${pid})."
  echo "      Это помешает запуску контейнера groupbuy-nginx."
  echo ""
  echo "  Выберите действие:"
  echo "    1) Попытаться остановить '${service_name}' автоматически (systemctl stop / kill)"
  echo "    2) Пропустить (продолжить — Docker-запуск, вероятно, завершится ошибкой)"
  echo "    q) Отмена"
  echo ""
  read -r -p "  Ваш выбор [1/2/q]: " choice
  case "$choice" in
    1)
      echo "  Пробуем остановить '${service_name}'..."
      # Сначала пробуем systemctl (systemd-сервисы: nginx, apache2, caddy и т.д.)
      if systemctl stop "${service_name}" 2>/dev/null; then
        echo "  [OK] Сервис '${service_name}' остановлен через systemctl."
      else
        # Резервный вариант: завершить процесс по PID
        if kill "$pid" 2>/dev/null; then
          sleep 1
          echo "  [OK] Процесс PID ${pid} завершён."
        else
          echo "  [!] Не удалось остановить процесс. Попробуйте вручную:"
          echo "      sudo systemctl stop ${service_name}"
          echo "      или"
          echo "      sudo kill ${pid}"
          echo ""
          echo "  После освобождения порта запустите скрипт снова."
          exit 1
        fi
      fi
      ;;
    q|Q)
      echo "Отменено."
      exit 0
      ;;
    *)
      echo "  Продолжаем без освобождения порта ${port}."
      ;;
  esac
}

PORT_80_FREE=true
PORT_443_FREE=true

if command -v ss &>/dev/null; then
  ss -tlnp "sport = :80"  2>/dev/null | grep -q LISTEN && PORT_80_FREE=false  || true
  ss -tlnp "sport = :443" 2>/dev/null | grep -q LISTEN && PORT_443_FREE=false || true
elif command -v lsof &>/dev/null; then
  lsof -i :80  -sTCP:LISTEN &>/dev/null && PORT_80_FREE=false  || true
  lsof -i :443 -sTCP:LISTEN &>/dev/null && PORT_443_FREE=false || true
fi

[ "$PORT_80_FREE"  = false ] && check_port 80
[ "$PORT_443_FREE" = false ] && check_port 443

if [ "$PORT_80_FREE" = true ] && [ "$PORT_443_FREE" = true ]; then
  echo "  [OK] Порты 80 и 443 свободны"
fi

# --- 6. Обнаружение устаревшего тома PostgreSQL ---
# Симптом: том существует, но пароль в .env отличается от того,
# с которым был инициализирован том — PostgreSQL откажет в подключении.

VOLUME_EXISTS=false
if docker volume inspect "$VOLUME_NAME" &>/dev/null; then
  VOLUME_EXISTS=true
fi

if [ "$VOLUME_EXISTS" = true ] && [ "$RESET_DB" = false ]; then
  echo ""
  echo "  [!] Том PostgreSQL '$VOLUME_NAME' уже существует."
  echo "      Если при предыдущем запуске использовался другой пароль,"
  echo "      PostgreSQL вернёт ошибку 'password authentication failed'."
  echo ""
  echo "  Выберите действие:"
  echo "    1) Продолжить (том не трогать — данные сохранятся)"
  echo "    2) Сбросить том (УДАЛИТЬ все данные БД и начать заново)"
  echo "    q) Отмена"
  echo ""
  read -r -p "  Ваш выбор [1/2/q]: " choice
  case "$choice" in
    2)
      RESET_DB=true
      ;;
    q|Q)
      echo "Отменено."
      exit 0
      ;;
    *)
      echo "  Продолжаем без изменений тома."
      ;;
  esac
fi

if [ "$RESET_DB" = true ]; then
  echo ""
  echo "  [!] Остановка контейнеров и удаление тома '$VOLUME_NAME'..."
  docker compose -f "$COMPOSE_FILE" down 2>/dev/null || true
  docker volume rm "$VOLUME_NAME" 2>/dev/null || true
  echo "  [OK] Том удалён. PostgreSQL будет инициализирован заново."
fi

# --- 7. Создание директорий для nginx ---
mkdir -p infrastructure/nginx/ssl

# --- 8. Получение SSL-сертификата (если ещё нет) ---
CERT_PATH="infrastructure/nginx/ssl/fullchain.pem"
if [ ! -f "$CERT_PATH" ]; then
  echo ""
  echo "  SSL-сертификат не найден. Запуск init-letsencrypt.sh..."
  bash scripts/init-letsencrypt.sh
else
  echo "  [OK] SSL-сертификат уже существует"
fi

# --- 9. Запуск всех сервисов ---
echo ""
echo "==> Запуск сервисов..."
docker compose -f "$COMPOSE_FILE" up -d

echo ""
echo "==> Проверка состояния контейнеров..."
sleep 5
docker compose -f "$COMPOSE_FILE" ps

echo ""
echo "==> Проверка подключения к API..."
RETRIES=10
for i in $(seq 1 $RETRIES); do
  if curl -sf http://localhost:8000/health > /dev/null 2>&1; then
    echo "  [OK] API доступен: http://localhost:8000/health"
    break
  fi
  if [ "$i" -eq "$RETRIES" ]; then
    echo "  [!] API недоступен после $RETRIES попыток. Проверьте логи:"
    echo "      docker compose -f $COMPOSE_FILE logs core"
  else
    echo "  ... ожидание API (попытка $i/$RETRIES)..."
    sleep 6
  fi
done

echo ""
echo "==> Готово!"
echo "    API:      https://${DOMAIN}/api/"
echo "    Фронтенд: https://${DOMAIN}/"
echo ""
echo "    Логи:     docker compose -f $COMPOSE_FILE logs -f"
echo "    Статус:   docker compose -f $COMPOSE_FILE ps"
