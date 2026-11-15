'use strict';
'require baseclass';
'require fs';
'require poll';
'require ui';

var CMD = '/usr/local/bin/pingbell';
var HINT = 'opacity:.82;font-size:12px;margin-top:2px;line-height:1.4';
var UNIT = 'opacity:.7;margin-left:4px;font-size:12px';

function sh(args) {
	return fs.exec(CMD, args);
}

function call(args) {
	return sh(args).then(function(r) {
		if (r.code !== 0) {
			var msg = ((r.stdout || '') + (r.stderr || '')).trim();
			throw new Error(msg || ('执行失败，退出码 ' + r.code));
		}
		return r;
	});
}

function loadReport() {
	return sh([ 'report' ]).then(function(r) {
		try {
			return JSON.parse((r.stdout || '').trim());
		}
		catch (e) {
			return { rules: [], global: {}, daemon: {}, speaker: '' };
		}
	});
}

function notify(msg, type) {
	ui.addNotification(null, E('p', {}, msg), type || 'info');
}

function fail(e) {
	ui.addNotification(null, E('p', {}, String((e && e.message) || e)), 'danger');
}

function confirmBox(text, onOk) {
	ui.showModal('请确认', [
		E('p', {}, text),
		E('div', { 'class': 'right', 'style': 'margin-top:14px' }, [
			E('button', {
				'class': 'cbi-button',
				'click': function() { ui.hideModal(); }
			}, '取消'),
			' ',
			E('button', {
				'class': 'cbi-button cbi-button-negative',
				'click': function() { ui.hideModal(); onOk(); }
			}, '确认')
		])
	]);
}

/* 一行：左标签右内容，hint 在内容下方 */
function field(label, input, hint) {
	return E('div', {
		'style': 'display:grid;grid-template-columns:126px 1fr;gap:8px 14px;' +
			'align-items:start;padding:4px 0'
	}, [
		E('label', {
			'style': 'text-align:right;padding-top:6px;font-weight:500;opacity:.92'
		}, label),
		E('div', {}, [
			input,
			hint ? E('div', { 'style': HINT }, hint) : ''
		])
	]);
}

function textInput(value, ph, width) {
	return E('input', {
		'type': 'text',
		'class': 'cbi-input-text',
		'value': (value === undefined || value === null) ? '' : String(value),
		'placeholder': ph || '',
		'style': 'width:' + (width || 160) + 'px;max-width:100%;height:34px;' +
			'box-sizing:border-box'
	});
}

function selectInput(options, value) {
	var sel = E('select', {
		'class': 'cbi-input-select',
		'style': 'height:34px;box-sizing:border-box'
	}, options.map(function(o) {
		return E('option', { 'value': o[0] }, o[1]);
	}));
	sel.value = String(value === undefined || value === null ? '' : value);
	if (sel.selectedIndex < 0)
		sel.selectedIndex = 0;
	return sel;
}

/* 一行塞多个「输入框 + 单位」 */
function inline(pairs) {
	return E('div', {
		'style': 'display:flex;gap:10px;align-items:center;flex-wrap:wrap'
	}, pairs.map(function(p) {
		return E('span', { 'style': 'white-space:nowrap' }, [
			p[0],
			p[1] ? E('span', { 'style': UNIT }, p[1]) : ''
		]);
	}));
}

function v(el) {
	return (el && el.value !== undefined) ? String(el.value).trim() : '';
}

/* 接口下拉，内容来自 report 的 interfaces */
function ifaceOptions(list, cur) {
	var opts = (list || []).map(function(i) {
		return [ i.name, i.name + (i.ip ? '  (' + i.ip + ')' : '  (无地址)') ];
	});
	if (cur && !opts.some(function(o) { return o[0] === cur; }))
		opts.push([ cur, cur + '  (自定义)' ]);
	if (!opts.length)
		opts.push([ 'wan', 'wan' ]);
	return opts;
}

