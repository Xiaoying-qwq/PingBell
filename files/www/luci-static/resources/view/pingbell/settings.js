'use strict';
'require view';
'require pingbell.table as tbl';

return view.extend({
	render: function() {
		var f = {};
		var grid = E('div', {
			'style': 'display:grid;grid-template-columns:130px 150px 150px 150px;' +
				'gap:10px 14px;align-items:center;margin-top:6px'
		});

		function cell(label, input) {
			grid.appendChild(E('label', {
				'style': 'text-align:right;font-weight:500;opacity:.92'
			}, label));
			grid.appendChild(E('div', {}, input));
		}

		function buildForm(g) {
			f.interval = tbl.textInput(g.interval, '10', 140);
			f.timeout = tbl.textInput(g.timeout, '3000', 140);
			f.count = tbl.textInput(g.count, '1', 140);
			f.alarm_freq = tbl.textInput(g.alarm_freq, '2000', 140);
			f.alarm_ms = tbl.textInput(g.alarm_ms, '300', 140);
			f.alarm_repeat = tbl.textInput(g.alarm_repeat, '3', 140);
			f.alarm_gap = tbl.textInput(g.alarm_gap, '150', 140);
			f.max_alarms = tbl.textInput(g.max_alarms, '5', 140);
			f.buzzer_enable = E('input', {
				'type': 'checkbox',
				'checked': String(g.buzzer_enable) !== '0' ? '' : null,
				'style': 'margin:0'
			});

			cell('检测间隔（秒）', f.interval);
			cell('默认超时（ms）', f.timeout);
			cell('判不通次数', f.count);
			cell('报警频率（Hz）', f.alarm_freq);
			cell('每声时长（ms）', f.alarm_ms);
			cell('每轮响几声', f.alarm_repeat);
			cell('每声间隔（ms）', f.alarm_gap);
			cell('报警上限（次）', f.max_alarms);
			cell('允许发声', f.buzzer_enable);
		}

		var saveBtn = E('button', {
			'class': 'cbi-button cbi-button-apply',
			'click': function() {
				if (!f.interval) {
					tbl.notify('表单还没载入完，稍等一下再保存', 'warning');
					return;
				}
				tbl.call([ 'set', 'global',
					'interval=' + tbl.v(f.interval),
					'timeout=' + tbl.v(f.timeout),
					'count=' + tbl.v(f.count),
					'alarm_freq=' + tbl.v(f.alarm_freq),
					'alarm_ms=' + tbl.v(f.alarm_ms),
					'alarm_repeat=' + tbl.v(f.alarm_repeat),
					'alarm_gap=' + tbl.v(f.alarm_gap),
					'max_alarms=' + tbl.v(f.max_alarms),
					'buzzer_enable=' + (f.buzzer_enable.checked ? '1' : '0'),
					'buzzer_mode=driver'
				]).then(function() {
					tbl.notify('设置已保存', 'info');
				}).catch(tbl.fail);
			}
		}, '保存');

		tbl.loadReport().then(function(d) {
			buildForm(d.global || {});
		}).catch(function(e) {
			tbl.notify('读取配置失败：' + ((e && e.message) || e), 'danger');
		});

		return E('div', { 'class': 'cbi-section' }, [
			E('h3', {}, '全局设置'),
			grid,
			E('div', { 'style': 'margin-top:16px;padding-left:130px' }, saveBtn)
		]);
	},

	handleSave: null,
	handleSaveApply: null,
	handleReset: null
});
