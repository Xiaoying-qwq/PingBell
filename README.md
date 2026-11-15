# PingBell by SkyRainMC/Xiaoying

OpenWrt / iStoreOS 上的链路健康检测。按固定间隔 ping 或 tcping 一批目标，不通就让主板蜂鸣器响

纯 Python 标准库，没有第三方依赖，带 LuCI 界面

## 功能

- **两种探测**：`icmp`（自己发 Echo 包）和 `tcping`（连目标端口）
- **绑出口**：填了 `iface` 就用那个接口的 IP 当源地址发包，配合 mwan3 / ip rule 能分别判断每条线通不通
- **报警可调**：频率、每声多长、响几声、间隔，每条规则都能单独覆盖
- **自动收手**：报警到上限自动停用该规则
- **两种发声方式**：默认直接写 `/dev/input/eventN`，不需要任何服务；也可以调 HTTP 接口
- **LuCI 界面**：链路监控 / 内网监控 / 设置，三个标签，能增删改、批量开关
- **CLI 齐全**：增删改查、立刻测一条、自检环境、看日志

## 安装

有打包好的 ipk，直接装：

```sh
opkg install luci-app-pingbell_1.0.0-1_all.ipk
```

也可以在 LuCI 里 系统 → 软件包 → 上传软件包选这个文件。

装完会自动启用、启动、清菜单缓存，进 **服务 → PingBell** 就能看到。

从源码装也行：

```sh
opkg update
opkg install python3-light kmod-pcspkr
sh install.sh
```

`install.sh` 会把 `files/` 铺到 `/`，补上默认配置，启用服务。


### 界面

三个标签：

- **链路监控**：绑出口探测公网。一行一条规则，显示接口、服务器、延迟、状态。点「配置」改，点「删除」删
- **内网监控**：逻辑一样，只是不绑出口，从路由器自己探测内网主机
- **设置**：全局参数

### 命令行

```sh
pingbell status              # 看总览
pingbell add home_gw type=icmp iface=wan host=1.1.1.1
pingbell add nas type=tcping host=192.168.1.10 port=443
pingbell test home_gw        # 立刻测一次，只打印不报警
pingbell on home_gw          # 开；off 关；on all / off all 批量
pingbell beep                # 响一声，验证蜂鸣器能不能用
pingbell doctor              # 环境自检，发不出声先跑这个
```

加规则前先看本机有哪些接口：

```sh
ubus list network.interface
```

## 配置

配置文件是 `/etc/config/pingbell`，一般不用手改，界面和 CLI 够用。

全局：

| 项 | 默认 | 说明 |
|---|---|---|
| `interval` | 10 | 多久检测一次（秒） |
| `timeout` | 3000 | 单次探测超时（毫秒） |
| `count` | 1 | 一轮试几次，全失败才算不通 |
| `alarm_freq` / `alarm_ms` / `alarm_repeat` / `alarm_gap` | 2000 / 300 / 3 / 150 | 报警音 |
| `max_alarms` | 5 | 报警几次后自动停用，0 表示永不 |
| `buzzer_enable` | 1 | 改成 0 就只记日志不出声 |
| `buzzer_mode` | driver | `driver` 走设备节点，`http` 调接口 |

规则里除了 `type` / `host` / `port` / `iface`，上面这些参数都能单独写。写了的用规则自己的，没写的继承全局。

## 自己打包

```sh
python3 tools/build-ipk.py
```

产物在 `dist/`，不需要 opkg-build，也不需要 Linux。

## License

BSD 3-Clause，见 [LICENSE](LICENSE)。
