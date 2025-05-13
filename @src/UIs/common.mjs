import ListView from '../../@libraries/list_view/index.mjs';
import { array, device, highlight, sort } from '../app.utils.mjs';
import { debounce } from '../../@libraries/decorators/index.mjs';
import {
	appViewBinding,
	headerViewBinding,
	menuViewBinding,
	suggestionsViewBinding,
} from './view_bindings/common.mjs';
import { SearchSuggestion } from '../app.models.mjs';

/**
 * @typedef {typeof import('../database/index.mjs')['database']} Database
 */

/**
 * @param {Database} database
 * @returns
 */
export function initialize(database) {
	const UI = bindUI();
	const renderers = initializeRenderers(UI);
	initializeFeatures(database, UI, renderers);
	return UI;
}

/**
 * @param {Database} db
 */
function bindUI() {
	const appView = appViewBinding.bind(document);
	const menuView = menuViewBinding.bind(appView.menu);
	const headerView = headerViewBinding.bind(appView.header);
	return { appView, menuView, headerView };
}

/**
 * @param {Database} database
 * @param {ReturnType<typeof bindUI>} UIbindings
 * @param {ReturnType<typeof initializeRenderers>} renderers
 */
function initializeFeatures(database, UIbindings, renderers) {
	initializeMenuFeatures(UIbindings);
	initializeHeaderFeatures(UIbindings, database, renderers);
}

/**
 * @param {ReturnType<typeof bindUI>} UIbindings
 */
function initializeMenuFeatures(UIbindings) {
	const { menuView, headerView } = UIbindings;

	const menuController = {
		isOpen: () => document.documentElement.classList.contains('openMenu'),
		isHome: () => ['/', '/index.html'].includes(location.pathname),
		open: () => {
			if (!menuController.isOpen())
				document.documentElement.classList.add('openMenu');
			if (menuController.isHome() && !device.isMobile())
				localStorage.setItem('menu-state', 'opened');
		},
		close: () => {
			if (menuController.isOpen())
				document.documentElement.classList.remove('openMenu');
			if (menuController.isHome() && !device.isMobile())
				localStorage.setItem('menu-state', 'closed');
		},
		toggle: () =>
			menuController.isOpen() ? menuController.close() : menuController.open(),
	};

	menuView.backBtn.addEventListener('click', () => window.history.back());
	menuView.reloadBtn.addEventListener('click', () => window.location.reload());
	menuView.forwardBtn.addEventListener('click', () => window.history.forward());
	menuView.closeBtn.addEventListener('click', menuController.close);
	headerView.toggleBtn.addEventListener('click', menuController.toggle);
}

/**
 * @param {ReturnType<typeof bindUI>} UIbindings
 * @param {Database} db
 * @param {ReturnType<typeof initializeRenderers>} renderers
 */
function initializeHeaderFeatures(UIbindings, db, renderers) {
	const { headerView } = UIbindings;
	const { searchInput, resultBox, searchBtn } = headerView;
	const { searchResultLV } = renderers;
	const debounceTime = 300;

	const hideResultBox = () =>
		setTimeout(() => (resultBox.style.display = 'none'), 200);

	const showResultBox = () =>
		searchInput.value.trim() && (resultBox.style.display = 'block');

	const search = () =>
		searchInput.value.trim() &&
		(window.location.href = `/?search=${encodeURIComponent(
			searchInput.value
		)}`);

	const enterPressHandler = (event) => event.key === 'Enter' && search();

	const updateSuggestions = debounce(async (keywords) => {
		if (keywords.trim()) {
			const keywordList = keywords
				.split('+')
				.map((k) => k.trim())
				.filter(Boolean);

			// Chạy song song tất cả các tìm kiếm
			const suggestionsArray = await Promise.all(
				keywordList.map((keyword) => db.getSearchSuggestions(keyword))
			);

			// Gộp tất cả các mảng kết quả lại (vì mỗi cái trả về một mảng)
			const suggestions = suggestionsArray.flat();
			console.log(`Debug suggestions:`, suggestions);

			// Cập nhật ListView với dữ liệu đã lọc và sắp xếp
			searchResultLV.update(
				array
					.deduplicateObjects(suggestions, 'code')
					.sort(sort.bySuggestionRelevance)
			);

			showResultBox();
		} else {
			hideResultBox();
		}
	}, debounceTime);

	// === Event bindings ===
	searchInput.addEventListener('input', () => {
		updateSuggestions(searchInput.value);
	});
	searchInput.addEventListener('blur', hideResultBox);
	searchInput.addEventListener('click', showResultBox);
	searchInput.addEventListener('focus', () =>
		window.addEventListener('keyup', enterPressHandler)
	);
	searchInput.addEventListener('blur', () =>
		window.removeEventListener('keyup', enterPressHandler)
	);
	searchBtn.addEventListener('click', search);
}

/**
 * @param {ReturnType<typeof bindUI>} UIbindings
 */
function initializeRenderers(UIbindings) {
	const { headerView } = UIbindings;
	const { resultBox } = headerView;

	/**@type {ListView<SearchSuggestion<"code" | "RJcode" | "cv" | "tag" | "series" | "eName" | "jName">>} */
	const searchResultLV = new ListView(
		SearchSuggestion,
		resultBox,
		(/**@type {HTMLAnchorElement}*/ template, data) => {
			const binding = suggestionsViewBinding.bind(template);
			binding.root.href =
				(['cv', 'tag', 'series'].includes(data.type)
					? `/?${data.type}=`
					: `/watch/?code=`) + data.code;
			binding.type.textContent = data.displayType;
			binding.value.innerHTML = highlight.apply(data.value, data.keyword);
		}
	);

	return { searchResultLV };
}
