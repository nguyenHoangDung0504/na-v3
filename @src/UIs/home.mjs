/**
 * @typedef {typeof import('../database/index.mjs')['database']} Database
 */

import ListView from '../../@libraries/list_view/index.mjs';
import { Category, Track } from '../app.models.mjs';
import { pager, url } from '../app.utils.mjs';
import { gachaRsItem } from './view_bindings/common.mjs';
import { homeViewBinding } from './view_bindings/home.mjs';

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
 * @param {Database} database
 * @param {ReturnType<typeof bindUI>} UIbindings
 * @param {ReturnType<typeof initializeRenderers>} renderers
 */
async function initializeViews(database, UIbindings, renderers) {
	const rs = await initializeResultMessageView(UIbindings, database, renderers);
	await initializeGridView(rs, database, renderers);
}

/**
 * @param {Database} database
 * @param {ReturnType<typeof bindUI>} UIbindings
 * @param {ReturnType<typeof initializeRenderers>} renderers
 */
async function initializeFeatures(database, UIbindings, renderers) {}

/**
 * @param {Database} db
 */
function bindUI() {
	const homeView = homeViewBinding.bind(document);
	// const menuView = menuViewBinding.bind(appView.menu);
	// const headerView = headerViewBinding.bind(appView.header);
	// const categoriesView = categoriesViewBinding.bind(appView.categoriesModal);
	// const gachaView = gachaViewBinding.bind(appView.gachaModal);

	return { homeView };
}

/**
 * @param {ReturnType<typeof bindUI>} UIbindings
 * @param {Database} db
 */
async function initializeResultMessageView(UIbindings, db) {
	const {
		homeView: { messageBox },
	} = UIbindings;

	messageBox.innerHTML = 'NHD Hentai - ASMR Hentai Tracks';

	await db.tracks.sortBy('code', 'desc');
	let IDs = await db.tracks.getIDs();
	let searchP = url.getParam('search') || url.getParam('s') || '';
	let cvFilter = url.getParam('cv') || '';
	let tagFilter = url.getParam('tag') || '';
	let seriesFilter = url.getParam('series') || '';

	// Filtering
	if (seriesFilter) {
		seriesFilter = seriesFilter
			.split(',')
			.map((id) => id.trim())
			.filter(Boolean)
			.map((id) => +id);

		IDs = await db.searchTracksByCategory('series', seriesFilter, IDs);
	}
	if (cvFilter) {
		cvFilter = cvFilter
			.split(',')
			.map((id) => id.trim())
			.filter(Boolean)
			.map((id) => +id);

		IDs = await db.searchTracksByCategory('cv', cvFilter, IDs);
	}
	if (tagFilter) {
		tagFilter = tagFilter
			.split(',')
			.map((id) => id.trim())
			.filter(Boolean)
			.map((id) => +id);

		IDs = await db.searchTracksByCategory('tag', tagFilter, IDs);
	}
	if (searchP) {
		if (!['@newest', '@n'].includes(searchP)) {
			searchP = searchP
				.split('+')
				.map((v) => v.trim())
				.filter(Boolean)
				.sort((a, b) => a.length - b.length);

			for (let i = 0; i < searchP.length; i++) {
				IDs = await db.searchTracks(searchP[i], IDs);
			}
		} else {
			searchP = null;
		}
	}

	// Display result message
	let html = ``;
	if (seriesFilter.length) {
		html = (await db.series.getAll(seriesFilter)).map(
			(series) => `<span class="series">${series.name} (${series.quantity})</span>`
		);
		messageBox.innerHTML += `<br>Search result for series: ${html}`;
	}
	if (cvFilter.length) {
		html = (await db.CVs.getAll(cvFilter)).map(
			(cv) => `<span class="cv">${cv.name} (${cv.quantity})</span>`
		);
		messageBox.innerHTML += `<br>Search result for CVs: ${html}`;
	}
	if (tagFilter.length) {
		html = (await db.tags.getAll(tagFilter)).map(
			(tag) => `<span class="tag">${tag.name} (${tag.quantity})</span>`
		);
		messageBox.innerHTML += `<br>Search result for tags: ${html}`;
	}
	if (searchP) {
		const resultCount = IDs.length;
		messageBox.innerHTML += `<br>Search result for keyword${
			resultCount > 0 ? 's' : ''
		}: <b><i>${searchP.map((value) => `"${value}"`).join(', ')}</i></b> (${resultCount})`;
	}
	if (IDs.length === 0) {
		messageBox.innerHTML += `<br>There weren't any results found&ensp;&ensp; <a style="padding-inline: 20px;" href="javascript:void(0)" class="series" onclick="window.history.back()">Back</a>`;
	}

	let limitPage = Math.ceil(IDs / 40);
	let page = Number(url.getParam('page') || 1);
	limitPage == 0 ? (limitPage = 1) : limitPage;
	page = !page ? 1 : page;
	page < 1 || page > limitPage ? window.history.back() : '';

	return { IDs, searchP, cvFilter, tagFilter, seriesFilter, limitPage, page };
}

/**
 * @param {Awaited<ReturnType<typeof initializeResultMessageView>>} vars
 * @param {Database} db
 * @param {ReturnType<typeof initializeRenderers>} renderers
 */
async function initializeGridView(vars, db, renderers) {
	const { gridLV } = renderers;
	const tracks = await db.tracks.getAll(vars.IDs);
	gridLV.setDataCollection(pager.getTrackIDsForPage(vars.page, 40, tracks));
}

/**
 * @param {Database} db
 * @param {ReturnType<typeof bindUI>} UIbindings
 */
function initializeRenderers(db, UIbindings) {
	const {
		homeView: { gridContainer },
	} = UIbindings;

	const gridLV = new ListView(Track, gridContainer, async (template, data) => {
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
	});

	return { gridLV };
}
