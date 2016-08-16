var fs = window.require('fs-extra');
var path = window.require('path');

var addLog = window.require('./addLog');

module.exports = startTasks;

// запуск задачи
function startTasks(project) {
	
	window._.currentProject = project;
	window.document.querySelector('.Project[data-project-name="'+ window._.currentProject.name +'"]').classList.add('Project--is-active');
	addLog('Начата сборка проекта '+ window._.currentProject.name);

	var projectDir = window._.currentProject.name.split('/')[0];
	var projectsPath = window.localStorage.projectsPath;

	// меняем рабочую папку
	// https://nodejs.org/api/process.html#process_process_chdir_directory
	process.chdir(path.join(projectsPath, projectDir));
	window._.cWD = process.cwd();

	// настраиваем сборку проекта
	var project = {};

	project.verstak = window._.currentProject.data;

	// браузеры, для которых добавляются префиксы
	project.browsers = project.verstak.browsers || [
		'last 5 versions',
		'Chrome 27',
		'ff 12',
		'ie 8',
		'ie 9',
		'opera 12'
	];

	if (!project.verstak.hasOwnProperty('path')) {
		project.verstak.path = {};
	};

	if (project.verstak.path.root === '') {
		project.root = project.verstak.path.root;
	}
	else if (!!project.verstak.path.root) {
		project.root = project.verstak.path.root.replace(/^\//g, '').replace(/\/$/g, '') +'/';
	}
	else {
		project.root = 'assets/';
	};

	project.root = path.normalize(project.root);

	project.style = project.verstak.path.style || 'css';
	project.img = project.verstak.path.img || 'img';
	project.layouts = project.verstak.path.layouts || '_layouts';
	project.html = project.verstak.path.html || '_html';


	var chokidar = window.require('chokidar');

	window.require('es6-promise').polyfill();
	var postcss = window.require('postcss');

	var Imagemin = window.require('imagemin');
	var pngquant = window.require('imagemin-pngquant');
	var imNewer = window.require('imagemin-newer');


	window._.currentProject.processor = {};

	// обработать файл стилей
	var processCss = function (cb) {

		// чистим папку с отрисованными свг,
		// они будут генерироваться заново
		fs.removeSync(path.normalize(project.root + project.img +'/svg_fallback/**/*'));

		// получаем файлы стилей для начала работы
		var styles = fs.readdirSync(path.normalize(project.root + project.style +'/src/')).map(function (style) {
			if (style.match(/^_main.*\.css$/)) { return style; };
			return null;
		}).filter(function (style) {
			if (style !== null) { return true; };
			return false;
		});

		// если стили найдены
		if (styles.length) {
			styles.forEach(process);
		}
		else {
			addLog('Не найдены файлы стилей для обработки', 'warn');
		};

		// обработка файла
		function process (style) {
			var stylePath = path.normalize(project.root + project.style +'/src/'+ style);
			var stylePure = style.replace(/^_/, '');

			// получаем исходники
			var source = fs.readFileSync(stylePath);

			// настраиваем обработчики
			postcss([

				// используется общий обработчик
				// не всем нужна настройка
				window.require('intcss')({
					'import': {
						from: stylePath,
						path: [
							path.dirname(stylePath),
							'../lib/styles/postcss/'
						]
					},
					'assets': {
						loadPaths: [
							path.normalize(project.root + project.img +'/dest')
						]
					},
					'svg': {
						paths: [
							path.normalize(project.root + project.img +'/dest')
						]
					},
					'url': {
						basePath: window._.cWD
					},
					'svg-fallback': {
						dest: path.normalize(project.root + project.img +'/svg_fallback/')
					},
					'autoprefixer': {
						browsers: project.browsers
					},
					'data-packer': {
						dest: {
							path: function (opts) {
								return path.join(path.dirname(opts.to), path.basename(opts.to, '.css') + '_data.css');
							},
							map: {
								inline: false,
								annotation: function (dataOpts, opts) {
									return path.join(path.dirname(opts.map.annotation), path.basename(dataOpts.to) +'.map');
								}
							}
						}
					}
				})
			])
			.process(source, {
				from: stylePath,
				to: path.normalize(project.root + project.style +'/'+ stylePure),
				map: {
					inline: false,
					annotation: 'maps/'+ stylePure +'.map'
				}
			})
			.then(function (result) {
				result.warnings().forEach(function (message) {
					addLog(message.toString(), 'warn');
				});

				fs.writeFileSync(result.opts.to, result.css);

				if ( result.map ) {
					fs.writeFileSync(path.join(path.dirname(result.opts.to), result.opts.map.annotation), result.map);
				};

				window._.server.reloadFile(result.opts.to);
				window._.server.reloadFile(path.join(path.dirname(result.opts.to), path.basename(result.opts.to, '.css') + '_data.css'));

				addLog('Файлы стилей обработаны');
				if (cb) {
					cb();
				};
			}).catch(function (error) {
				addLog(error.message, 'error', error.stack);
			});
		};
	};
	window._.currentProject.processor.css = processCss;

	window._.currentProject.watcher = {};

	// наблюдатель за стилями
	window._.currentProject.watcher.css = chokidar.watch([
			path.normalize(project.root + project.style +'/src/**/*')
		], {
		ignored: '',
		persistent: true,
		ignoreInitial: true
	});
	window._.currentProject.watcher.css.on('all', startCssProcess);

	// реакция на изменения
	function startCssProcess(event, path) {
		addLog('Событие «'+ event +'» файла стилей: '+ path);
		setTimeout(processCss, 100);
	};


	// обработать изображения
	var processImg = function (cb) {
		new Imagemin()
			.src(path.normalize(project.root + project.img +'/src/**/*.{gif,jpg,png,svg}'))
			.use(imNewer(path.normalize(project.root + project.img +'/dest')))
			.dest(path.normalize(project.root + project.img +'/dest'))
			.use(pngquant())
			.run(function (err, files) {
				addLog('Изображения обработаны');
				if (cb) {
					cb();
				};
			});
	};
	window._.currentProject.processor.img = processImg;

	// наблюдатель за изображениями
	window._.currentProject.watcher.img = chokidar.watch([
			path.normalize(project.root + project.img +'/src/**/*')
		], {
		ignored: '',
		persistent: true,
		ignoreInitial: true
	});
	window._.currentProject.watcher.img.on('all', startImgProcess);

	// реагируем на изменения изображений
	function startImgProcess(event, filePath) {
		addLog('Событие «'+ event +'» изображения: '+ filePath);

		if (event === 'unlink') {
			var removePath = filePath.replace(path.normalize(project.root + project.img +'/src/'), path.normalize(project.root + project.img +'/dest/'));

			if (removePath) {
				fs.removeSync(removePath);
				addLog('Файл удалён: '+ removePath);
				window._.server.reloadAll();
			};
		}
		else {
			setTimeout(imgProcess, 100);
		};
	};

	function imgProcess() {
		processImg(function () {
			window._.server.reloadAll();
			processCss();
		});
	};


	// наблюдатель за разметкой и скриптами
	var watchLayoutPath = [
		path.normalize(project.root + project.layouts +'/**/*.php'),
		path.normalize(project.root + project.layouts +'/**/*.js')
	];

	if (project.html) {
		watchLayoutPath.push(project.root + project.html +'/**/*.html');
	};

	window._.currentProject.watcher.layout = chokidar.watch(watchLayoutPath, {
		ignored: '',
		persistent: true,
		ignoreInitial: true
	});
	window._.currentProject.watcher.layout.on('all', startHtmlProcess);

	// реагируем на изменения разметки и скриптов
	function startHtmlProcess(event, path) {
		addLog('Событие «'+ event +'» файла разметки: '+ path);
		if (path.match(/\.html$/g)) {
			window._.server.reloadFile(path.replace(/\\/g, '/'));
		}
		else {
			window._.server.reloadAll();
		};
	};
};
