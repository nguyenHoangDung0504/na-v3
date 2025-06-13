import { url } from '../app.utils.mjs';
import { playerViewBinding } from './view_bindings/player.mjs';

/**
 * @typedef {typeof import('../database/index.mjs')['database']} Database
 */

/**
 * @param {Database} database
 */
export async function init(database) {
	const UI = bindUI();
	await initView(database, UI);
	initFeatures();
}

function bindUI() {
	const playerView = playerViewBinding.bind(document);
	return { playerView };
}

/**
 * @param {Database} db
 * @param {ReturnType<typeof bindUI>} UIbindings
 */
async function initView(db, UIbindings) {
	const trackID = url.getParam('code') || url.getParam('rjcode') || '';
	const track = await db.tracks.get(trackID.toLowerCase().includes('rj') ? trackID : +trackID);

	if (!track) {
		alert('Code not found!');
		return;
	}

	document.title = 'Alt Player:' + track.info.code;
}

/**
 * @param {ReturnType<typeof bindUI>} UIbindings
 */
function initFeatures(UIbindings) {}
