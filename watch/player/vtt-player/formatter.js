export function isBracketTimestampVTT(text, checkLines = 5) {
	const lines = text.split(/\r?\n/).filter((l) => l.trim());
	const regex = /^\[\d{2}:\d{2}\.\d{2,3}\]/;

	let matchCount = 0;
	for (let i = 0; i < Math.min(lines.length, checkLines); i++) {
		if (regex.test(lines[i])) matchCount++;
	}

	return matchCount >= 3;
}

export function convertToWebVTT(text, lastDuration = 2) {
	const lines = text.split(/\r?\n/).filter((l) => l.trim());
	const cues = [];

	for (const line of lines) {
		const m = line.match(/^\[(\d{2}:\d{2}\.\d{2,3})\]\s*(.*)$/);
		if (!m) continue;

		cues.push({
			time: m[1],
			text: m[2],
		});
	}

	let output = ['WEBVTT', ''];

	for (let i = 0; i < cues.length; i++) {
		if (!cues[i].text) continue;
		const start = parseTimestamp(cues[i].time);

		let end;
		if (i < cues.length - 1) {
			end = parseTimestamp(cues[i + 1].time);
		} else {
			// dòng cuối: + lastDuration giây
			const [mm, rest] = cues[i].time.split(':');
			const [ss, ms] = rest.split('.');
			const totalMs = (Number(mm) * 60 + Number(ss)) * 1000 + Number(ms.padEnd(3, '0')) + lastDuration * 1000;

			const eMM = Math.floor(totalMs / 60000);
			const eSS = Math.floor((totalMs % 60000) / 1000);
			const eMS = totalMs % 1000;

			end = `00:${String(eMM).padStart(2, '0')}:${String(eSS).padStart(2, '0')}.${String(eMS).padStart(3, '0')}`;
		}

		output.push(`${start} --> ${end}`, cues[i].text, '');
	}

	return output.join('\n');
}

function parseTimestamp(ts) {
	// ts = "00:05.38"
	const [mm, rest] = ts.split(':');
	const [ss, ms] = rest.split('.');

	return `00:${mm.padStart(2, '0')}:${ss.padStart(2, '0')}.${ms.padEnd(3, '0')}`;
}
