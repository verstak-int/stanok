var fs = window.require('fs-extra');
var path = window.require('path');

module.exports = getProjects;

// получаем список проектов
function getProjects(projectsPath, type) {
	if (!projectsPath) { return []; };

	var projects = {
		verstak: [],
		polki: [],
		git: []
	};

	fs.readdirSync(projectsPath).forEach(function (item) {
		var isDir = fs.statSync(path.join(projectsPath, item)).isDirectory();

		// работаем только с папками
		if (isDir) {
			fs.readdirSync(path.join(projectsPath, item)).forEach(function (file) {
				if (file === 'verstak.json' || file === 'polki.json') {
					if (file === 'verstak.json') {
						projects.verstak.push(getProjectData('verstak', item, projectsPath, file));
					}
					else if (file === 'polki.json') {
						projects.polki.push(getProjectData('polki', item, projectsPath, file));
					};
					projects.git = projects.git.filter(function (project) {
						return project.name !== item;
					});
				} else if (file === '.git') {
					projects.git.push(getProjectData('git', item));
				};
			});
		};
	});

	return projects;
};

// получаем данные проекта
function getProjectData (type, item, projectsPath, file) {
	if (type === 'git') {
		return {
			name: item,
			type: type
		};
	};

	var data = fs.readFileSync(path.join(projectsPath, item, file), 'utf8');
	var nest = '';
	var result;

	data = JSON.parse(data);

	if (data.nest) {
		nest = data.nest;
		data = fs.readFileSync(path.join(projectsPath, item, data.nest, file), 'utf8');
		data = JSON.parse(data);
	};

	// если в проекте нет подпроектов
	if (!Array.isArray(data)) {
		if (!data.name) {
			data.name = 'main';
		};

		data.nest = nest;

		var project = normalizeProject({
			name: item +'/'+ data.name,
			pureName: item,
			data: data,
			type: type
		});

		result = project;
	}

	// если подпроекты есть
	else {
		result = [];
		data.forEach(function(dataItem, index){
			if (!dataItem.name) {
				dataItem.name = 'main';
			};

			dataItem.nest = nest;

			var project = normalizeProject({
				name: item +'/'+ dataItem.name,
				pureName: item,
				data: dataItem,
				type: type
			});

			result.push(project);
		});
	};

	return result;
};

// подготавливаем информацию о проекте к дальнейшему использованию
function normalizeProject (project) {
		
	// генерация правильной ссылки на проект
	var prefix = 'int';
	var root = 'assets';
	var data = '_layouts';

	if (project.data) {
		if (!project.data.path) {
			project.data.path = {
				root: root,
				data: data
			};
		};

		if (!project.data.path.data) {
			if (project.data.path.layouts) {
				project.data.path.data = project.data.path.layouts;
			}
			else {
				if (!project.data.path.root) {
					project.data.path.root = root;
				};
				project.data.path.data = data;
			};
		};

		if (project.data.path.root) {
			project.data.path.data = project.data.path.root +'/'+ project.data.path.data;
		};

		project.data.path.data = project.data.path.data.replace(/\\/g, '/');
	};

	if (project.name.match(/samsonpost/)) {
		prefix = 'some';
	}
	else if (project.name.match(/dev\.test/)) {
		prefix = 'dev';
	};

	if (project.data) {
		var link = project.name.replace('dev.', prefix +'.').split('/')[0] +'/'+ project.data.path.data;

		project.link = 'http://'+ link.replace(/\/{2,}/g, '/');
	};

	return project;
};
