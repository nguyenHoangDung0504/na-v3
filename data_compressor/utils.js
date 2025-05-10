/**
 * @param {string} input
 * @returns {string}
 */
function convertQuotes(input) {
	let result = input.replace(/'/g, '’'); // Thay dấu ' thành ’

	// Duyệt qua chuỗi và thay dấu " thành “ hoặc ”
	let inQuotes = false; // Biến kiểm tra xem chúng ta đang ở trong dấu ngoặc hay không

	result = result
		.split('')
		.map((char, index, array) => {
			if (char === '"') {
				// Nếu dấu " đầu tiên hoặc không có dấu cách phía trước, đó là dấu mở ngoặc
				if (!inQuotes || (index > 0 && array[index - 1] === ' ')) {
					inQuotes = !inQuotes; // Bắt đầu dấu ngoặc
					return '“'; // Thay bằng dấu mở ngoặc
				} else {
					inQuotes = !inQuotes; // Kết thúc dấu ngoặc
					return '”'; // Thay bằng dấu đóng ngoặc
				}
			}
			return char; // Trả về ký tự gốc nếu không phải dấu "
		})
		.join('');

	return result;
}

export { convertQuotes };
