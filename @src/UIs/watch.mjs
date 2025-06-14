import ListView from '../../@libraries/list_view/index.mjs';
import { AddtionalURL, Category, Track } from '../app.models.mjs';
import { url } from '../app.utils.mjs';
import { randomPostViewBinding, watchViewBinding } from './view_bindings/watch.mjs';

/**
 * @typedef {typeof import('../database/index.mjs')['database']} Database
 */

/**
 * @param {Database} database
 */
export async function init(database) {
	const UI = bindUI();
	const renderers = initRenderers(database, UI);
	await initViews(database, UI, renderers);
	initFeatures(UI);
}

/**
 * @param {Database} database
 * @param {ReturnType<typeof bindUI>} UIbindings
 * @param {ReturnType<typeof initRenderers>} renderers
 */
async function initViews(database, UIbindings, renderers) {
	await initWatchView(database, UIbindings, renderers);
}

/**
 * @param {ReturnType<typeof bindUI>} UIbindings
 */
function initFeatures(UIbindings) {
	initCloseMenuFeature(UIbindings);
}

/**
 * @param {ReturnType<typeof bindUI>} UIbindings
 */
function initCloseMenuFeature(UIbindings) {
	const { watchView } = UIbindings;
	watchView._root.addEventListener('click', (ev) => {
		if (watchView._isBoundTo(ev.target, 'closeMenuLayer'))
			document.documentElement.classList.remove('openMenu');
	});
}

/**
 * @param {Database} db
 */
function bindUI() {
	const watchView = watchViewBinding.bind(document);
	return { watchView };
}

/**
 * @param {Database} db
 * @param {ReturnType<typeof bindUI>} UIbindings
 * @param {ReturnType<typeof initRenderers>} renderers
 */
async function initWatchView(db, UIbindings, renderers) {
	const { watchView } = UIbindings;
	const { cvLV, tagLV, seriesLV, otherLinkLV, randomPostLV } = renderers;

	const trackID = url.getParam('code') || url.getParam('rjcode');
	const track = await db.tracks.get(trackID.toLowerCase().includes('rj') ? trackID : +trackID);
	if (!track) {
		window.history.back();
		return;
	}
	const {
		info: { code, RJcode, eName, jName },
		category: { cvIDs, tagIDs, seriesIDs },
		additional,
	} = track;

	watchView.vidFrame.src = `/watch/player/?code=${code}`;
	watchView.downloadLink.href = `/watch/download/?code=${code}`;
	watchView.pCVlabel.textContent = 'CV' + (cvIDs.length > 1 ? 's' : '');
	watchView.pTagLabel.textContent = 'Tag' + (tagIDs.length > 1 ? 's' : '');
	watchView.pRJcode.textContent = RJcode;
	watchView.pEngname.textContent = `${eName} (Original name: ${jName})`;

	cvLV.setDataCollection(await db.CVs.getAll(cvIDs));
	tagLV.setDataCollection(await db.tags.getAll(tagIDs));
	seriesLV.setDataCollection(await db.series.getAll(seriesIDs));
	otherLinkLV.setDataCollection(additional);

	if (!cvIDs.length) watchView.cvCtn.parentElement.remove();
	if (!tagIDs.length) watchView.tagCtn.parentElement.remove();
	if (!seriesIDs.length) watchView.seriesCtn.parentElement.remove();
	if (!additional.length) watchView.otherLinkCtn.parentElement.remove();

	// Random post:
	localStorage.removeItem('shuffledIndexes');
	let randomPost = [];
	while ((randomPost = await db.getRandomTracksKey(12)).includes(code));
	randomPostLV.setDataCollection(await db.tracks.getAll(randomPost));

	// Descriptions:
	const container = document.getElementById('desc-content');
	const iframe = document.createElement('iframe');
	const iframeSrc = `/@descriptions/?code=${code}`;
	const span = document.createElement('span');

	iframe.style.width = '100%';
	iframe.style.height = 'fit-content';
	iframe.style.border = 'none';
	iframe.style.display = 'none';

	span.textContent = 'Loading...';
	container.appendChild(span);
	container.appendChild(iframe);

	iframe.addEventListener('load', () => {
		container.removeChild(span);
		iframe.style.display = 'block';
	});
	iframe.addEventListener('error', () => (span.textContent = 'Nothing here for now...'));
	iframe.src = iframeSrc;

	window.addEventListener('message', (event) => {
		if (event.data.iframeHeight) {
			iframe.style.height = event.data.iframeHeight + 'px';
		}
	});
}

/**
 * @param {Database} db
 * @param {ReturnType<typeof bindUI>} UIbindings
 */
function initRenderers(db, UIbindings) {
	const {
		watchView: { cvCtn, tagCtn, seriesCtn, otherLinkCtn, randomPostCtn },
	} = UIbindings;

	const otherLinkLV = new ListView(AddtionalURL, otherLinkCtn, (template, { note, url }) => {
		template.querySelector('b').textContent = note;
		template.querySelector('a').href = url;
	});

	const cvLV = new ListView(Category, cvCtn, (template, { id, name, quantity }) => {
		template.title = `@${name}`;
		template.href = `/?cv=${id}`;
		template.querySelector('span').textContent = `${name} (${quantity})`;
	});

	const tagLV = new ListView(Category, tagCtn, (template, { id, name, quantity }) => {
		template.title = `#${name}`;
		template.href = `/?tag=${id}`;
		template.querySelector('span').textContent = `${name} (${quantity})`;
	});

	const seriesLV = new ListView(Category, seriesCtn, (template, { id, name, quantity }) => {
		template.title = `${name}`;
		template.href = `/?series=${id}`;
		template.querySelector('span').textContent = `${name} (${quantity})`;
	});

	const randomPostLV = new ListView(Track, randomPostCtn, async (template, data) => {
		const binding = randomPostViewBinding.bind(template);
		const {
			info: { code, RJcode, eName },
			resource: { thumbnail },
		} = data;
		binding._root.dataset.code = code;
		binding._root.href = `/watch/?code=${code}`;
		binding.img.alt = ` - Thumbnail:${code}`;
		binding.img.src = `${await db.prefixies.get(thumbnail.prefixID)}${thumbnail.name}`;
		binding.pRJcode.textContent = RJcode;
		binding.pEngname.textContent = eName;
		binding.pEngname.title = eName;
	});

	return { otherLinkLV, cvLV, tagLV, seriesLV, randomPostLV };
}
