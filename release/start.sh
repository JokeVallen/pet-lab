#!/bin/sh
# 桌宠工具集 · 本地服务（macOS / Linux）

cd "$(dirname "$0")" || exit 1

if ! command -v node >/dev/null 2>&1; then
    echo ""
    echo "  没有找到 Node.js。"
    echo "  本工具需要 Node.js 18 或更新版本：https://nodejs.org/"
    echo "  装好后重新运行本文件即可。"
    echo ""
    echo "  只想看看界面？直接用浏览器打开 index.html（只能看，改完要手动下载 YAML）。"
    echo ""
    exit 1
fi

node ./server.js "$@"
status=$?
if [ $status -ne 0 ]; then
    echo ""
    echo "  启动失败（退出码 $status）。看看上面那行的错误信息。"
    exit $status
fi
