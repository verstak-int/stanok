var fs = require('fs-extra');
var stream = require('stream');
var path = require('path');
var gui = require('nw.gui');

var git = require('gift');

var livereload = require('livereload');
var differ = require('differ');

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
		var project = diffWrapper.closest('.Project');
		var group = project.closest('.Project__group');
		var projectName = group.getAttribute('data-project-group-name');
		var projectPath = group.querySelector('.Project__explorer').getAttribute('data-project-path');
		var data = JSON.parse(project.querySelector('.Project__data').innerHTML);
		var dataPath = data.path.data;
		var pagesPath = path.join(projectPath, dataPath, 'src', 'pages');

		// сделать словарь замен
		// какие домены менять на int или some
		var projectBase = projectName +'/'+ dataPath;
		
		if (projectBase.match(/(office|samsonopt|brabix|brauberg|ibt|kanzelaria|laima|sonnen|tiger-family)/)) {
			projectBase = projectBase.replace(/^dev/, 'int');
		}
		else if (projectBase.match(/(samsonpost)/)) {
			projectBase = projectBase.replace(/^dev/, 'some');
		};

		var pages = fs.readdirSync(pagesPath).map(function (page) {
			var name = page.replace('.php', '');

			return {
				name: name,
				url: 'http://'+ projectBase +'?p='+ name
			};
		});

		var references = path.join(
			projectPath,
			data.path.data,
			data.path.reference
		);

		document.querySelector('.ProjectDiff').classList.add('ProjectDiff--process');

		var progress = document.createElement('progress');

		progress.max = pages.length;
		progress.value = 0;
		document.querySelector('.ProjectDiff__result').appendChild(progress);

		differ({

			// что снимать
			what: pages,

			// куда положить и с чем сравнить
			where: references,

			// по готовности каждого снимка
			each: function (item) {
				console._log(item);
				progress.value++;
			},

			// по готовности всей информации
			cb: onDiffer
		});
		
		function onDiffer (data, cfg) {
			console._log(data);

			var targetElem = document.querySelector('.ProjectDiff__result');

			// добавляем шаблон блока сравнения
			if (!document.querySelector('#diffTmpl')) {
				targetElem.innerHTML += '\
				<template id="diffTmpl">\
					<div class="diff">\
						<input class="diff__approve" type="checkbox">\
						<h2 class="diff__header"></h2>\
						<div class="diff__group">\
							<div class="diff__box diff__box--tmp">\
								<img class="diff__img">\
								<label class="diff__trigger">Сделать эталоном</label>\
							</div>\
							<div class="diff__box diff__box--diff">\
								<img class="diff__img">\
							</div>\
							<div class="diff__box diff__box--ethalon">\
								<img class="diff__img">\
							</div>\
						</div>\
					</div>\
				</template>';
			};

			// строим блоки сравнения
			data.forEach(function (diff, i) {
				if (diff.type !== 'equal') {

					var diffTmpl = document.querySelector('#diffTmpl').content;

					if (diff.type !== 'added') {
						diffTmpl.querySelector('.diff__header').innerHTML = diff.item.name +', '+ diff.type;
						diffTmpl.querySelector('.diff__box--tmp img').src = 'file:///'+ diff.path.tmp.replace(/\\/g, '/');
					};

					diffTmpl.querySelector('.diff__approve').id = 'item'+ i;
					diffTmpl.querySelector('.diff__trigger').setAttribute('for', 'item'+ i);

					if (diff.type === 'change') {
						diffTmpl.querySelector('.diff__box--diff img').src = 'file:///'+ diff.path.diff.replace(/\\/g, '/');
					};

					diffTmpl.querySelector('.diff__box--ethalon img').src = 'file:///'+ diff.path.ref.replace(/\\/g, '/');

					var diffTmplClone = window.document.importNode(diffTmpl, true);

					targetElem.appendChild(diffTmplClone);
				};
			});

			// https://scotch.io/tutorials/creating-a-photo-discovery-app-with-nw-js-part-1
			// https://nodejs.org/api/fs.html#fs_fs_renamesync_oldpath_newpath

			// добавляем кнопку окончания сравнения
			var finish = document.createElement('button');

			finish.innerHTML = 'Закончить сравнение';
			finish.onclick = function () {

				[].forEach.call(document.querySelectorAll('.diff__approve'), function (approve) {
					var isReference = approve.checked;
					var item = data[approve.id.replace('item', '') * 1];

					console._log(item);
					fs.removeSync(item.path.tmp);
				});

				targetElem.innerHTML = '';
				document.querySelector('.ProjectDiff').classList.remove('ProjectDiff--process');
			};
			targetElem.appendChild(finish);
		};

		// обработчик для изображений
		document.addEventListener('click', function (e) {
			if (e.target.closest('img')) {
				var src = e.target.closest('img').src;

				if (src) {
					openItem(src);
				};
			};
		});

		// открытие в стандартной программе
		function openItem (path) {
			gui.Shell.openItem(path.replace(/\\/g, '/'));
		};

		// СДЕЛАТЬ
		// удалять ненужные файлы
		// fs.removeSync(path.join(
		// 	process.cwd(),
		// 	cfg.where
		// ));
	};
});
