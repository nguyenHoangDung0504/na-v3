import path from 'path';
import fs from 'fs';
import puppeteer from 'puppeteer';
import getResult from './getResult.js';

function waitForSmartIdle(
	page,
	{ pattern, maxWait = 30 * 60 * 1000, multiplier = 5, minIdleTime = 0, label = '', windowSize = 4 },
) {
	return new Promise((resolve, reject) => {
		let started = false;
		let lastTime = null;
		let gaps = [];
		let timer = null;

		const scheduleCheck = () => {
			clearTimeout(timer);
			// Chỉ lấy N gap gần nhất thay vì toàn bộ
			const recentGaps = gaps.slice(-windowSize);
			const avgGap = recentGaps.length > 0 ? recentGaps.reduce((a, b) => a + b, 0) / recentGaps.length : 3000;
			const waitTime = Math.max(avgGap * multiplier, minIdleTime);
			console.log(
				`  [${label}] recent gaps (last ${recentGaps.length}): ${recentGaps.map((g) => Math.round(g)).join(', ')}ms → avg: ${Math.round(avgGap)}ms × ${multiplier} = ${Math.round(waitTime)}ms`,
			);

			timer = setTimeout(() => {
				cleanup();
				resolve();
			}, waitTime);
		};

		const onResponse = (res) => {
			if (!res.url().match(pattern)) return;

			const now = Date.now();
			if (lastTime !== null) {
				gaps.push(now - lastTime);
			}
			lastTime = now;
			started = true;
			scheduleCheck();
		};

		const cleanup = () => {
			clearTimeout(timer);
			clearTimeout(fallback);
			clearTimeout(noStartTimer);
			page.off('response', onResponse);
		};

		const fallback = setTimeout(() => {
			cleanup();
			if (started) resolve();
			else reject(new Error(`[${label}] Timeout ${maxWait}ms, không thấy response nào match: ${pattern}`));
		}, maxWait);

		const noStartTimer = setTimeout(() => {
			if (!started) {
				cleanup();
				reject(new Error(`[${label}] Không phát hiện response nào sau 30s, pattern: ${pattern}`));
			}
		}, 30000);

		page.on('response', onResponse);
	});
}

// ============================================================
// Process 1 audio file
// ============================================================

