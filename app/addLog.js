var ui = window.require('./ui')();

module.exports = addLog;

function addLog(txt, type, trace) {
	if (txt === '') { return; };

	switch (type) {
		case 'warn':
			break;

		case 'error':
			new window.Notification('Станок', {
				body: '— Ошибка! Детали в истории проекта'
			});
			if (trace) {
				var _txt = txt;

				txt = '<label class="Spoiler">';
				txt += '<span class="Spoiler__trigger">'+ _txt +'</span>';
				txt += '<input class="Spoiler__logic" type="checkbox">';
				txt += '<span class="Spoiler__content">'+ trace +'</span>';
				txt += '</label>';
			};
			break;

		default:
			break;
	};

	var log = ui.log;
	var item = '<div class="Log Log--'+ type +'">';

	item += '<div class="Log__box Log__box--date">['+ getTime(new Date) +']</div>';
	item += '<div class="Log__box Log__box--data">'+ txt +'</div>';
	item += '</div>';

	if (window._.currentProject) {
		log = window.document.querySelector('.Project[data-project-name="'+ window._.currentProject.name +'"] .Project__log');
	};

	log.insertAdjacentHTML('afterBegin', item);
};

function getTime (date) {
	return zeroAppender(date.getDate()) +'.'+ zeroAppender(date.getMonth() + 1) +'.'+ date.getFullYear() +' '+ zeroAppender(date.getHours()) +':'+ zeroAppender(date.getMinutes()) +':'+ zeroAppender(date.getSeconds()) +'.'+ zeroAppender(date.getMilliseconds(), 3);
};

function zeroAppender (num, length) {
	if (!length) {
		length = 2;
	};

	num = num +'';

	if (num.length < length) {
		for (var i = 0; i < length - num.length; i++) {
			num = '0'+ num;
		};
	};

	return num;
};
