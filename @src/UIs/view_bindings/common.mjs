import { createViewBinding } from '../../../@libraries/view_binding/index.mjs';

const { viewBinding: appViewBinding } = createViewBinding({
	loader: '.loader-modal',
	categoryModel: '#categories-modal',
	gachaModel: '#gacha-modal',
	header: '.header',
	menu: '.menu',
	categoriesModal: '#categories-modal',
	gachaModal: '#gacha-modal',
});

const { viewBinding: menuViewBinding } = createViewBinding({
	closeBtn: '#close-menu-btn',
	backBtn: '.back-item',
	reloadBtn: '.reload-item',
	forwardBtn: '.forward-item',
	openCatModalBtn: '#open-categories-modal-btn',
	openGachaModelBtn: '#open-gacha-modal-btn',
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

const { viewBinding: categoriesViewBinding } = createViewBinding({
	rankListCvCtn: '.cv-b',
	rankListTagCtn: '.tag-b',
	rankListSeriesCtn: '.series-b',
	listCvCtn: '.cv-b .links',
	listTagCtn: '.tag-b .links',
	listSeriesCtn: '.series-b .links',
	accordions: '.accordion-header = []',
	closeBtn: '#close-categories-modal-btn',
	subRankList: '.sub-rank-list = []',
});

const { viewBinding: gachaViewBinding } = createViewBinding({
	gridGachaModal: '.gacha-grid-container',
	btnCloseGachaModal: '#close-gacha-modal-btn',
	gacha1: '#gachaX1',
	gacha10: '#gachaX10',
});

export {
	appViewBinding,
	menuViewBinding,
	headerViewBinding,
	suggestionsViewBinding,
	categoriesViewBinding,
	gachaViewBinding,
};
