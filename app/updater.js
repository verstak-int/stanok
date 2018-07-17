
// автоматическое обновление
// https://github.com/edjafarov/node-webkit-updater/blob/master/examples/basic.js
var fs = window.require('fs-extra');
var path = window.require('path');
var gui = window.require('nw.gui');
var pkg = window.require('../package.json');
var updater = window.require('node-webkit-updater');
var upd = new updater(pkg);
var updateDelay = 1000 * 60 * 10;
var copyPath, execPath;

module.exports = update;

function update () {

	// если при запуске переданы данные новой версии
	if (gui.App.argv.length) {
		copyPath = gui.App.argv[0];
		execPath = gui.App.argv[1];

		// устанавливаем новую версию
		updateInstall();
	}
	else {

		// периодически проверяем наличие обновлений
		updateTimer();

		// получаем информацию об обновлении
		updateChecker();
	};
};


// получаем информацию об обновлении
function updateChecker () {
	upd.checkNewVersion(function (error, newVersionExists, manifest) {
		if (!error && newVersionExists) {
			var confirmUpdate = window.confirm('Доступна новая версия.\nУстановить?');

			// если есть новая версия, перестаём проверять
			window.clearInterval(window._.updateTimer);

			// если не обновляемся
			if (!confirmUpdate) { return; };

			 window.document.body.classList.add('Page--is-updating');

			// скачиваем новую версию
			upd.download(function (error, filename) {

				console._log(error);
				console._log(filename);

				if (!error) {

					// получаем файлы новой версии
					upd.unpack(filename, function (error, newAppPath) {

						console._log(error);
						console._log(newAppPath);

						if (!error) {

							// копируем файлы новой версии
							upd.runInstaller(newAppPath, [upd.getAppPath(), upd.getAppExec()],{});
							gui.App.quit();
						};
					}, manifest);
				};
			}, manifest);
		};
	});
};

// периодическая проверка новой версии
function updateTimer () {
	window._.updateTimer = setInterval(function () {
		updateChecker();
	}, updateDelay);
};

// замена файлов приложения
function updateInstall () {
	window.document.body.classList.add('Page--is-updating');
	upd.install(copyPath, function (error) {

		console._log(copyPath);
		console._log(execPath);
		console._log(error);

		// если замена неудачна
		if (error) {
			alert('Выключите проводник и редакторы с открытыми файлами станка и, затем, закройте это окно.');
			updateInstall();
		}

		// иначе стартуем обновлённое приложение из его нормального места
		else {
			upd.run(execPath, [], {});
			gui.App.quit();
		};
	});
};
