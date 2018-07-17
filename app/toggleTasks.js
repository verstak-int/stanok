var startTasks = window.require('./startTasks');
var addLog = window.require('./addLog');

module.exports = toggleTasks;

// переключение задач
function toggleTasks(project, turnOff, cb) {
	if (!turnOff) {
		turnOff = false;
	};

	if (window._.currentProject !== null) {

		// если попытка запустить тот же проект
		// отключаем
		if (project) {
			if (window._.currentProject.name === project.name) {
				turnOff = true;
			};
		};

		// отключаем наблюдателей
		if (window._.currentProject.watcher) {
			window._.currentProject.watcher.css.close();
			window._.currentProject.watcher.layout.close();
			window._.currentProject.watcher.img.close();
		};

		if (window._.currentProject.processor) {
			window._.currentProject.processor.css = null;
			window._.currentProject.processor.img = null;
		};
		
		// и убираем текущий проект
		window.document.querySelector('.Project[data-project-name="'+ window._.currentProject.name +'"]').classList.remove('Project--is-active');
		addLog('Остановлена сборка проекта '+ window._.currentProject.name);
		window._.currentProject = null;

		process.chdir(window._.cWD);

		if (cb) {
			cb();
		};
	};

	if (turnOff !== true) {
		startTasks(project);
	};
};