async function processAudio(audioFile) {
	console.log(`\n🎵 Bắt đầu xử lý: ${audioFile}`);

	const browser = await puppeteer.launch({ headless: false });
	const [page] = await browser.pages();

	// Chặn analytics
	await page.setRequestInterception(true);
	const blockList = ['google-analytics.com', 'googletagmanager.com', 'hotjar.com', 'facebook.com/tr'];
	page.on('request', (req) => {
		if (blockList.some((p) => req.url().includes(p))) {
			req.abort();
		} else {
			req.continue();
		}
	});

	await page.goto('https://reccloud.com/ai-subtitle?v=product');
	await new Promise((r) => setTimeout(r, 2000));

	// Upload file
	const [fileChooser] = await Promise.all([
		page.waitForFileChooser(),
		page.click('[data-v-f9a0b884].gradient-button-auto-theme'),
	]);
	await fileChooser.accept([path.resolve(audioFile)]);
	console.log(`✓ [${audioFile}] Đã chọn file, đang upload...`);

	// Chờ upload xong
	await waitForSmartIdle(page, {
		pattern: /aliyuncs\.com/,
		maxWait: 20 * 60 * 1000,
		multiplier: 8,
		minIdleTime: 15000,
		windowSize: 4,
		label: 'upload',
	});
	console.log(`✓ [${audioFile}] Upload xong!`);

	// Chờ UI render
	await page.waitForSelector('div[data-v-584aadf4].size-full.flex.flex-col', { timeout: 20000 });

	// Chọn Vietnamese và Generate
	await page.evaluate(async () => {
		const scope = document.querySelector('div[data-v-584aadf4].size-full.flex.flex-col');
		if (!scope) throw new Error('Không tìm thấy scope!');

		const btn = scope.querySelector('.cursor-pointer[style*="--start"]');
		if (!btn) throw new Error('Không tìm thấy Add Translation button!');
		btn.click();
		await new Promise((r) => setTimeout(r, 500));

		const wrappers = scope.querySelectorAll('div[data-v-584aadf4].w-full.mt-\\[8px\\]');
		const wrapper = wrappers[1];
		if (!wrapper) throw new Error('Không tìm thấy wrapper thứ 2!');

		const dropdownTrigger = wrapper.querySelector('.flex.items-center.justify-between.w-full.h-full');
		if (!dropdownTrigger) throw new Error('Không tìm thấy dropdown trigger!');
		['mousedown', 'mouseup', 'click'].forEach((e) =>
			dropdownTrigger.dispatchEvent(new MouseEvent(e, { bubbles: true, cancelable: true })),
		);

		await new Promise((r) => setTimeout(r, 300));

		const list = wrapper.querySelector('[data-list-container-class]');
		if (!list) throw new Error('Không tìm thấy dropdown list!');
		const items = list.querySelectorAll('ul > li');
		const target = [...items].find((li) => li.textContent.trim().toLowerCase() === 'vietnamese');
		if (!target) throw new Error('Không tìm thấy Vietnamese!');
		['mousedown', 'mouseup', 'click'].forEach((e) =>
			target.dispatchEvent(new MouseEvent(e, { bubbles: true, cancelable: true })),
		);

		await new Promise((r) => setTimeout(r, 300));
		scope.querySelector('button[data-v-584aadf4].gradient-button-auto-theme').click();
	});
	console.log(`✓ [${audioFile}] Đã click Generate Now!`);

	// Chờ xử lý xong
	console.log(`⏳ [${audioFile}] Đang chờ server xử lý...`);
	await waitForSmartIdle(page, {
		pattern: /subtitles\/recognition\/v2\//,
		maxWait: 30 * 60 * 1000,
		multiplier: 4,
		windowSize: 4,
		label: 'processing',
	});
	console.log(`✓ [${audioFile}] Server xử lý xong!`);

	// Lấy kết quả
	const { origin, translation } = await getResult(page);

	// Ghi file
	const baseName = path.basename(audioFile, path.extname(audioFile));
	const outDir = path.join(path.dirname(audioFile), 'vtt');
	fs.mkdirSync(outDir, { recursive: true });

	const originPath = path.join(outDir, `${baseName}.raw.vtt`);
	fs.writeFileSync(originPath, origin, 'utf-8');
	console.log(`✓ [${audioFile}] Ghi: ${originPath}`);

	if (translation) {
		const translationPath = path.join(outDir, `${baseName}.vtt`);
		fs.writeFileSync(translationPath, translation, 'utf-8');
		console.log(`✓ [${audioFile}] Ghi: ${translationPath}`);
	}

	await browser.close();
	console.log(`[${audioFile}] Hoàn tất!`);
}

// ============================================================
// Main: worker pool — luôn duy trì CONCURRENCY task chạy song song
// Khi 1 task xong thì lấy task tiếp theo vào ngay, không đợi cả batch
// ============================================================

const AUDIO_DIR = './.audio';
const CONCURRENCY = 2;

const audioFiles = fs
	.readdirSync(AUDIO_DIR)
	.filter((f) => ['.mp3', '.wav', '.m4a', '.flac', '.aac', '.ogg'].includes(path.extname(f).toLowerCase()))
	.map((f) => path.join(AUDIO_DIR, f));

console.log(`Tìm thấy ${audioFiles.length} file audio:`, audioFiles);

const queue = [...audioFiles];

async function worker(id) {
	while (queue.length > 0) {
		const file = queue.shift();
		if (!file) break;
		console.log(`[Worker ${id}] Nhận task: ${file} (còn ${queue.length} trong queue)`);
		await processAudio(file);
	}
	console.log(`[Worker ${id}] Hết việc, dừng.`);
}

await Promise.all(Array.from({ length: CONCURRENCY }, (_, i) => worker(i + 1)));

console.log('\nTất cả xong!');
