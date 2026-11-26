#!/bin/sh
# ============================================================
# HJSEC 容器入口
#   - 以 root 启动：修正挂载卷的属主（解决宿主机目录 root:root 导致的 EACCES）
#   - 降权到 node(1000) 运行，保持非 root 运行的安全性
# ============================================================
set -e

DATA_DIR="${DATA_DIR:-/app/data}"

if [ "$(id -u)" = "0" ]; then
  mkdir -p "$DATA_DIR/uploads" "$DATA_DIR/avatars" "$DATA_DIR/branding"

  # 只有当属主不对时才 chown（每次启动都递归会很慢）
  OWNER="$(stat -c '%u' "$DATA_DIR" 2>/dev/null || echo 0)"
  if [ "$OWNER" != "1000" ]; then
    echo "[entrypoint] 修正数据目录属主: $DATA_DIR (was uid=$OWNER)"
    chown -R node:node "$DATA_DIR" 2>/dev/null || true
  fi

  # 子目录单独确认（避免只修了父目录）
  for d in uploads avatars branding; do
    [ -d "$DATA_DIR/$d" ] || mkdir -p "$DATA_DIR/$d"
    chown node:node "$DATA_DIR/$d" 2>/dev/null || true
  done

  exec gosu node "$@"
fi

# 已经是非 root（比如 compose 里指定了 user:），直接执行
exec "$@"