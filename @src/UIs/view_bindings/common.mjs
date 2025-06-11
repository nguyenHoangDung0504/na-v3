import { createViewBinding } from '../../../@libraries/view_binding/index.mjs';

const { viewBinding: appViewBinding } = createViewBinding({
	loader: '.loader-modal',
	categoryModel: '#categories-modal',
	gachaModel: '#gacha-modal',
	header: '.header',
	menu: '.menu',
});

const { viewBinding: menuViewBinding } = createViewBinding({
	closeBtn: '#close-menu-btn',
	backBtn: '.back-item',
	reloadBtn: '.reload-item',
	forwardBtn: '.forward-item',
});

const { viewBinding: headerViewBinding } = createViewBinding({
	toggleBtn: '#toggle-menu-btn',
	searchInput: '#main-search-input = input',
	searchBtn: '#main-search-icon',
	resultBox: '.result-box',
});

const { viewBinding: suggestionsViewBinding } = createViewBinding({
	type: 'strong',
	value: 'span',
});

export {
	appViewBinding,
	menuViewBinding,
	headerViewBinding,
	suggestionsViewBinding,
};
