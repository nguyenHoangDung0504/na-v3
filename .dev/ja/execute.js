const { trackIDs, CVs, tags } = await initData();
const rs = crawlData();
const { CV_KEYS, TAG_KEYS, EXCLUDE_TAGS } = getConstKeys();

if (trackIDs.has(rs.code)) {
	console.log('***NOTE: DUPLICATE CODE***');
}

await execute();

async function execute() {
	const rsCVstr = Array.from(
		new Set(
			rs.cvs.map((cv) => {
				const title = toTitleCase(cv);
				return (
					CV_KEYS.get(title) ||
					CVs.find((c) => c.toLowerCase() === title.toLowerCase().split(' ').reverse().join(' ')) ||
					title
				);
			})
		)
	)
		.sort()
		.join(',');

	const rsTagList = rs.tags
		.map((tag) => {
			let rsTag = toTitleCase(tag);
			for (const [key, value] of TAG_KEYS.entries()) {
				if (rsTag.toLowerCase().includes(key.toLowerCase())) {
					rsTag = value;
				}
			}
			return rsTag;
		})
		.map((rsTag) => {
			if ([...TAG_KEYS.values()].includes(rsTag)) return rsTag;
			const matched = [];
			for (const tag of tags) {
				if (rsTag.toLowerCase().includes(tag.toLowerCase())) {
					matched.push(tag);
				}
			}
			return Array.from(new Set(matched)).join(',');
		})
		.filter(Boolean);

	let rsTagStr = Array.from(new Set(rsTagList.map((s) => s.split(',')).flat()));
	EXCLUDE_TAGS.forEach((value, key) => {
		if (rsTagStr.includes(key)) {
			rsTagStr = rsTagStr.filter((r) => r !== value);
		}
	});
	rsTagStr = rsTagStr.sort().join(',');

	await copy(
		`_(${rs.code}, "${rs.rjCode}", "${rsCVstr}", "${rsTagStr}", "", "${rs.engName}", "${rs.japName}", t0i0a)`
	);
}

async function copy(value, timeout = 100) {
	const textarea = document.createElement('textarea');
	textarea.value = value;
	document.body.appendChild(textarea);

	await new Promise((resolve) => {
		setTimeout(() => {
			textarea.select();
			document.execCommand('copy');
			document.body.removeChild(textarea);
			console.log('copied');
			resolve();
		}, timeout);
	});
}

/**
 * @returns {Promise<{ trackIDs: Set<number>, CVs: string[], tags: string[], series: string[] }>}
 */
async function initData() {
	const module = await import('http://127.0.0.1:5500/.data_compressor/exported-data.js');

	/**@type {[code:number, RJcode:string, CVs:string, tags:string, series:string][]} */
	const data = module.default.map((line) => line.toSpliced(5));

	const trackIDs = new Set();
	let CVs = new Set();
	let tags = new Set();

	data.forEach(([t_code, _, t_CVs, t_tags]) => {
		trackIDs.add(t_code);
		formatCategory(t_CVs).forEach((cv) => CVs.add(cv));
		formatCategory(t_tags).forEach((tag) => tags.add(tag));
	});

	CVs = Array.from(CVs).sort((a, b) => a.localeCompare(b));
	tags = Array.from(tags).sort((a, b) => a.localeCompare(b));

	return { trackIDs, CVs, tags };

	/**@param {string} catStr  */
	function formatCategory(catStr) {
		return catStr
			.split(',')
			.map((c) => c.trim())
			.filter(Boolean);
	}
}

function crawlData() {
	const code = +location.href.match(/\d+/)[0];
	const ps = document.querySelectorAll('p');

	const japName = ps[1].textContent.trim();
	const engName = escapeQuotes(filterEngName(document.querySelector('h1.page-title').textContent.trim()));
	const rjCode = escapeQuotes(ps[3].textContent.split(': ')[1].trim());

	const cvs = ps[2].textContent
		.split(': ')[1]
		.split(',')
		.map((s) => s.trim())
		.filter(Boolean);
	const tags = [...document.querySelectorAll('.post-meta.post-tags a')]
		.map((ele) => ele.textContent.trim())
		.filter(Boolean);

	return { code, rjCode, japName, engName, cvs, tags };
}

/**@param {string} input  */
function filterEngName(input) {
	let alphabeticCount = input.replace(/[^a-zA-Z]/g, '').length;
	let percentageAlphabetic = (alphabeticCount / input.length) * 100;
	return percentageAlphabetic > 70 ? input : 'engName';
}

/**
 * @param {string} str
 * @returns {string}
 */
function escapeQuotes(str) {
	return str
		.replace(/\\/g, '\\\\') // escape backslash trước
		.replace(/"/g, '\\"') // escape double quote
		.replace(/'/g, "\\'"); // escape single quote
}

function getConstKeys() {
	const TAG_KEYS = new Map([
		['Student', 'School Girl,Student'],
		['School/Academy', 'School'],
		['Imouto', 'Sister,Younger Sister,Incest'],
		['Breast Sex', 'Paizuri'],
		['Trap', 'Crossdress'],
		['Voluptuous/Plump', 'Chubby'],
		['Real Elder Sister', 'Sister,Oneesan,Incest'],
		['Mommie', 'Mother,Milf,Mature Women'],
		['Mother', 'Mother,Milf,Mature Women'],
		['Jock/Athlete/Sports', 'Sport Girl'],
		['Cohabitation', 'Living Together'],
		['Lovers', 'Girlfriend'],
		['French kiss', 'Kissing'],
		['Nonhuman/Monster Girl', 'Non-human Girl'],
		['Housewife', 'Housewife,Mature Women'],
		['Sumata', 'Thighjob'],
		['Guided Masturbation', 'Masturbation Support'],
		['Pubic Hair/Armpit Hair', 'Hairy'],
		['Burping', 'Burping,Fetish'],
		['Vomit', 'Vomit,Fetish'],
		['Oho voice', 'Oho Voice'],
		['Seductive', 'Seduction'],
	]);

	const CV_KEYS = new Map([
		['Momoka Yuzuki', 'MOMOKA'],
		['Aruha Kotone', 'Kotone Akatsuki'],
	]);

	const EXCLUDE_TAGS = new Map([
		['Ear Licking', 'Licking'],
		['School Uniform', 'Uniform'],
	]);

	return { TAG_KEYS, CV_KEYS, EXCLUDE_TAGS };
}

/**@param {string} str */
function toTitleCase(str) {
	return str
		.toLowerCase()
		.split(/\s+/)
		.map((word) => word.charAt(0).toUpperCase() + word.slice(1))
		.join(' ');
}
