/**
 * Вывод контекстного меню
 * @param  {event} e   событие contextmenu
 * @param  {object} ctx ссылка на ифрайм,
 * в котором произошло событие
 */
function contextHandler(e, ctx) {
	e.preventDefault();

	if (!ctx) {
		ctx = window;
	};

	var offset, iwin;

	if (ctx.getBoundingClientRect) {
		offset = ctx.getBoundingClientRect();
		iwin = ctx.contentWindow;
	}
	else {
		offset = {
			top: 0,
			left: 0
		};
		iwin = ctx;
	};

	var obj = {
		target: e.target,
		x: e.x + offset.left,
		y: e.y + offset.top
	};

	var gui = window.require('nw.gui');
	var clipboard = gui.Clipboard.get();
	var clipboardContent = clipboard.get();
	var menu = new gui.Menu();
	
	// ищем выделенный текст в документе
	var textSelection = selection(iwin);

	// определяем нажатый элемент
	// добавляем про копирование ссылки
	if (obj.target.tagName === 'A') {
		menu.append(new gui.MenuItem({
			label: 'Скопировать ссылку',
			click: function (e) {
				clipboard.set(obj.target.href);
			}
		}));
	}

	// если элемент не ссылка
	else {
		if (obj.target.tagName === 'IMG') {
			menu.append(new gui.MenuItem({
				label: 'Скопировать ссылку на картинку',
				click: function (e) {
					clipboard.set(obj.target.src);
				}
			}));
		};

		// ищем родителей-ссылки
		var parentLink = obj.target.closest('a');

		// если есть
		if (parentLink) {
			
			// добавляем про копирование ссылки
			menu.append(new gui.MenuItem({
				label: 'Скопировать ссылку',
				click: function (e) {
					clipboard.set(parentLink.href);
				}
			}));
		};

	};

	// если текст выделен
	if (textSelection !== '') {

		// добавляем пункт про копирование текста
		menu.append(new gui.MenuItem({
			label: 'Копировать текст',
			click: function (e) {
				clipboard.set(textSelection);
			}
		}));

		// если текст в выделении похож на ссылку
		if (!textSelection.match(/\s/g) && textSelection.match(/\w\.\w*/g)) {

			// добавляем про переход по ссылке
			menu.append(new gui.MenuItem({
				label: 'Перейти по ссылке',
				click: function (e) {
					if (!textSelection.match(/^http:/)) {
						textSelection = textSelection.replace(/^\/?/, '');
						textSelection = 'http://'+ textSelection;
					};

					gui.Shell.openExternal(textSelection);
				}
			}));
		};

		// добавляем про поиск
		menu.append(new gui.MenuItem({
			label: 'Искать в Яндексе',
			click: function (e) {
				gui.Shell.openExternal('https://yandex.ru/yandsearch?text='+ textSelection);
			}
		}));
	};

	// если в буфере есть текст
	// и меню вызвано на текстовом поле
	if (clipboardContent && ['TEXTAREA'].indexOf(obj.target.tagName) > -1) {

		menu.append(new gui.MenuItem({
			label: 'Вставить текст',
			click: function (e) {
				insertAtCursor(obj.target, clipboardContent);
			}
		}));
	};

	if (!menu.items.length) { return; };

	// показываем меню
	menu.popup(obj.x, obj.y);
};

/**
 * Получение выделенного текста в контексте
 * @param  {window} ctx объект window, в котором будет получен текст
 * @return {string} добытый текст
 */
function selection (ctx) {
	var text = "";
	var ctxDoc = ctx.document;

	if (ctx.getSelection) {
		text = ctx.getSelection().toString();
	} else if (ctxDoc.selection && ctxDoc.selection.type != "Control") {
		text = ctxDoc.selection.createRange().text;
	};

	return text;
};

/**
 * Вставка текста в положении курсора
 * @param  {node} myField текстовое поле
 * @param  {string} myValue вставляемый текст
 * http://stackoverflow.com/questions/11076975/insert-text-into-textarea-at-cursor-position-javascript
 */
function insertAtCursor (myField, myValue) {
	if (myField.selectionStart || myField.selectionStart == '0') {
		var startPos = myField.selectionStart;
		var endPos = myField.selectionEnd;

		myField.value = myField.value.substring(0, startPos)
		+ myValue
		+ myField.value.substring(endPos, myField.value.length);
		myField.selectionStart = startPos + myValue.length;
		myField.selectionEnd = startPos + myValue.length;
	};
};

module.exports = contextHandler;