/* 新建时的默认接口：挑个有地址、名字像上行口的，都没有就用第一个 */
function defaultIface(list) {
	var UP = /^(wan|pppoe|wwan|usb|modem|mobile|lte|5g|4g)/i;
	var hit = null;
	(list || []).forEach(function(i) {
		if (!hit && i.ip && UP.test(i.name))
			hit = i.name;
	});
	if (hit)
		return hit;
	var up = (list || []).filter(function(i) { return i.ip; });
	if (up.length)
		return up[0].name;
	return (list && list[0]) ? list[0].name : 'wan';
}

/* ---- 配置弹窗 ---- */
function editDialog(group, rule, done, ifaces) {
	var isNew = !rule;
	var f = {};

	f.name = textInput(isNew ? '' : rule.name, isNew ? 'home_gw' : '', 190);
	if (!isNew) {
		f.name.readOnly = true;
		f.name.style.opacity = '.7';
	}

	f.host = textInput(isNew ? '' : rule.host,
		group === 'link' ? '1.1.1.1' : '192.168.10.10', 190);
	f.type = selectInput([ [ 'icmp', 'ICMP（ping）' ], [ 'tcping', 'TCPing（连端口）' ] ],
		isNew ? 'icmp' : rule.type);
	f.iface = selectInput(ifaceOptions(ifaces, isNew ? '' : rule.iface),
		(isNew || !rule.iface) ? defaultIface(ifaces) : rule.iface);
	f.port = textInput(isNew ? '' : rule.port, '80', 80);
	f.timeout = textInput(isNew ? 3000 : rule.timeout, '3000', 90);
	f.count = textInput(isNew ? 1 : rule.count, '1', 90);
	f.freq = textInput(isNew ? 2000 : rule.freq, '2000', 72);
	f.ms = textInput(isNew ? 300 : rule.ms, '300', 72);
	f.repeat = textInput(isNew ? 3 : rule.repeat, '3', 58);
	f.enabled = E('input', {
		'type': 'checkbox',
		'checked': (isNew ? true : !!rule.enabled) ? '' : null,
		'style': 'margin-top:8px'
	});

	var rows = [
		field('规则名称', f.name, isNew ? '只能字母、数字、下划线，添加后不能改名' : '名字已锁定')
	];

	if (group === 'link')
		rows.push(field('接口', f.iface, '探测包从该接口发出（绑定源地址）'));

	rows.push(field('服务器地址', f.host,
		group === 'link' ? '公网 IP 或域名' : '内网 IP 或域名'));
	rows.push(field('检测方式 · 端口', inline([ [ f.type, '' ], [ f.port, '' ] ]),
		'TCPing 才需要端口，ICMP 忽略'));
	rows.push(field('超时时间', inline([ [ f.timeout, 'ms' ] ]), '单次探测最多等这么久'));
	rows.push(field('超时几次判不通', inline([ [ f.count, '次' ] ]),
		'同一轮内重试 N 次都失败才判不通'));
	rows.push(field('蜂鸣', inline([ [ f.freq, 'Hz' ], [ f.ms, 'ms' ], [ f.repeat, '声' ] ]),
		'依次为 频率 / 每声时长 / 响几声'));
	rows.push(field('启用', f.enabled, '不勾选则保存后仍为停用状态'));

	var save = E('button', {
		'class': 'cbi-button cbi-button-apply',
		'click': function() {
			var name = v(f.name);
			if (!/^[A-Za-z0-9_]+$/.test(name)) {
				notify('规则名只能用字母、数字、下划线', 'warning');
				return;
			}
			if (!v(f.host)) {
				notify('服务器地址不能为空', 'warning');
				return;
			}
			call([ isNew ? 'add' : 'set', name,
				'type=' + v(f.type),
				'group=' + group,
				'host=' + v(f.host),
				'port=' + v(f.port),
				'timeout=' + v(f.timeout),
				'count=' + v(f.count),
				'freq=' + v(f.freq),
				'ms=' + v(f.ms),
				'repeat=' + v(f.repeat),
				'enabled=' + (f.enabled.checked ? '1' : '0'),
				'iface=' + (group === 'link' ? v(f.iface) : '')
			]).then(function() {
				ui.hideModal();
				notify((isNew ? '已添加 ' : '已保存 ') + name, 'info');
				done();
			}).catch(fail);
		}
	}, '保存');

	ui.showModal((isNew ? '添加规则' : '配置 ' + rule.name), [
		E('div', {}, rows),
		E('div', { 'class': 'right', 'style': 'margin-top:12px' }, [
			E('button', {
				'class': 'cbi-button',
				'click': function() { ui.hideModal(); }
			}, '取消'),
			' ',
			save
		])
	]);
}

