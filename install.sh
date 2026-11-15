#!/bin/sh
# PingBell 一键安装脚本

set -e
HERE=$(cd "$(dirname "$0")" && pwd)
BASE=${BASE:-}
SRC="$HERE/files"

if [ ! -d "$SRC" ]; then
	echo "找不到 $SRC，请在仓库根目录运行" >&2
	exit 1
fi

echo "==> 安装文件到 ${BASE:-/}"
cd "$SRC"
find . -type f | while read -r f; do
	target="${BASE}${f#.}"
	mkdir -p "$(dirname "$target")"
	cp -f "$f" "$target"
	case "$f" in
		*/etc/init.d/*|*/usr/local/bin/*|*/etc/uci-defaults/*) chmod 755 "$target" ;;
		*) chmod 644 "$target" ;;
	esac
	echo "    $target"
done
cd - >/dev/null

if [ -n "$BASE" ]; then
	echo "==> 装到 $BASE 完成（未启动服务，镜像首次启动时由 uci-defaults 处理）"
	exit 0
fi

echo "==> 检查依赖"
command -v python3 >/dev/null || echo "  ! 缺少 python3：opkg update && opkg install python3-light"
[ -e /dev/input ] || echo "  ! 没有 /dev/input，蜂鸣器可能不可用"

echo "==> 补齐 UCI 默认值"
uci -q get pingbell.global.buzzer_mode >/dev/null 2>&1 || \
	uci set pingbell.global.buzzer_mode='driver'
uci -q get pingbell.global.fallback_http >/dev/null 2>&1 || \
	uci set pingbell.global.fallback_http='1'
uci commit pingbell 2>/dev/null || true

echo "==> 启用并启动服务"
/etc/init.d/pingbell enable
/etc/init.d/pingbell restart
rm -rf /tmp/luci-indexcache*

echo ""
echo "==> 完成。试一下："
echo "    pingbell status          # 看状态"
echo "    pingbell beep            # 让蜂鸣器响一声"
echo "    pingbell doctor          # 环境自检（身份/设备/权限/目录）"
echo ""
echo "默认不带任何规则，加一条："
echo "    ubus list network.interface                        # 先看有哪些逻辑接口"
echo "    pingbell add home_gw type=icmp iface=wan host=1.1.1.1"
echo ""
echo "LuCI：登录后进 服务 → PingBell（链路监控 / 内网监控 / 设置）。"
echo "      如果菜单没出现，按 Ctrl+F5 强制刷新，或重新登录。"
