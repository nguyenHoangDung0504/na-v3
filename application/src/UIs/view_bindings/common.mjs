import createViewBinding from '../../libraries/viewbinding.mjs';

const appViewBinding = createViewBinding({
	loader: '.loader-modal',
	categoryModel: '#categories-modal',
	gachaModel: '#gacha-modal',
	header: '.header',
	menu: '.menu',
});

const menuViewBinding = createViewBinding({
	closeBtn: '#close-menu-btn',
	backBtn: '.back-item',
	reloadBtn: '.reload-item',
	forwardBtn: '.forward-item',
});

const headerViewBinding = createViewBinding({
	toggleBtn: '#toggle-menu-btn',
	searchInput: '#main-search-input as input',
	searchBtn: '#main-search-icon',
	resultBox: '.result-box',
});

const suggestionsViewBinding = createViewBinding({
	type: 'strong',
	value: 'span',
});

export { appViewBinding, menuViewBinding, headerViewBinding, suggestionsViewBinding };
