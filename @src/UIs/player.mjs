import { AudioPlayer, ImageDisplayer, VideoPlayer } from '../app.materials.mjs';
import { device, fullscreen, url } from '../app.utils.mjs';
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
	initFeatures(UI);
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
	const trackID = url.getParam('code') || url.getParam('rjcode') || '75923';
	const track = await db.tracks.get(trackID.toLowerCase().includes('rj') ? trackID : +trackID);

	if (!track) {
		alert('Code not found!');
		return;
	}

	document.title = 'Alt Player:' + track.info.code;

	const {
		playerView: { contentContainer, mp3Container, fullscreenBtn },
	} = UIbindings;

	const images = [track.resource.thumbnail, ...track.resource.images];
	const seen = new Set();
	const imgPrefixes = await db.prefixies.getAll(images.map((img) => img.prefixID));
	const realImage = images.map((iov, index) => {
		iov = `${imgPrefixes[index]}${iov.name}`;
		if (seen.has(iov)) return;
		seen.add(iov);
		contentContainer.appendChild(
			iov.includes('.mp4') ? new VideoPlayer(iov) : new ImageDisplayer(iov, () => fullscreenBtn.click())
		);
		return iov.includes('.mp4') ? undefined : iov;
	});

	const audios = track.resource.audios;
	const audPrefixes = await db.prefixies.getAll(audios.map((aud) => aud.prefixID));
	const audioElements = [];

	if (audios.length > 0) {
		audios.forEach(({ name }, index) => {
			/**@type {import('../../@components/audio_wrapper/component').default} */
			const audioPlayer = document.createElement('audio-wrapper');
			const src = `${audPrefixes[index]}${name}`;
			audioPlayer.sources = [src];
			audioPlayer.setAttribute('name', url.getFileNameFromUrl(src));
			mp3Container.appendChild(audioPlayer);
			audioElements.push(audioPlayer.audio);

			audioPlayer.openBtn.addEventListener('click', async () => {
				const vttPath = `/@descriptions/vtts/${trackID}/${index}.vtt`;
				const res = await fetch(vttPath);
				if (res.ok) {
					window.open(
						`/watch/player/vtt-player/?audio=${src}&vtt=${vttPath}&images=${realImage.filter(Boolean).join(',')}`,
						'_blank'
					);
				} else {
					audioPlayer.audioControls?.openInNewTab();
				}
			});
		});
		new AudioPlayer(
			audioElements,
			track.info.code,
			(await db.CVs.getAll(track.category.cvIDs)).map((c) => c.name),
			(await db.series.getAll(track.category.seriesIDs)).map((s) => s.name),
			`${await db.prefixies.get(track.resource.thumbnail.prefixID)}${track.resource.thumbnail.name}`
		).setupMediaSession();

		// Old version of audio player
		// audios.forEach(({ name }, index) => {
		// 	const src = `${audPrefixes[index]}${name}`;
		// 	mp3Container.appendChild(new AudioController(src, url.getFileNameFromUrl(src)));
		// });
		// new AudioPlayer(
		// 	Array.from(document.querySelectorAll('audio')),
		// 	track.info.code,
		// 	(await db.CVs.getAll(track.category.cvIDs)).map((c) => c.name),
		// 	(await db.series.getAll(track.category.seriesIDs)).map((s) => s.name),
		// 	`${await db.prefixies.get(track.resource.thumbnail.prefixID)}${track.resource.thumbnail.name}`
		// ).setupMediaSession();
	} else {
		mp3Container.remove();
		document.querySelector('#opn-cls-menu-mp3-btn').remove();
	}
}

/**
 * @param {ReturnType<typeof bindUI>} UIbindings
 */
function initFeatures(UIbindings) {
	const {
		playerView: { fullscreenBtn, fullscreenIcon, contentContainer },
	} = UIbindings;
	const alignBtn = document.querySelector('#align-btn');
	let isPortrait = false;

	document.querySelector('#opn-cls-menu-btn').addEventListener('click', () => {
		document.body.classList.toggle('open-menu-ctn');
	});
	document.querySelector('#opn-cls-menu-mp3-btn').addEventListener('click', () => {
		document.body.classList.toggle('open-menu-mp3');
	});
	document.querySelector('#rolate-btn').addEventListener('click', () => {
		if (document.fullscreenElement) {
			if (isPortrait) {
				screen.orientation.unlock();
				screen.orientation.lock('landscape');
				isPortrait = false;
				return;
			}
			screen.orientation.unlock();
			screen.orientation.lock('portrait');
			isPortrait = true;
		}
	});
	document.querySelector('#reload-btn').addEventListener('click', () => {
		document.querySelectorAll('audio, video, img.img[src]').forEach((ele) => {
			ele.load && ele.load();
		});
	});

	alignBtn.addEventListener('click', () => {
		const icon = alignBtn.querySelector('i');

		document.body.classList.toggle('menu-ctn-right');
		if (icon.classList.contains('fa-align-left')) {
			icon.classList.remove('fa-align-left');
			icon.classList.add('fa-align-right');
		} else if (icon.classList.contains('fa-align-right')) {
			icon.classList.remove('fa-align-right');
			icon.classList.add('fa-align-left');
		}
	});

	fullscreenBtn.addEventListener('click', () => {
		if (document.fullscreenElement || document.webkitFullscreenElement || document.msFullscreenElement) {
			if (fullscreenIcon.classList.contains('fa-compress')) {
				fullscreenIcon.classList.remove('fa-compress');
				fullscreenIcon.classList.add('fa-expand');
			}
			fullscreen.deactivate();
			screen.orientation.unlock();
			isPortrait = true;
		} else {
			if (fullscreenIcon.classList.contains('fa-expand')) {
				fullscreenIcon.classList.remove('fa-expand');
				fullscreenIcon.classList.add('fa-compress');
			}
			fullscreen.activate();
			if (device.isMobile()) screen.orientation.lock('landscape');
			isPortrait = false;
		}
	});

	document.querySelector('#next-btn').addEventListener('click', () => {
		contentContainer.appendChild(contentContainer.firstChild);
	});
	document.querySelector('#prev-btn').addEventListener('click', () => {
		contentContainer.insertBefore(contentContainer.lastChild, contentContainer.firstChild);
	});
}
