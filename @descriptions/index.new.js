import { device, url } from '../@src/app.utils.mjs';

const trackID = url.getParam('code') || url.getParam('rjcode') || '';
const TAB_CHARS = '    ';
const TAB_CHARS_2 = '	';
const SPLIT_CHARS = ['- Content_Des', '- Character_Des', '- Track_Des'];
const prefixProcessors = [
	{
		match: /^hr:$/,
		transform: () => /*html*/ `<hr>`,
	},
	{
		match: /^br:$/,
		transform: () => /*html*/ `<br>`,
	},
	{
		match: /^str:(.*)$/,
		transform: (_, content) => /*html*/ `<strong>${content.trim()}</strong>`,
	},
	{
		match: /^img:(https?:\/\/[^\s"']+)/,
		transform: (_, url) => /*html*/ `<img src="${url}" alt="" loading="lazy">`,
	},
	{
		match: /^a:(https?:\/\/[^\s":]+)(?::"([^"]*)")?$/,
		transform: (_, url, label) =>
			`<a href="${url}" target="_blank" rel="noopener noreferrer">${label || url}</a>`,
	},
];

try {
	const res = await fetch(`./storage/${simplifyNumber(+trackID)}/${trackID}/vi.txt`);
	if (res.ok) {
		const [contentDes, charDes, trackDes] = splitByMany(await res.text(), SPLIT_CHARS)
			.filter(Boolean)
			.map((ct) => processTextBlock(ct));

		document.body.innerHTML = /*html*/ `
            <div class="tabs">
                <input type="radio" name="tabs" id="tab1">
                <input type="radio" name="tabs" id="tab2">
                <input type="radio" name="tabs" id="tab3" checked>

                <div class="tab-labels">
                    <label for="tab1">Content</label>
                    <label for="tab2">Characters</label>
                    <label for="tab3">Tracks</label>
                </div>

                <div id="content1" class="tab-content">
                    ${contentDes.trim() || '...'}
                </div>
                <div id="content2" class="tab-content">
                    ${charDes.trim() || '...'}
                </div>
                <div id="content3" class="tab-content">
                    ${trackDes.trim() || '...'}
                </div>
            </div>
        `;
	} else {
		document.querySelector('#loader').remove();
	}
} catch (error) {
	console.log(error);
}

/**
 * @param {string} str
 * @param {string[]} delimiters
 */
function splitByMany(str, delimiters) {
	if (!Array.isArray(delimiters) || delimiters.length === 0) return [str];
	if (delimiters.length === 1) return str.split(delimiters[0]);

	const escaped = delimiters.map((d) => d.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
	const regex = new RegExp(escaped.join('|'), 'g');
	return str.split(regex);
}

/**
 * @param {number} n
 */
function simplifyNumber(n) {
	if (n < 10000) return 10000;

	const str = String(n);
	const length = str.length;
	let keep;
	if (length <= 5) keep = 1;
	else if (length === 6) keep = 2;
	else keep = 3;

	const head = str.slice(0, keep);
	const zeros = '0'.repeat(length - keep);
	return parseInt(head + zeros);
}

/**
 * @param {string} text
 */
function processTextBlock(text) {
	return text
		.split('\n')
		.slice(1)
		.map((line) => line.replaceAll(TAB_CHARS + '-', TAB_CHARS + '・'))
		.map((line) => line.replaceAll(TAB_CHARS_2 + '-', TAB_CHARS + '・'))
		.map((line) => replaceTextWithElements(line).trim())
		.map((lineHTML) =>
			lineHTML.length
				? lineHTML.trim() === '<br>'
					? lineHTML
					: `<div class="line">${lineHTML}</div>`
				: ''
		)
		.join('');
}

/**
 * @param {string} text
 */
function replaceTextWithElements(text) {
	const trimmed = text.trim();
	for (const rule of prefixProcessors) {
		const match = trimmed.match(rule.match);
		if (match) return rule.transform(...match);
	}
	return text;
}

(function () {
	window.addEventListener('load', sendHeight);
	const observer = new ResizeObserver(sendHeight);
	const tabs = document.querySelector('.tabs');
	if (tabs) observer.observe(tabs);

	if (device.isMobile())
		import('../@src/app.materials.mjs').then((module) => {
			new module.SwipeHandler(document.body, prevTab, nextTab, undefined, undefined, 7).registerEvents();
		});

	document.querySelectorAll('input[name="tabs"]').forEach((radio) => {
		radio.addEventListener('change', () => {
			document.querySelectorAll('.tab-content').forEach((el) => (el.style.display = 'none'));

			const id = radio.id.replace('tab', 'content');
			const el = document.getElementById(id);
			if (el) el.style.display = 'block';

			requestAnimationFrame(() => sendHeight());
		});
	});

	let lastSentHeight = 0;

	function sendHeight() {
		const tabs = document.querySelector('.tabs');
		if (!tabs) return;
		const style = getComputedStyle(tabs);
		const height = tabs.getBoundingClientRect().height + parseFloat(style.marginBottom);
		const rounded = Math.ceil(height);
		if (rounded !== lastSentHeight) {
			lastSentHeight = rounded;
			parent.postMessage({ iframeHeight: rounded }, '*');
		}
	}

	function nextTab() {
		document.querySelector(`label[for="tab${getTabID(1)}"]`).click();
	}

	function prevTab() {
		document.querySelector(`label[for="tab${getTabID(-1)}"]`).click();
	}

	function getTabID(modifier) {
		const current = document.querySelector('input[name="tabs"]:checked');
		if (!current) return 1;
		const id = parseInt(current.id.replace('tab', ''), 10);
		const next = Math.min(3, Math.max(1, id + modifier));
		return next;
	}
})();
