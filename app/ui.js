var doc = window.document;

module.exports = ui;

function ui () {
	return {
		projects: doc.querySelector('.Projects'),
		log: doc.querySelector('.Page__log')
	};
};
