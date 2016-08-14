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
						projects.verstak.push(getProjectData('verstak', item,projectsPath, file));
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

function getProjectData (type, item, projectsPath, file) {
	if (type === 'git') {
		return {
			name: item,
			type: type
		};
	};

	var data = fs.readFileSync(path.join(projectsPath, item, file), 'utf8');
	var result;

	data = JSON.parse(data);

	// если в проекте нет подпроектов
	if (!Array.isArray(data)) {
		if (!data.name) {
			data.name = 'main';
		};
		result = {
			name: item +'/'+ data.name,
			data: data,
			type: type
		};
	}

	// если подпроекты есть
	else {
		result = [];
		data.forEach(function(dataItem, index){
			if (!dataItem.name) {
				dataItem.name = 'main';
			};
			result.push({
				name: item +'/'+ dataItem.name,
				data: dataItem,
				type: type
			})
		});
	};

	return result;
};
