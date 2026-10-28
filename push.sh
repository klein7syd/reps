#!/usr/bin/env bash
# 推送到 GitHub
#
# 前提：GitHub 连接器已授权（CodeBuddy 设置 → 连接器 → GitHub）。
# 未授权时报错：Connector "github" is not authorized for this user or project.
#
# 安全：token 只在推送瞬间出现在 remote URL 里，推完立刻摘掉，
#       不写进 .git/config 的长期配置，也不会被打印出来。

set -e
cd "$(dirname "$0")"

REPO="klein7syd/reps"
BRANCH="main"

echo "1/4  取 token"
# get_token.sh 失败时会 exit 1，source 在当前 shell 里会直接终止本脚本。
# 放到子进程里取，只把 token 值带回来，失败就是空字符串。
GITHUB_TOKEN=$(bash -c '
  source /root/.codebuddy/skills/github-connector/scripts/get_token.sh github >/dev/null 2>&1
  printf "%s" "${GITHUB_TOKEN:-}"
' || true)
if [ -z "$GITHUB_TOKEN" ]; then
  cat <<'MSG'

× 未取到 GitHub token。原因：连接器未授权。

这也是外部唯一需要你本人操作的步骤，我替不了：

  1. 打开 CodeBuddy 设置
  2. 进「连接器」
  3. 找到 GitHub，点授权，按提示完成
  4. 回来重新执行 ./push.sh

授权走的是 OAuth，不需要你生成或粘贴任何 token。

MSG
  exit 1
fi
echo "   ✓ 已取到（${#GITHUB_TOKEN} 字符，不打印内容）"

echo "2/4  临时挂 token 并推送"
git remote set-url origin "https://oauth2:${GITHUB_TOKEN}@github.com/${REPO}.git"
trap 'git remote set-url origin "https://github.com/${REPO}.git"' EXIT
git push -u origin "${BRANCH}"

echo "3/4  摘掉 token"
git remote set-url origin "https://github.com/${REPO}.git"
trap - EXIT
echo "   ✓ remote 已还原为不含 token 的地址"

echo "4/4  验证远程状态"
git ls-remote --heads origin "${BRANCH}"
echo
echo "完成。仓库地址：https://github.com/${REPO}"