/* ---- 表格 ---- */
function build(group, title, desc) {
	var root = E('div', {});
	var tbody = E('tbody', {});
	var idx = { rows: {}, names: null, list: [] };
	var ifaces = [];

	var head = E('tr', {}, [
		E('th', { 'style': 'width:38px' }, ''),
		group === 'link' ? E('th', { 'style': 'width:96px;text-align:left' }, '接口') : '',
		E('th', { 'style': 'text-align:left' }, '服务器地址'),
		E('th', { 'style': 'width:110px;text-align:left' }, '延迟'),
		E('th', { 'style': 'width:168px;text-align:left' }, '状态'),
		E('th', { 'style': 'width:132px;text-align:right' }, '操作')
	].filter(Boolean));

	var selCount = E('span', { 'style': 'opacity:.82;margin-left:4px' });

	var all = E('input', {
		'type': 'checkbox',
		'style': 'margin:0',
		'title': '全选',
		'change': function() {
			Array.prototype.slice.call(tbody.querySelectorAll('input.lw-sel'))
				.forEach(function(c) { c.checked = all.checked; });
			syncBar();
		}
	});
	head.firstChild.appendChild(all);

	function picks() {
		return Array.prototype.slice.call(tbody.querySelectorAll('input.lw-sel'))
			.filter(function(c) { return c.checked; })
			.map(function(c) { return c.getAttribute('data-name'); });
	}

	function syncBar() {
		var n = picks().length;
		selCount.textContent = n ? ('已选 ' + n + ' 条') : '';
	}

	function reload() {
		return loadReport().then(function(d) {
			ifaces = d.interfaces || [];
			idx.list = (d.rules || []).filter(function(r) { return r.group === group; });
			var marker = idx.list.map(function(r) { return r.name; }).join(',');
			if (marker !== idx.names)
				rebuild(idx.list);
			else
				paint(idx.list);
			return d;
		}).catch(function(e) {
			notify('读取状态失败：' + ((e && e.message) || e), 'danger');
		});
	}

	function rebuild(list) {
		idx.names = list.map(function(r) { return r.name; }).join(',');
		idx.rows = {};
		while (tbody.firstChild)
			tbody.removeChild(tbody.firstChild);

		if (!list.length) {
			tbody.appendChild(E('tr', {}, E('td', {
				'colspan': group === 'link' ? 6 : 5,
				'style': 'text-align:center;opacity:.65;padding:26px'
			}, '还没有规则，点上面的「添加规则」新建一条')));
			syncBar();
			return;
		}

		list.forEach(function(rule) {
			var rttEl = E('span', {}, rttText(rule));
			var stEl = E('span', {});
			paintState(stEl, rule);

			var cells = [
				E('td', {}, E('input', {
					'type': 'checkbox',
					'class': 'lw-sel',
					'data-name': rule.name,
					'style': 'margin:0',
					'change': function() { syncBar(); }
				})),
				group === 'link' ? E('td', {}, rule.iface || '—') : '',
				E('td', {}, [
					E('span', { 'style': 'font-family:monospace;font-size:13px' }, targetText(rule)),
					E('span', { 'style': 'opacity:.5;font-size:11px;margin-left:8px' },
						(rule.type === 'tcping' ? 'TCPing' : 'ICMP') + ' · ' + rule.name)
				]),
				E('td', {}, rttEl),
				E('td', {}, stEl),
				E('td', { 'style': 'text-align:right;white-space:nowrap' }, [
					E('button', {
						'class': 'cbi-button cbi-button-edit',
						'click': function() { editDialog(group, rule, reload, ifaces); }
					}, '配置'),
					' ',
					E('button', {
						'class': 'cbi-button cbi-button-remove',
						'click': function() {
							confirmBox('确定删除规则 ' + rule.name + ' ？', function() {
								call([ 'del', rule.name ]).then(function() {
									notify('已删除 ' + rule.name, 'info');
									reload();
								}).catch(fail);
							});
						}
					}, '删除')
				])
			].filter(Boolean);

			tbody.appendChild(E('tr', {}, cells));
			idx.rows[rule.name] = { rtt: rttEl, state: stEl };
		});

		syncBar();
	}

	function paint(list) {
		list.forEach(function(rule) {
			var row = idx.rows[rule.name];
			if (!row)
				return;
			row.rtt.textContent = rttText(rule);
			paintState(row.state, rule);
		});
	}

	function bulk(fn, okMsg) {
		var names = picks();
		if (!names.length) {
			notify('先勾选要操作的规则', 'warning');
			return;
		}
		fn(names).then(function() {
			notify(okMsg, 'info');
			reload();
		}).catch(fail);
	}

	var bar = E('div', {
		'style': 'display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin:2px 0 10px 0'
	}, [
		E('button', {
			'class': 'cbi-button cbi-button-add',
			'click': function() { editDialog(group, null, reload, ifaces); }
		}, '添加规则'),
		E('button', {
			'class': 'cbi-button cbi-button-apply',
			'click': function() {
				bulk(function(names) { return call([ 'on' ].concat(names)); }, '已启用所选规则');
			}
		}, '启用所选'),
		E('button', {
			'class': 'cbi-button',
			'click': function() {
				bulk(function(names) { return call([ 'off' ].concat(names)); }, '已停用所选');
			}
		}, '停用所选'),
		E('button', {
			'class': 'cbi-button cbi-button-remove',
			'click': function() {
				var names = picks();
				if (!names.length) {
					notify('先勾选要删除的规则', 'warning');
					return;
				}
				confirmBox('确定删除这 ' + names.length + ' 条规则？', function() {
					var chain = Promise.resolve();
					names.forEach(function(n) {
						chain = chain.then(function() { return call([ 'del', n ]); });
					});
					chain.then(function() {
						notify('已删除 ' + names.length + ' 条规则', 'info');
						reload();
					}).catch(fail);
				});
			}
		}, '删除所选'),
		selCount
	]);

	root.appendChild(E('div', { 'class': 'cbi-section' }, [
		E('h3', {}, title),
		desc ? E('p', {
			'class': 'cbi-section-descr',
			'style': 'opacity:.82;margin-bottom:8px'
		}, desc) : '',
		bar,
		E('table', {
			'class': 'table cbi-section-table',
			'style': 'table-layout:fixed;width:100%'
		}, [ E('thead', {}, head), tbody ])
	]));

	reload();
	poll.add(function() { return reload(); }, 5);

	return root;
}

function targetText(rule) {
	var h = rule.host || '—';
	return (rule.type === 'tcping' && rule.port) ? (h + ':' + rule.port) : h;
}

function rttText(rule) {
	if (!rule.enabled)
		return '—';
	if (rule.ok === 1 && rule.rtt !== null && rule.rtt !== undefined)
		return (Math.round(rule.rtt * 10) / 10) + ' ms';
	return '—';
}

function paintState(el, rule) {
	var txt, color, weight = '400';
	if (!rule.enabled) {
		txt = '已停用';
		color = 'rgba(128,128,128,.9)';
	}
	else if (rule.ok === 1) {
		txt = '通';
		color = '#2e9e4f';
		weight = '600';
	}
	else if (rule.ok === 0) {
		txt = '不通' + (rule.err ? '（' + rule.err + '）' : '');
		color = '#e05252';
	}
	else {
		txt = '待检测';
		color = '#c9971f';
	}
	el.textContent = txt;
	el.setAttribute('style', 'color:' + color + ';font-weight:' + weight);
}

return baseclass.extend({
	build: build,
	loadReport: loadReport,
	notify: notify,
	fail: fail,
	field: field,
	textInput: textInput,
	inline: inline,
	call: call,
	v: v
});
