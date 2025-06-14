import { device, url } from '../@src/app.utils.mjs';

const trackID = url.getParam('code') || url.getParam('rjcode') || '';
const TAB_CHARS = '    ';
const SPLIT_CHARS = ['- Content_Des', '- Character_Des', '- Track_Des'];

try {
	const res = await fetch(`./storage/${simplifyNumber(+trackID)}/${trackID}/vi.txt`);
	if (res.ok) {
		const [contentDes, charDes, trackDes] = splitByMany(await res.text(), SPLIT_CHARS)
			.filter(Boolean)
			.map((ct) =>
				replaceTextWithElements(
					ct
						.split('\n')
						.slice(1)
						.map((l) => l.replaceAll(TAB_CHARS + '-', TAB_CHARS + '・'))
						.join('\n')
				)
					.trimEnd()
					.replaceAll('\n', '<br>')
			);
		''.startsWith;

		document.body.innerHTML = /*html*/ `
            <div class="tabs">
                <!-- Các input radio đại diện cho từng tab -->
                <input type="radio" name="tabs" id="tab1">
                <input type="radio" name="tabs" id="tab2">
                <input type="radio" name="tabs" id="tab3" checked>

                <!-- Label cho từng tab -->
                <div class="tab-labels">
                    <label for="tab1">Content</label>
                    <label for="tab2">Characters</label>
                    <label for="tab3">Tracks</label>
                </div>

                <!-- Nội dung tương ứng -->
                <div id="content1" class="tab-content">
                    ${contentDes}
                </div>
                <div id="content2" class="tab-content">
                    ${charDes}
                </div>
                <div id="content3" class="tab-content">
                    ${trackDes}
                </div>
            </div>
        `;
	} else {
		document.querySelector('#loader').remove();
	}
} catch (error) {
	console.log(error);
}

function splitByMany(str, delimiters) {
	if (!Array.isArray(delimiters) || delimiters.length === 0) return [str];

	// Nếu chỉ có 1 delimiter, dùng split gốc cho hiệu quả
	if (delimiters.length === 1) return str.split(delimiters[0]);

	// Escape các ký tự đặc biệt cho biểu thức chính quy
	const escaped = delimiters.map((d) => d.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));

	// Tạo biểu thức chính quy kết hợp
	const regex = new RegExp(escaped.join('|'), 'g');

	return str.split(regex);
}

function simplifyNumber(n) {
	if (n < 10000) return 10000;

	const str = String(n);
	const length = str.length;

	// Quy tắc: giữ 1 chữ số đầu nếu < 100000
	// Giữ 2 chữ số đầu nếu < 1_000_000
	// Giữ 3 chữ số đầu nếu lớn hơn
	let keep;
	if (length <= 5) keep = 1;
	else if (length === 6) keep = 2;
	else keep = 3; // phòng xa

	const head = str.slice(0, keep);
	const zeros = '0'.repeat(length - keep);
	return parseInt(head + zeros);
}

function replaceTextWithElements(text) {
	// Thay ảnh trước
	text = text.replace(/img:(https?:\/\/[^\s"']+)/g, (match, url) => {
		return `<img src="${url}" alt="">`;
	});

	// Thay link có thể có label dạng :"Label"
	text = text.replace(/a:(https?:\/\/.*?)(?::"([^"]*)")?(?=\s|$)/g, (match, url, label) => {
		const displayText = label || url;
		return `<a href="${url}" target="_blank" rel="noopener noreferrer">${displayText}</a>`;
	});

	return text;
}

(function () {
	window.addEventListener('load', sendHeight);
	const observer = new ResizeObserver(sendHeight);
	const tabs = document.querySelector('.tabs');
	if (tabs) observer.observe(tabs);

	if (device.isMobile())
		import('../@src/app.materials.mjs').then((module) => {
			new module.SwipeHandler(tabs, prevTab, nextTab).registerEvents();
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

	function sendHeight() {
		const tabs = document.querySelector('.tabs');
		if (!tabs) return;
		const style = getComputedStyle(tabs);
		const height = tabs.getBoundingClientRect().height + parseFloat(style.marginBottom);
		parent.postMessage({ iframeHeight: Math.ceil(height) }, '*');
	}

	function nextTab() {
		console.log('next');
		document.querySelector(`label[for="tab${getTabID(1)}"]`).click();
	}

	function prevTab() {
		console.log('prev');
		document.querySelector(`label[for="tab${getTabID(-1)}"]`).click();
	}

	function getTabID(modifier) {
		const current = document.querySelector('input[name="tabs"]:checked');
		if (!current) return 1; // fallback nếu không có tab nào đang chọn

		const id = parseInt(current.id.replace('tab', ''), 10);
		const next = Math.min(3, Math.max(1, id + modifier));
		return next;
	}
})();
