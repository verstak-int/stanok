var fs = require('fs-extra');
var stream = require('stream');
var path = require('path');
var gui = require('nw.gui');

var git = require('gift');

var livereload = require('livereload2');

var writeProjects = require('./writeProjects');
var getProjects = require('./getProjects');
var addLog = require('./addLog');
var toggleTasks = require('./toggleTasks');

var projectsPath;

window._ = {};
window._.currentProject = null;

// исходная рабочая папка
window._.cWD = process.cwd();
window._.server = livereload.createServer();


// обновление программы
require('nw-updater')({
	package: path.join(process.cwd(), 'package.json'),
	update: 1000 * 60 * 10,
	beforeDownload: function (updateInterval, manifest, download) {
		var confirmUpdate = confirm('Доступна новая версия.\nУстановить?');

		// если есть новая версия, перестаём проверять
		clearInterval(updateInterval);

		// если не обновляемся
		if (!confirmUpdate) { return; };

		document.body.classList.add('Page--is-updating');
		download(manifest);
	},
	beforeInstall: function () {
		document.body.classList.add('Page--is-updating');
	},
	onInstallError: function (install) {
		alert('Выключите проводник и редакторы с открытыми файлами станка и, затем, закройте это окно.');
		install();
	}
});


// обработчик контекстного меню
var contextHandler = require('./contextHandler.js');

document.addEventListener('contextmenu', function (e) {
	contextHandler(e);
});


// управление окном
var win = gui.Window.get();

win.on('close', function() {
	this.hide();

	// отключение всех задач
	toggleTasks(null, true, function () {
		this.close(true);
	});
});

// ссылки наружу должны открываться в стандартном браузере
win.on('new-win-policy', function (frame, url, policy) {
	policy.ignore();
	gui.Shell.openExternal(url);
});


// ведение истории обработки
console._log = console.log;
console.log = function (txt) {
	try {
		addLog(txt);
	} catch(e) {};
};
console._warn = console.warn;
console.warn = function (txt) {
	addLog(txt, 'warn');
};
console._error = console.error;
console.error = function (txt) {
	addLog(txt, 'error');
};


// отлавливаем неотловленные ошибки
process.on('uncaughtException', function(err) {
	try {
		addLog(err.stack.toString(), 'error');
	} catch(e) {
		console.error(e);
	};
});


// по загрузке проверить сохранённый путь,
// если нет — выбирать новый
// 	если в выбранной папке не оказалось ни полок, ни верстака
// 		выбор должен происходить заново
// 	иначе — выводим проекты

getProjectPath();
projectsPathInput.onchange = setProjectPath;

function setProjectPath(newPath) {
	if (typeof newPath !== 'string') {
		newPath = this.value;
	};

	try {
		var newPathStats = fs.lstatSync(newPath);
	}
	catch (e) {
		if (e) {
			getProjectPath(true);
			return;
		};
	};

	var projects = getProjects(newPath);

	// отрисовка проектов
	if (projects.verstak.length || projects.polki.length || projects.git.length) {
		projectsPathInfo.innerHTML = newPath;
		projectsPath = newPath;
		localStorage.projectsPath = projectsPath;
		writeProjects(projects);

		var projectGroups = document.querySelectorAll('.Project__group');

		[].forEach.call(projectGroups, function (projectGroup) {
			var repo = git(path.join(projectsPath, projectGroup.getAttribute('data-project-group-name')));

			repo.branch(function (err, head) {
				if (!err) {
					projectGroup.querySelector('.Project__branch').innerHTML = head.name;
				};
			});
		});
	}
	else {
		projectsPathInfo.innerHTML = 'В указанной папке ('+ newPath +') не найдены проекты Верстака. Укажите другую папку: ';
	};
};

function getProjectPath(force) {
	if (localStorage.projectsPath && !force) {
		projectsPath = localStorage.projectsPath;
		setProjectPath(projectsPath);
	}
	else {
		projectsPathInput.click();
	};
};


// нажатие на переключатели
document.addEventListener('click', function (e) {
	if (e.target.classList.contains('Project__start')) {
		var start = e.target;
		var project = start.parentNode.parentNode;
		var name = project.getAttribute('data-project-name');
		var data = JSON.parse(project.querySelector('.Project__data').textContent);

		toggleTasks({
			name,
			data
		});
	}

	else if (e.target.classList.contains('Project__build--styles')) {
		if (window._.currentProject.processor) {
			window._.currentProject.processor.css();
		};
	}

	else if (e.target.classList.contains('Project__build--images')) {
		if (window._.currentProject.processor) {
			window._.currentProject.processor.img();
		};
	}

	else if (e.target.classList.contains('ProjectsChooser__refresh')) {
		setProjectPath(projectsPath);
	}

	else if (e.target.classList.contains('Project__explorer')) {
		gui.Shell.openItem(e.target.getAttribute('data-project-path'));
	}

	else if (e.target.classList.contains('Project__branch')) {
		var branch = e.target;
		var projectGroup = branch.closest('.Project__group');
		var repo = git(path.join(projectsPath, projectGroup.getAttribute('data-project-group-name')));

		repo.remote_fetch('origin', function (a, b) {
			repo.branches(function (err, heads) {
				repo.remotes(function (err, remotes) {
					var r = '<div class="Project__switchs">';

					heads.forEach(function (head) {
						r += '<br><span class="Project__switch" data-branch="'+ head.name +'">'+ head.name +'</span>';
					});
					remotes.forEach(function (remote) {
						if (heads.filter(function (head) {
							var re = new RegExp(head.name, 'g');

							return remote.name.match(re);
						}).length) { return; };

						r += '<br><span class="Project__switch" data-branch="'+ remote.name +'">'+ remote.name +'</span>';
					});

					r += '</div>';

					branch.insertAdjacentHTML('afterend', r);
				});
			});
		});
	}
	else if (e.target.classList.contains('Project__switch')) {
		var switchTrigger = e.target;
		var projectGroup = switchTrigger.closest('.Project__group');
		var repo = git(path.join(projectsPath, projectGroup.getAttribute('data-project-group-name')));
		var switchTarget = switchTrigger.getAttribute('data-branch');
		var switchTargetPure = switchTarget.replace('origin/', '');
		var createNewBranch = false;

		if (switchTarget.match('origin')) {
			createNewBranch = true;
		};

		repo.checkout(switchTargetPure, createNewBranch, function (err) {
			if (err) {
				alert('Ацтой, '+ JSON.stringify(err));
			}
			else {
				repo.sync('origin', switchTargetPure, function (err) {
					if (err) {
						alert('Ацтой, '+ JSON.stringify(err));
					}
					else {
						repo.branch(function (err, head) {
							if (err) {
								alert('Ацтой, '+ JSON.stringify(err));
							}
							else {
								projectGroup.querySelector('.Project__branch').innerHTML = head.name;
								projectGroup.querySelector('.Project__switchs').remove();
							};
						});
					};
				});
			};
		});
	}
	
	else if (e.target.classList.contains('ProjectDiff__trigger')) {
		var trigger = e.target;
		var diffWrapper = trigger.closest('.ProjectDiff');
	};
});
