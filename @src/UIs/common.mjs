import ListView from '../../@libraries/list_view/index.mjs';
import { array, device, highlight, sort } from '../app.utils.mjs';
import { debounce } from '../../@libraries/decorators/index.mjs';
import {
	appViewBinding,
	headerViewBinding,
	menuViewBinding,
	suggestionsViewBinding,
	categoriesViewBinding,
} from './view_bindings/common.mjs';
import { SearchSuggestion } from '../app.models.mjs';

/**
 * @typedef {typeof import('../database/index.mjs')['database']} Database
 */

/**
 * @param {Database} database
 * @returns
 */
export async function initialize(database) {
	const UI = bindUI();
	const renderers = initializeRenderers(UI);
	await initializeViews(database, UI, renderers);
	await initializeFeatures(database, UI, renderers);
	return UI;
}

/**
 * @param {Database} db
 */
function bindUI() {
	const appView = appViewBinding.bind(document);
	const menuView = menuViewBinding.bind(appView.menu);
	const headerView = headerViewBinding.bind(appView.header);
	const categoriesView = categoriesViewBinding.bind(appView.categoriesModal);
	return { appView, menuView, headerView, categoriesView };
}

/**
 * @param {Database} database
 * @param {ReturnType<typeof bindUI>} UIbindings
 * @param {ReturnType<typeof initializeRenderers>} renderers
 */
async function initializeViews(database, UIbindings, renderers) {
	await initializeCategoriesView(UIbindings, database);
}

/**
 * @param {Database} database
 * @param {ReturnType<typeof bindUI>} UIbindings
 * @param {ReturnType<typeof initializeRenderers>} renderers
 */
async function initializeFeatures(database, UIbindings, renderers) {
	initializeMenuFeatures(UIbindings);
	initializeHeaderFeatures(UIbindings, database, renderers);
	initializeCategoriesFeatures(UIbindings, database);
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
			if (!menuController.isOpen()) document.documentElement.classList.add('openMenu');
			if (menuController.isHome() && !device.isMobile())
				localStorage.setItem('menu-state', 'opened');
		},
		close: () => {
			if (menuController.isOpen()) document.documentElement.classList.remove('openMenu');
			if (menuController.isHome() && !device.isMobile())
				localStorage.setItem('menu-state', 'closed');
		},
		toggle: () => (menuController.isOpen() ? menuController.close() : menuController.open()),
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

	const hideResultBox = () => setTimeout(() => (resultBox.style.display = 'none'), 200);
	const showResultBox = () => searchInput.value.trim() && (resultBox.style.display = 'block');
	const search = () =>
		searchInput.value.trim() &&
		(window.location.href = `/?search=${encodeURIComponent(searchInput.value)}`);
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
			searchResultLV.setDataCollection(
				array.deduplicateObjects(suggestions, 'code').sort(sort.bySuggestionRelevance)
			);

			showResultBox();
		} else {
			hideResultBox();
		}
	}, debounceTime);

	// === Event bindings ===
	searchInput.addEventListener('input', () => updateSuggestions(searchInput.value));
	searchInput.addEventListener('blur', hideResultBox);
	searchInput.addEventListener('click', showResultBox);
	searchInput.addEventListener('focus', () => window.addEventListener('keyup', enterPressHandler));
	searchInput.addEventListener('blur', () =>
		window.removeEventListener('keyup', enterPressHandler)
	);
	searchBtn.addEventListener('click', search);
}

/**
 * @param {ReturnType<typeof bindUI>} UIbindings
 * @param {Database} db
 */
async function initializeCategoriesView(UIbindings, db) {
	const {
		categoriesView: {
			rankListCvCtn,
			rankListTagCtn,
			rankListSeriesCtn,
			listCvCtn,
			listTagCtn,
			listSeriesCtn,
		},
	} = UIbindings;

	const maps = [db.CVs, db.tags, db.series];
	const containers = [rankListCvCtn, rankListTagCtn, rankListSeriesCtn];
	const listContainers = [listCvCtn, listTagCtn, listSeriesCtn];

	const htmls = [];

	for (let i = 0; i < maps.length; i++) {
		const map = maps[i];
		const container = containers[i];
		const listContainer = listContainers[i];

		const IDs = await map.getIDs();
		container.querySelector('.title').textContent += ` (${IDs.length})`;

		const categoryList = await Promise.all(
			IDs.map(async (id) => {
				const category = await map.get(id);
				if (!category) return '';
				const { name, quantity } = category;
				return /*html*/ `<a href="${location.href.includes('s2') ? '/s2' : ''}/?${
					map.type
				}=${encodeURIComponent(
					id
				)}" class="item" data-quantity="${quantity}" data-id="${id}">${name}</a>`;
			})
		);

		htmls[i] = categoryList.join('');
		listContainer.innerHTML = htmls[i];
	}
}

