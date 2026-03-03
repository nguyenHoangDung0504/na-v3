/**
 * @param {import('puppeteer').Page} page
 */
export default async function getResult(page) {
	const toWebVTT = (items) =>
		'WEBVTT\n\n' +
		items
			.map((item, i) => `${i + 1}\n${msToWebVTT(item.start)} --> ${msToWebVTT(item.end)}\n${item.text.trim()}`)
			.join('\n\n');

	const msToWebVTT = (ms) => {
		const h = Math.floor(ms / 3600000);
		const m = Math.floor((ms % 3600000) / 60000);
		const s = Math.floor((ms % 60000) / 1000);
		const ms2 = ms % 1000;
		return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')},${String(ms2).padStart(3, '0')}`;
	};

	const taskID = new URL(page.url()).searchParams.get('task-id');
	const res = await fetch(`https://gw.aoscdn.com/app/reccloud/v2/open/ai/av/subtitles/recognition/v2/${taskID}`);
	const { data } = await res.json();

	const [{ subtitles: origin }, { subtitles: translation }] = data.subtitles;
	if (!origin || !translation) {
		console.error('Thiếu result:', origin, translation);
		throw new Error('Thiếu result');
	}

	return {
		origin: toWebVTT(origin),
		translation: toWebVTT(translation),
	};
}
