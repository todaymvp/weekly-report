#!/usr/bin/env bash
# 生成"公开发布快照"到独立目录（不动当前分支，不影响 Gitea 仓库）
#   ./scripts/release-public.sh             → 输出到 ../weekly-report-public
#   OUT=/path ./scripts/release-public.sh   → 自定义输出目录
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="${OUT:-$ROOT/../weekly-report-public}"

echo "==> 导出 HEAD 到 $OUT"
rm -rf "$OUT"; mkdir -p "$OUT"
git -C "$ROOT" archive HEAD | tar -x -C "$OUT"

echo "==> 剔除内网文件"
rm -rf "$OUT/.gitea" "$OUT/deploy" "$OUT/DEPLOY.md" "$OUT/data" "$OUT/data-local" \
       "$OUT/.env" "$OUT/appsettings.json" "$OUT/extra_repo" "$OUT/node_modules"

echo "==> 内网域名 → 占位符"
grep -rlI 'hjsec\.top' "$OUT" 2>/dev/null | xargs -r sed -i 's/[a-z0-9.-]*hjsec\.top/example.com/g' || true
grep -rlI 'hjsec-server-1' "$OUT" 2>/dev/null | xargs -r sed -i 's/hjsec-server-1/self-hosted-runner/g' || true
grep -rlI 'gitea\.hjsec' "$OUT" 2>/dev/null | xargs -r sed -i 's/gitea\.hjsec\.top/registry.example.com/g' || true

echo "==> 初始化独立仓库"
cd "$OUT"
git init -q -b main
git add -A
git commit -qm "chore: public snapshot $(git -C "$ROOT" rev-parse --short HEAD)"

echo
echo "✓ 快照目录：$OUT"
echo "  文件数：$(git ls-files | wc -l)"
echo "  内网残留检查："
git grep -lI -E 'hjsec\.top|gitea\.hjsec|/home/today|/workspace/' -- . 2>/dev/null || echo "    无 ✓"
echo
echo "推送到新仓库："
echo "  cd $OUT"
echo "  git remote add origin git@github.com:todaymvp/<新仓库名>.git"
echo "  git push -u origin main"
