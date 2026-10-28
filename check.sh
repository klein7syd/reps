#!/usr/bin/env bash
# 一条命令走完：构建 → 校验铁律 → 回归
# 用法: ./check.sh          正常检查
#       ./check.sh --strict 额外要求与基线逐字节一致（拆分/合并后确认无损时用）
set -e
cd "$(dirname "$0")"

echo "──────────────────────────────────────────"
echo "1/2  构建"
python3 build.py $( [ "$1" = "--strict" ] && echo "--verify" )

echo
echo "2/2  回归"
python3 test/regress.py
