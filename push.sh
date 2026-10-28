#!/usr/bin/env bash
# 推送到 GitHub
#
# 两条路，任一条通即可：
#   A. CodeBuddy 连接器已授权（设置 → 连接器 → GitHub）
#   B. 提供一个 Personal Access Token，放在下面任一位置：
#        - 环境变量 GH_PAT
#        - 文件 /workspace/.gh_token（内容只有 token 一行）
#
# 安全：token 只在推送瞬间出现在 remote URL 里，推完立刻摘掉，
#       不写进 .git/config 的长期配置，也不会被打印出来。
#
# 用法：
#   ./push.sh          推送
#   ./push.sh check    只校验 token 是否有效，不推送

set -e
cd "$(dirname "$0")"

REPO="klein7syd/reps"
BRANCH="main"
MODE="${1:-push}"

echo "1/4  取 token"
GITHUB_TOKEN=""

# 路径 B 优先：手工提供的 PAT 比连接器可靠，出了错也容易判断
if [ -n "${GH_PAT:-}" ]; then
  GITHUB_TOKEN="$GH_PAT"
  echo "   来源：环境变量 GH_PAT"
elif [ -s /workspace/.gh_token ]; then
  GITHUB_TOKEN=$(tr -d ' \t\r\n' < /workspace/.gh_token)
  echo "   来源：/workspace/.gh_token"
fi

# 路径 A：连接器
if [ -z "$GITHUB_TOKEN" ]; then
  # get_token.sh 失败时会 exit 1，source 在当前 shell 里会直接终止本脚本。
  # 放到子进程里取，只把 token 值带回来，失败就是空字符串。
  GITHUB_TOKEN=$(bash -c '
    source /root/.codebuddy/skills/github-connector/scripts/get_token.sh github >/dev/null 2>&1
    printf "%s" "${GITHUB_TOKEN:-}"
  ' || true)
  [ -n "$GITHUB_TOKEN" ] && echo "   来源：连接器"
fi

if [ -z "$GITHUB_TOKEN" ]; then
  cat <<'MSG'

× 两条路都不通：连接器未授权，也没有提供 PAT。

【路 A · 连接器】
  CodeBuddy 设置 → 连接器 → GitHub → 授权（OAuth，约 30 秒）

【路 B · 个人令牌】（连接器报错时用这条）
  1. 打开 https://github.com/settings/tokens/new?scopes=repo&description=reps-push
  2. Note 随便填，Expiration 选 7 days，勾选 repo，点 Generate token
  3. 复制生成的 ghp_ 开头的字符串
  4. 存成文件：/workspace/.gh_token  （内容只有这一行，不要有别的字符）
  5. 回来执行 ./push.sh

MSG
  exit 1
fi
echo "   ✓ 已取到（${#GITHUB_TOKEN} 字符，不打印内容）"

echo "2/4  校验 token"
# 只取状态码和登录名，绝不打印 token 本身
HTTP=$(timeout 25 curl -s -o /tmp/gh_me.json -w "%{http_code}" \
  -H "Authorization: Bearer ${GITHUB_TOKEN}" \
  -H "Accept: application/vnd.github+json" \
  https://api.github.com/user || echo "000")
if [ "$HTTP" != "200" ]; then
  echo "   × token 无效，API 返回 HTTP $HTTP"
  head -c 300 /tmp/gh_me.json 2>/dev/null; echo
  cat <<'MSG'

  ghp_ 令牌：检查是否复制完整、是否已过期。
  细粒度令牌：确认给了该仓库 Contents 的 Read and write 权限。
MSG
  rm -f /tmp/gh_me.json
  exit 1
fi
LOGIN=$(python3 -c "import json;print(json.load(open('/tmp/gh_me.json')).get('login','?'))" 2>/dev/null || echo "?")
rm -f /tmp/gh_me.json
echo "   ✓ 有效，账号：$LOGIN"

if [ "$MODE" = "check" ]; then
  echo
  echo "只校验，未推送。执行 ./push.sh 即可推送。"
  exit 0
fi

echo "3/4  推送 $BRANCH"
git remote set-url origin "https://oauth2:${GITHUB_TOKEN}@github.com/${REPO}.git"
trap 'git remote set-url origin "https://github.com/${REPO}.git"' EXIT
git push -u origin "${BRANCH}"
git remote set-url origin "https://github.com/${REPO}.git"
trap - EXIT
echo "   ✓ 已完成，remote 已还原为不含 token 的地址"

echo "4/4  验证远端"
git ls-remote --heads origin "${BRANCH}"
echo
echo "完成。仓库地址：https://github.com/${REPO}"
