import { url } from '../@src/app.utils.mjs';

const trackID = url.getParam('code') || url.getParam('rjcode') || '';
const TAB_CHARS = '    ';
const SPLIT_CHARS = ['- Content_Des', '- Character_Des', '- Track_Des'];

try {
	const res = await fetch(`./storage/${Math.trunc(+trackID / 1000)}/${trackID}/vi.txt`);
	if (res.ok) {
		const [contentDes, charDes, trackDes] = splitByMany(await res.text(), SPLIT_CHARS)
			.filter(Boolean)
			.map((ct) =>
				ct
					.split('\n')
					.slice(1)
					.map((l) => l.replaceAll(TAB_CHARS + '-', TAB_CHARS + '・'))
					.join('\n')
					.replaceAll('\n', '<br>')
			);

		document.body.innerHTML = /*html*/ `
            <div class="tabs">
                <!-- Các input radio đại diện cho từng tab -->
                <input type="radio" name="tabs" id="tab1" checked>
                <input type="radio" name="tabs" id="tab2">
                <input type="radio" name="tabs" id="tab3">

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
