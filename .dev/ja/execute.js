const { CVs, tags, series } = await initData();
const rs = crawlData();

console.log(CVs.length, tags.length, series.length);
console.log(rs);

/**
 * @returns {Promise<{ CVs: string[], tags: string[], series: string[] }>}
 */
async function initData() {
	const module = await import('http://127.0.0.1:5500/@data_compressor/exported-data.js');

	/**@type {[code:number, RJcode:string, CVs:string, tags:string, series:string][]} */
	const data = module.default.map((line) => line.toSpliced(5));

	const trackIDs = new Set();
	let CVs = new Set();
	let tags = new Set();
	let series = new Set();

	data.forEach(([t_code, _, t_CVs, t_tags, t_series]) => {
		trackIDs.add(t_code);
		formatCategory(t_CVs).forEach((cv) => CVs.add(cv));
		formatCategory(t_tags).forEach((tag) => tags.add(tag));
		formatCategory(t_series).forEach((_series) => series.add(_series));
	});

	CVs = Array.from(CVs).sort((a, b) => a.localeCompare(b));
	tags = Array.from(tags).sort((a, b) => a.localeCompare(b));
	series = Array.from(series).sort((a, b) => a.localeCompare(b));

	return { CVs, tags, series };

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
	const engName = filterEngName(document.querySelector('h1.page-title').textContent.trim());
	const rjCode = ps[3].textContent.split(': ')[1].trim();

	const cvs = ps[2].textContent
		.split(': ')[1]
		.split(',')
		.map((s) => s.trim());
	const tags = [...document.querySelectorAll('.post-meta.post-tags a')].map((ele) =>
		ele.textContent.trim()
	);

	return {
		code,
		rjCode,
		japName,
		engName,
		cvs,
		tags,
	};

	/**@param {string} input  */
	function filterEngName(input) {
		let alphabeticCount = input.replace(/[^a-zA-Z]/g, '').length;
		let percentageAlphabetic = (alphabeticCount / input.length) * 100;
		return percentageAlphabetic > 60 ? input : 'engName';
	}
}
