'use strict';
'require view';
'require pingbell.table as tbl';

return view.extend({
	render: function() {
		return tbl.build('link', '链路监控',
			'绑定上级接口（wan） ping 或 tcping 公网服务器；不通时按蜂鸣参数报警。');
	},

	handleSave: null,
	handleSaveApply: null,
	handleReset: null
});
