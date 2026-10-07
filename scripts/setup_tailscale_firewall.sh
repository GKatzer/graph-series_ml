#!/usr/bin/env bash
# =============================================================
#  setup_tailscale_firewall.sh
#  Открывает порт 6333 (Qdrant) ТОЛЬКО для Tailscale-интерфейса.
#  Запускать от root после установки Tailscale.
# =============================================================

set -euo pipefail

TAILSCALE_IF="tailscale0"
QDRANT_PORT=6333
QDRANT_GRPC_PORT=6334

echo "=== Настройка firewall для Qdrant (только Tailscale) ==="

# Проверяем что Tailscale запущен
if ! ip link show "$TAILSCALE_IF" &>/dev/null; then
    echo "ОШИБКА: интерфейс $TAILSCALE_IF не найден. Запусти: tailscale up"
    exit 1
fi

TAILSCALE_IP=$(tailscale ip -4 2>/dev/null)
echo "Tailscale IP этого хоста: $TAILSCALE_IP"

# ──────────────────────────────────────────────────────────────
# UFW (Ubuntu — основной вариант)
# ──────────────────────────────────────────────────────────────
if command -v ufw &>/dev/null; then
    echo "Используем UFW..."

    # Блокируем Qdrant для всех
    ufw deny in "$QDRANT_PORT"/tcp  comment "Qdrant — blocked globally" 2>/dev/null || true
    ufw deny in "$QDRANT_GRPC_PORT"/tcp comment "Qdrant gRPC — blocked globally" 2>/dev/null || true

    # Разрешаем только с Tailscale-интерфейса
    ufw allow in on "$TAILSCALE_IF" to any port "$QDRANT_PORT"  proto tcp comment "Qdrant Tailscale"
    ufw allow in on "$TAILSCALE_IF" to any port "$QDRANT_GRPC_PORT" proto tcp comment "Qdrant gRPC Tailscale"

    # Стандартные порты для фронтенда
    ufw allow 80/tcp   comment "HTTP"
    ufw allow 443/tcp  comment "HTTPS"
    ufw allow 443/udp  comment "HTTP/3"
    ufw allow 22/tcp   comment "SSH"

    ufw --force enable
    ufw status verbose
    echo "✔ UFW настроен."

# ──────────────────────────────────────────────────────────────
# iptables (fallback)
# ──────────────────────────────────────────────────────────────
else
    echo "UFW не найден, используем iptables..."

    # Разрешаем Qdrant только с tailscale0
    iptables -A INPUT -i "$TAILSCALE_IF" -p tcp --dport "$QDRANT_PORT"  -j ACCEPT
    iptables -A INPUT -i "$TAILSCALE_IF" -p tcp --dport "$QDRANT_GRPC_PORT" -j ACCEPT

    # Блокируем Qdrant с остальных интерфейсов
    iptables -A INPUT ! -i "$TAILSCALE_IF" -p tcp --dport "$QDRANT_PORT"  -j DROP
    iptables -A INPUT ! -i "$TAILSCALE_IF" -p tcp --dport "$QDRANT_GRPC_PORT" -j DROP

    echo "✔ iptables правила добавлены."
    echo "  Для сохранения между перезагрузками: apt install iptables-persistent"
fi

echo ""
echo "=== Готово ==="
echo "Qdrant доступен по Tailscale: $TAILSCALE_IP:$QDRANT_PORT"
echo "Проверка с VDS1: curl http://$TAILSCALE_IP:$QDRANT_PORT/healthz"