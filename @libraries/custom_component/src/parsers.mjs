export { html, css };

/**
 * A tagged template literal helper for generating HTML strings.
 *
 * @param {TemplateStringsArray} strings - The static part of the template string.
 * @param  {...any} values - The dynamic values to interpolate into the template.
 * @returns {string} The resulting HTML string.
 */
function html(strings, ...values) {
	const raw = interpolate(strings, ...values);

	return raw
		.replace(/<!--[\s\S]*?-->/g, '') // Xóa comment HTML
		.split('\n')
		.map((line) => line.trim())
		.filter(Boolean)
		.join(' ')
		.replace(/\s*=\s*/g, '=') // Xóa khoảng trắng xung quanh dấu =
		.replace(/\s*\/>/g, '/>') // Xóa khoảng trắng trước />
		.replace(/\s*</g, '<') // Xóa khoảng trắng trước thẻ mở
		.replace(/>\s*/g, '>') // Xóa khoảng trắng sau thẻ đóng
		.replace(/\s+/g, ' ') // Gộp nhiều khoảng trắng còn 1
		.trim();
}

/**
 * A tagged template literal helper for generating CSS strings.
 *
 * @param {TemplateStringsArray} strings - The static part of the template string.
 * @param  {...any} values - The dynamic values to interpolate into the template.
 * @returns {string} The resulting CSS string.
 */
function css(strings, ...values) {
	const raw = interpolate(strings, ...values);

	return raw
		.replace(/\/\*[\s\S]*?\*\//g, '') // Xóa comment
		.split('\n')
		.map((line) => line.trim())
		.filter(Boolean)
		.join(' ')
		.replace(/\s*([:{};,>{])\s*/g, '$1') // Xóa khoảng trắng quanh dấu CSS
		.replace(/\s*([\(\)])\s*/g, '$1') // Xóa khoảng trắng quanh ( )
		.replace(/\s*([<>]=?|=)\s*/g, '$1') // Xóa khoảng trắng trong toán tử < > <= >= =
		.replace(/\s+/g, ' ') // Gộp khoảng trắng
		.trim();
}

/**
 * Helper function for interpolating template literals.
 *
 * @param {TemplateStringsArray} strings - The static part of the template string.
 * @param  {...any} values - The dynamic values to interpolate into the template.
 * @returns {string} The interpolated string.
 */
function interpolate(strings, ...values) {
	return strings.reduce((acc, curr, i) => acc + curr + (values[i] ?? ''), '');
}
