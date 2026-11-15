'use strict';
'require view';
'require pingbell.table as tbl';

return view.extend({
	render: function() {
		return tbl.build('lan', '内网监控',
			'从路由器本机探测内网主机（icmp / tcping），不通时按蜂鸣参数报警。');
	},

	handleSave: null,
	handleSaveApply: null,
	handleReset: null
});