/**
 * @param {ReturnType<typeof bindUI>} UIbindings
 */
async function initializeCategoriesFeatures(UIbindings) {
	const {
		appView: { categoriesModal },
		menuView: { openCatModalBtn },
		categoriesView: { accordions, subRankList, closeBtn },
	} = UIbindings;
	const debounceTime = 300;

	accordions.forEach((accordion) => {
		accordion.addEventListener('click', () => {
			accordion.classList.toggle('active');
			let panel = accordion.nextElementSibling;
			if (panel.style.maxHeight) {
				panel.style.maxHeight = null;
			} else {
				panel.style.maxHeight = panel.scrollHeight + 'px';
			}
		});

		if (!device.isMobile()) setTimeout(() => accordion.dispatchEvent(new Event('click')), 200);
	});

	subRankList.forEach((subRankBox) => {
		const searchBox = subRankBox.querySelector('input.search');
		const sortTypeSelect = subRankBox.querySelector('select');
		const linkContainer = subRankBox.querySelector('.links');
		const listOfLinks = linkContainer.querySelectorAll('a.item');

		searchBox.addEventListener(
			'input',
			debounce(() => {
				const keyword = searchBox.value.trim().toLowerCase();

				if (keyword) {
					listOfLinks.forEach((link) => {
						if (link.textContent.toLowerCase().includes(keyword)) {
							link.style.display = 'block';
							link.innerHTML = highlight.revoke(link.innerHTML);
							link.innerHTML = highlight.apply(link.innerHTML, keyword);
							return;
						}
						link.style.display = 'none';
					});
					const sortedListOfLinks = Array.from(listOfLinks).sort(
						(a, b) =>
							a.textContent.toLowerCase().indexOf(keyword) -
							b.textContent.toLowerCase().indexOf(keyword)
					);
					sortedListOfLinks.forEach((link) => linkContainer.appendChild(link));
					return;
				}

				listOfLinks.forEach((link) => {
					link.style.display = 'block';
					link.innerHTML = highlight.revoke(link.innerHTML);
				});
				sortTypeSelect.dispatchEvent(new Event('input'));
			}, debounceTime)
		);

		sortTypeSelect.addEventListener('input', () => {
			let sortedListOfLinks = null;
			const value = sortTypeSelect.value.toLowerCase();

			switch (value) {
				case 'name':
					sortedListOfLinks = Array.from(listOfLinks).sort((a, b) =>
						a.textContent.localeCompare(b.textContent)
					);
					break;
				case 'quantity':
				case 'id':
					sortedListOfLinks = Array.from(listOfLinks).sort(
						(a, b) => (+a.dataset[value] - +b.dataset[value]) * (value === 'quantity' ? -1 : 1)
					);
					break;
				default:
					throw new Error('Invalid sort type');
			}

			sortedListOfLinks.forEach((link) => linkContainer.appendChild(link));
		});
	});

	openCatModalBtn.addEventListener('click', openCatgoriesModal);
	closeBtn.addEventListener('click', closeCatgoriesModal);
	categoriesModal.addEventListener('click', (event) => {
		if (event.target.classList.contains('modal-container')) {
			closeCatgoriesModal();
		}
	});

	function openCatgoriesModal() {
		categoriesModal.classList.add('open');
		document.body.classList.add('openModal');
	}

	function closeCatgoriesModal() {
		categoriesModal.classList.remove('open');
		document.body.classList.remove('openModal');
	}
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
			binding._root.href = ['cv', 'tag', 'series'].includes(data.type)
				? `/?${data.type}=${data.code.split('-').pop()}`
				: `/watch/?code=${data.code}`;
			binding.type.textContent = data.displayType;
			binding.value.innerHTML = highlight.apply(data.value, data.keyword);
		}
	);

	return { searchResultLV };
}
