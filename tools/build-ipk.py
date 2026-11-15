#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""在仓库根目录跑：python3 tools/build-ipk.py

产物落在 dist/：一个 gzip(tar) 容器的主包（24.10+），
外加一个老 ar 容器的兼容包（23.05 及更早）。
"""
import gzip
import io
import os
import sys
import tarfile
import time

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "files")
DIST = os.path.join(ROOT, "dist")

PKG = "luci-app-pingbell"
VER = open(os.path.join(ROOT, "VERSION")).read().strip() \
    if os.path.exists(os.path.join(ROOT, "VERSION")) else "1.0.0-1"

FILES = {
    "etc/config/pingbell": 0o644,
    "etc/init.d/pingbell": 0o755,
    "etc/uci-defaults/90-pingbell": 0o755,
    "usr/local/bin/pingbell": 0o755,
    "usr/share/luci/menu.d/luci-app-pingbell.json": 0o644,
    "usr/share/rpcd/acl.d/luci-app-pingbell.json": 0o644,
    "www/luci-static/resources/pingbell/table.js": 0o644,
    "www/luci-static/resources/view/pingbell/link.js": 0o644,
    "www/luci-static/resources/view/pingbell/lan.js": 0o644,
    "www/luci-static/resources/view/pingbell/settings.js": 0o644,
}

POSTINST = """#!/bin/sh
[ -n "${IPKG_INSTROOT}" ] && exit 0

/etc/init.d/pingbell enable
/etc/init.d/pingbell restart >/dev/null 2>&1

rm -rf /tmp/luci-indexcache* /tmp/luci-*cache*
/etc/init.d/rpcd reload >/dev/null 2>&1 || /etc/init.d/rpcd restart >/dev/null 2>&1

if ! grep -qi 'pc speaker' /sys/class/input/event*/device/name 2>/dev/null; then
	echo "提示：没找到 PC Speaker，报警不会响。opkg install kmod-pcspkr && modprobe snd-pcsp"
fi

exit 0
"""

PRERM = """#!/bin/sh
[ -n "${IPKG_INSTROOT}" ] && exit 0
/etc/init.d/pingbell stop >/dev/null 2>&1
/etc/init.d/pingbell disable >/dev/null 2>&1
exit 0
"""

POSTRM = """#!/bin/sh
[ -n "${IPKG_INSTROOT}" ] && exit 0
rm -f /tmp/pingbell.state.json /var/run/pingbell.pid
rm -rf /tmp/luci-indexcache*
exit 0
"""


def tgz(entries):
    raw = io.BytesIO()
    with tarfile.open(fileobj=raw, mode="w", format=tarfile.USTAR_FORMAT) as tf:
        for name, data, mode, is_dir in entries:
            ti = tarfile.TarInfo(name)
            ti.mtime = int(time.time())
            ti.uid = ti.gid = 0
            ti.uname = ti.gname = "root"
            ti.mode = mode
            if is_dir:
                ti.type = tarfile.DIRTYPE
                tf.addfile(ti)
            else:
                ti.type = tarfile.REGTYPE
                ti.size = len(data)
                tf.addfile(ti, io.BytesIO(data))
    out = io.BytesIO()
    with gzip.GzipFile(fileobj=out, mode="wb", mtime=0) as gz:
        gz.write(raw.getvalue())
    return out.getvalue()


def main():
    if not os.path.isdir(SRC):
        sys.exit("找不到 %s，请在仓库根目录运行" % SRC)
    os.makedirs(DIST, exist_ok=True)

    files, total = [], 0
    for rel, mode in FILES.items():
        data = open(os.path.join(SRC, rel.replace("/", os.sep)), "rb").read()
        total += len(data)
        files.append((rel, data, mode))

    dirs = set()
    for rel, _, _ in files:
        parts = rel.split("/")[:-1]
        for i in range(len(parts)):
            dirs.add("/".join(parts[:i + 1]))

    data_tar = tgz([("./" + d + "/", None, 0o755, True) for d in sorted(dirs)]
                   + [("./" + n, d, m, False) for n, d, m in files])

    control = "\n".join([
        "Package: %s" % PKG,
        "Version: %s" % VER,
        "Depends: python3-light, luci-base",
        "SourceName: %s" % PKG,
        "License: BSD-3-Clause",
        "Section: luci",
        "Architecture: all",
        "Installed-Size: %d" % max(1, total // 1024),
        "Maintainer: SkyRainNET",
        "Description: PingBell — 链路健康检测与蜂鸣器报警",
        " 按间隔对 ICMP / TCP 目标做探测，不通时用主板蜂鸣器报警，",
        " 累计报警到上限自动停用该规则。带 LuCI 界面（链路监控 / 内网监控 / 设置）。",
    ]) + "\n"

    control_tar = tgz([
        ("./control", control.encode("utf-8"), 0o644, False),
        ("./conffiles", b"/etc/config/pingbell\n", 0o644, False),
        ("./postinst", POSTINST.encode("utf-8"), 0o755, False),
        ("./prerm", PRERM.encode("utf-8"), 0o755, False),
        ("./postrm", POSTRM.encode("utf-8"), 0o755, False),
    ])

    base = "%s_%s_all" % (PKG, VER)

    ipk = tgz([("./debian-binary", b"2.0\n", 0o644, False),
               ("./control.tar.gz", control_tar, 0o644, False),
               ("./data.tar.gz", data_tar, 0o644, False)])
    open(os.path.join(DIST, base + ".ipk"), "wb").write(ipk)

    buf = io.BytesIO()
    buf.write(b"!<arch>\n")
    for name, data in (("debian-binary", b"2.0\n"),
                       ("control.tar.gz", control_tar),
                       ("data.tar.gz", data_tar)):
        hdr = "%-16s%-12s%-6s%-6s%-8s%-10s`\n" % (
            name + "/", str(int(time.time())), "0", "0", "100644", str(len(data)))
        buf.write(hdr.encode("ascii"))
        buf.write(data)
        if len(data) % 2:
            buf.write(b"\n")
    open(os.path.join(DIST, base + "_ar.ipk"), "wb").write(buf.getvalue())

    print("dist/%s.ipk      %d 字节" % (base, len(ipk)))
    print("dist/%s_ar.ipk   %d 字节" % (base, os.path.getsize(
        os.path.join(DIST, base + "_ar.ipk"))))


if __name__ == "__main__":
    main()
