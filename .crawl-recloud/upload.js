import path from 'path';
import puppeteer from 'puppeteer';

// --- Main ---
const browser = await puppeteer.launch({ headless: false });
const [page] = await browser.pages();

await page.setRequestInterception(true);

page.on('request', (req) => {
	const url = req.url();
	const blockList = [
		'google-analytics.com',
		'googletagmanager.com',
		'analytics',
		'tracking',
		'hotjar.com',
		'facebook.com/tr',
	];

	if (blockList.some((pattern) => url.includes(pattern))) {
		req.abort();
		return;
	}

	req.continue();
});

await page.goto('https://reccloud.com/ai-subtitle?v=product');
(await page.waitForLoadState?.('networkidle')) ?? (await new Promise((r) => setTimeout(r, 2000)));

// Monitor XHR để confirm up.load có chạy không
page.on('request', (req) => {
	if (req.url().includes('upload') || req.resourceType() === 'fetch') {
		console.log('→ request:', req.method(), req.url());
	}
});

page.on('response', (res) => {
	if (res.url().includes('upload')) {
		console.log('← response:', res.status(), res.url());
	}
});

// Click nút browse → đợi file picker mở → chọn file
const [fileChooser] = await Promise.all([
	page.waitForFileChooser(),
	page.click('[data-v-f9a0b884].gradient-button-auto-theme'),
]);

// TODO: quét thư mục audio lấy tất cả audio, mỗi audio tạo 1 browser, cùng lúc tối đa 2 task (2 browser)
const AUDIO_FILE = './.audio/1.mp3';
await fileChooser.accept([path.resolve(AUDIO_FILE)]);

console.log('✓ Đã chọn file, đang chờ upload...');

// Chờ upload hoàn tất (tuỳ trang, có thể cần tăng timeout)
// TODO: Cải thiện thuật toán, thuật toán này kém.
// Cần xử lý đọc event on req/res, lấy thời gian phù hợp giữa các lần, suy đoán thời gian kết thúc idle. Cần độ chắc chắn cực cao.
// Dưới đây là các request respone trong quá trình upload.
// → request: OPTIONS https://reccloudhk.oss-cn-hongkong.aliyuncs.com/651/6511b127-4cc8-4d9f-892e-2ab6a4571108.mp3?partNumber=7&uploadId=7E4E1063B954420C8BD6D4A4D73B2DD8
// ← response: 200 https://reccloudhk.oss-cn-hongkong.aliyuncs.com/651/6511b127-4cc8-4d9f-892e-2ab6a4571108.mp3?partNumber=3&uploadId=7E4E1063B954420C8BD6D4A4D73B2DD8
// ← response: 200 https://reccloudhk.oss-cn-hongkong.aliyuncs.com/651/6511b127-4cc8-4d9f-892e-2ab6a4571108.mp3?partNumber=7&uploadId=7E4E1063B954420C8BD6D4A4D73B2DD8
// → request: PUT https://reccloudhk.oss-cn-hongkong.aliyuncs.com/651/6511b127-4cc8-4d9f-892e-2ab6a4571108.mp3?partNumber=7&uploadId=7E4E1063B954420C8BD6D4A4D73B2DD8
// → request: OPTIONS https://reccloudhk.oss-cn-hongkong.aliyuncs.com/651/6511b127-4cc8-4d9f-892e-2ab6a4571108.mp3?partNumber=8&uploadId=7E4E1063B954420C8BD6D4A4D73B2DD8
// ← response: 200 https://reccloudhk.oss-cn-hongkong.aliyuncs.com/651/6511b127-4cc8-4d9f-892e-2ab6a4571108.mp3?partNumber=2&uploadId=7E4E1063B954420C8BD6D4A4D73B2DD8
await page.waitForNetworkIdle({ timeout: 60000 * 10, idleTime: 5000 });

{
	// Chờ upload xong, scope div cha xuất hiện
	await page.waitForSelector('div[data-v-584aadf4].size-full.flex.flex-col', { timeout: 20000 });
	console.log('✓ Upload xong!');

	await page.evaluate(async () => {
		const scope = document.querySelector('div[data-v-584aadf4].size-full.flex.flex-col');
		if (!scope) throw new Error('Không tìm thấy scope!');

		// Click Add Translation button
		const btn = scope.querySelector('.cursor-pointer[style*="--start"]');
		if (!btn) throw new Error('Không tìm thấy button!');
		btn.click();
		await new Promise((resolve) => setTimeout(resolve, 500));

		// Lấy div thứ 2 bên trong scope
		const wrappers = scope.querySelectorAll('div[data-v-584aadf4].w-full.mt-\\[8px\\]');
		const wrapper = wrappers[1];
		if (!wrapper) throw new Error('Không tìm thấy wrapper thứ 2!');

		// Click inner div để mở dropdown
		const dropdownTrigger = wrapper.querySelector('.flex.items-center.justify-between.w-full.h-full');
		if (!dropdownTrigger) throw new Error('Không tìm thấy dropdown trigger!');
		['mousedown', 'mouseup', 'click'].forEach((e) => {
			dropdownTrigger.dispatchEvent(new MouseEvent(e, { bubbles: true, cancelable: true }));
		});

		// Chọn Vietnamese
		const list = wrapper.querySelector('[data-list-container-class]');
		if (!list) throw new Error('Không tìm thấy dropdown list!');
		const items = list.querySelectorAll('ul > li');
		const target = [...items].find((li) => li.textContent.trim().toLowerCase() === 'vietnamese');
		if (!target) throw new Error('Không tìm thấy Vietnamese!');
		['mousedown', 'mouseup', 'click'].forEach((e) => {
			target.dispatchEvent(new MouseEvent(e, { bubbles: true, cancelable: true }));
		});

		scope.querySelector('button[data-v-584aadf4].gradient-button-auto-theme').click();
	});
	console.log('✓ Đã click Generate Now!');

	// TODO: Đợi xử lý xong, kích hoạt getResult
	// Trong lúc xử lý, sẽ có rất nhiều request:
	// → request: GET https://gw.aoscdn.com/app/reccloud/v2/open/ai/av/subtitles/recognition/v2/a3977563-1188-4265-b927-5ae5892a796f
	// → request: GET https://gw.aoscdn.com/app/reccloud/v2/open/ai/av/subtitles/recognition/v2/a3977563-1188-4265-b927-5ae5892a796f
	// ...
	// Xây dựng thuật toán đo thời gian và suy đoán thời gian idle kết thúc tương tự lúc upload
	// const { origin, translation } = await getResult(page);
	// Ghi vào file với tên tương ứng trong thư mục .audio/vtt, ví dụ audio.mp3 -> audio.vtt (translation) & audio.raw.vtt (origin)
}
