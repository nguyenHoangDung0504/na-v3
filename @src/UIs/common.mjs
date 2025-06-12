import ListView from '../../@libraries/list_view/index.mjs';
import { array, device, highlight, sort } from '../app.utils.mjs';
import { debounce } from '../../@libraries/decorators/index.mjs';
import {
	appViewBinding,
	headerViewBinding,
	menuViewBinding,
	suggestionsViewBinding,
	categoriesViewBinding,
	gachaViewBinding,
	gachaRsItem,
} from './view_bindings/common.mjs';
import { Category, SearchSuggestion, Track } from '../app.models.mjs';

/**
 * @typedef {typeof import('../database/index.mjs')['database']} Database
 */

/**
 * @param {Database} database
 * @returns
 */
export async function initialize(database) {
	const UI = bindUI();
	const renderers = initializeRenderers(database, UI);
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
	const gachaView = gachaViewBinding.bind(appView.gachaModal);

	return { appView, menuView, headerView, categoriesView, gachaView };
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
	initializeGachaFeatures(UIbindings, database, renderers);
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
		const categoryList = (await map.getAll(IDs)).map(
			/**@param {Category} category */ (category) => {
				const { type, id, name, quantity } = category;
				return /*html*/ `<a
					href="/?${type}=${encodeURIComponent(id)}"
					class="item"
					data-quantity="${quantity}"
					data-id="${id}">${name}
				</a>`;
			}
		);

		container.querySelector('.title').textContent += ` (${IDs.length})`;
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
 * @param {Database} db
 * @param {ReturnType<typeof initializeRenderers>} renderers
 */
function initializeGachaFeatures(UIbindings, db, renderers) {
	const {
		appView: { gachaModal },
		menuView: { openGachaModalBtn },
		gachaView: { gridGachaModal, gachaModalBody, closeBtn, gacha1, gacha10 },
	} = UIbindings;
	const { gachaResultLV } = renderers;
	let onG10Anim = false;

	openGachaModalBtn.addEventListener('click', openGachaModal);
	closeBtn.addEventListener('click', closeGachaModal);
	gachaModal.addEventListener('click', (event) => {
		if (event.target.classList.contains('modal-container')) {
			closeGachaModal();
		}
	});
	gacha10.addEventListener('click', () => {
		if (onG10Anim) return;

		gacha10.classList.add('active');
		onG10Anim = true;
		gacha10.addEventListener(
			'transitionend',
			function () {
				setTimeout(() => {
					this.classList.remove('active');
					this.style.setProperty('--transition-time', '.15s');
					this.addEventListener(
						'transitionend',
						() => {
							this.style.setProperty('--transition-time', null);
							onG10Anim = false;
						},
						{ once: true }
					);
				}, 100);
			},
			{ once: true }
		);

		const shards = document.querySelectorAll('.shard');
		const screenWidth = screen.width;
		const screenHeight = screen.height;
		const avgDimension = (screenWidth + screenHeight) / 2;
		const usedPositions = []; // Mảng lưu trữ các vị trí đã dùng

		shards.forEach((shard) => {
			let xTranslate, yTranslate, distance;
			shard.opacity = 1;

			// Xác định vị trí sao cho không bị trùng hoặc quá gần các mảnh khác
			do {
				xTranslate = (Math.random() - 0.5) * (avgDimension * 0.2); // Khoảng cách bay 20% của avgDimension
				yTranslate = (Math.random() - 0.5) * (avgDimension * 0.2); // Khoảng cách bay 20% của avgDimension

				// Tính khoảng cách từ vị trí (xTranslate, yTranslate) đến các vị trí đã sử dụng
				distance = usedPositions.every((pos) => {
					const dx = xTranslate - pos.x;
					const dy = yTranslate - pos.y;
					return Math.sqrt(dx * dx + dy * dy) > avgDimension * 0.05; // Đảm bảo khoảng cách tối thiểu là 5% của avgDimension
				});
			} while (!distance);

			// Lưu vị trí này vào mảng usedPositions
			usedPositions.push({ x: xTranslate, y: yTranslate });

			// Kích thước của mỗi shard (tỉ lệ theo avgDimension)
			shard.style.width = `${avgDimension * 0.015}px`; // 1.5% của avgDimension
			shard.style.height = `${avgDimension * 0.015}px`; // 1.5% của avgDimension

			// Thời gian bay của mỗi shard
			let duration = 800;

			// Tạo animation với animate()
			shard.animate(
				[
					{ transform: 'translate(0, 0)', filter: 'brightness(1.5)', opacity: 1 },
					{
						transform: `translate(${xTranslate}px, ${yTranslate}px) rotate(${180}deg)`,
						filter: 'brightness(1.5)',
						opacity: 1,
					},
					{
						transform: `translate(${xTranslate}px, ${
							yTranslate + Math.abs(yTranslate / 2)
						}px) rotate(${270}deg)`,
						filter: 'brightness(1.0)',
						opacity: 1,
					},
					{
						transform: `translate(${xTranslate}px, ${
							yTranslate + Math.abs(yTranslate)
						}px) rotate(${360}deg)`,
						opacity: 0,
					},
				],
				{
					duration: duration,
					easing: 'ease-out',
					fill: 'forwards',
				}
			);
		});
	});
	gacha10.addEventListener('click', function () {
		gacha(this.dataset.count);
	});
	gacha1.addEventListener('click', function () {
		gacha(this.dataset.count);
	});

	function openGachaModal() {
		gachaModal.classList.add('open');
		document.body.classList.add('openModal');
	}
	function closeGachaModal() {
		gachaModal.classList.remove('open');
		document.body.classList.remove('openModal');
	}
	async function gacha(count) {
		gridGachaModal.innerHTML = '';
		gachaModalBody.scrollTop = 0;

		const trackKeys = await db.getRandomTracksKey(count);
		const tracks = await db.tracks.getAll(trackKeys);
		gachaResultLV.setDataCollection(tracks);
	}
}

/**
 * @param {Database} db
 * @param {ReturnType<typeof bindUI>} UIbindings
 */
function initializeRenderers(db, UIbindings) {
	const {
		headerView: { resultBox },
		gachaView: { gridGachaModal },
	} = UIbindings;

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

	const gachaResultLV = new ListView(Track, gridGachaModal, async (template, data) => {
		const binding = gachaRsItem.bind(template);
		const {
			info: { code, RJcode, eName },
			resource: { thumbnail },
			category: { cvIDs },
		} = data;
		const watchPath = `/watch/?code=${code}`;

		binding._root.dataset.code = code;
		binding._root.dataset.id = `link-to:${RJcode}`;
		binding.img.alt = ` - Thumbnail:${code}`;
		binding.img.src = `${await db.prefixies.get(thumbnail.prefixID)}${thumbnail.name}`;
		binding.pRJcode.textContent = RJcode;
		binding.pEngname.textContent = eName;
		binding.link1.href = binding.link2.href = watchPath;
		binding.cvLabel.textContent = 'CV' + (cvIDs.length > 1 ? 's' : '');

		new ListView(Category, binding.cvList, (template, data) => {
			template.href = `/?cv=${data.id}`;
			template.title = `@${data.name}`;
			template.textContent = `${data.name} (${data.quantity})`;
		}).setDataCollection(await db.CVs.getAll(cvIDs));
	}).afterItemAddedCall((item, _, index) => {
		item.style.opacity = '0';
		setTimeout(() => {
			item.style.opacity = null;
		}, index * 100);
	});

	return { searchResultLV, gachaResultLV };
}
