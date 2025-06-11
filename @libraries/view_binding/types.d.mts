/**
 * Cho phép selector là tên thẻ HTML (như 'div', 'span', 'input'...),
 * hoặc chuỗi bất kỳ (selector CSS tự do).
 */
type RawSelector = keyof HTMLElementTagNameMap | (string & {});

/**
 * Dạng selector không có kiểu rõ ràng, nhưng có dấu `= []` để biểu thị là danh sách.
 * Ví dụ: `'div = []'`, `'my-selector = []'`
 */
type UntypedListSelector = `${RawSelector} = []`;

/**
 * Dạng selector có khai báo kiểu cụ thể:
 * - Dạng danh sách: `'selector = tagName[]'`
 * - Dạng đơn: `'selector = tagName'`
 * Ví dụ: `'item = div[]'`, `'button = button'`
 */
type TypedSelector =
	| `${RawSelector} = ${keyof HTMLElementTagNameMap}[]`
	| `${RawSelector} = ${keyof HTMLElementTagNameMap}`;

/**
 * Tổng hợp các dạng selector hợp lệ, bao gồm:
 * - Selector đơn thuần (RawSelector)
 * - Selector danh sách không rõ kiểu (UntypedListSelector)
 * - Selector có kiểu rõ ràng (TypedSelector)
 */
type Selector = TypedSelector | UntypedListSelector | RawSelector;

/**
 * Map tên các trường trong ViewMap tới chuỗi selector.
 * Dùng để định nghĩa cấu trúc ánh xạ phần tử giao diện trong hệ thống binding.
 */
type ViewMapDefinition = Record<string, Selector>;

/**
 * ParseSelector: Phân tích selector để tách:
 * - Raw selector (selector thực tế)
 * - Tag (nếu có)
 * - isList (có [] không)
 * - isNullable (có dấu ? không)
 *
 * Trả về tuple: [raw, tag | null, isList, isNullable]
 */
type ParseSelector<S> =
	// Dạng: "a? = a[]"
	S extends `${infer Raw}? = ${infer Tag extends keyof HTMLElementTagNameMap}[]`
		? [Raw, Tag, true, true]
		: // Dạng: "a? = a"
		S extends `${infer Raw}? = ${infer Tag extends keyof HTMLElementTagNameMap}`
		? [Raw, Tag, false, true]
		: // Dạng: "a = a[]"
		S extends `${infer Raw} = ${infer Tag extends keyof HTMLElementTagNameMap}[]`
		? [Raw, Tag, true, false]
		: // Dạng: "a = a"
		S extends `${infer Raw} = ${infer Tag extends keyof HTMLElementTagNameMap}`
		? [Raw, Tag, false, false]
		: // Dạng: "raw? = []"
		S extends `${infer Raw}? = []`
		? [Raw, null, true, true]
		: // Dạng: "raw = []"
		S extends `${infer Raw} = []`
		? Raw extends keyof HTMLElementTagNameMap
			? [Raw, Raw, true, false] // Nếu là tag HTML hợp lệ → gán luôn tag
			: [Raw, null, true, false] // Nếu không thì giữ như cũ
		: // Dạng: "tag?" (ví dụ "a?")
		S extends `${infer Raw}?`
		? Raw extends keyof HTMLElementTagNameMap
			? [Raw, Raw, false, true]
			: [Raw, null, false, true]
		: // Dạng: "tag" (ví dụ "a")
		S extends keyof HTMLElementTagNameMap
		? [S, S, false, false]
		: // Dạng: "custom-class"
		  [S, null, false, false];

/**
 * Từ kết quả ParseSelector, xác định kiểu phần tử tương ứng
 */
type ResolveSelector<S> = ParseSelector<S> extends [any, infer Tag, infer IsList, infer IsNullable]
	? Tag extends keyof HTMLElementTagNameMap
		? IsList extends true
			? HTMLElementTagNameMap[Tag][]
			: IsNullable extends true
			? HTMLElementTagNameMap[Tag] | null
			: HTMLElementTagNameMap[Tag]
		: IsList extends true
		? HTMLElement[]
		: IsNullable extends true
		? HTMLElement | null
		: HTMLElement
	: never;

interface ViewBinding<ViewMap extends ViewMapDefinition> {
	/**
	 * Query các phần tử thành view map theo định nghĩa view map đã cung cấp
	 * @param target - Gốc DOM để query, có thể là phần tử HTML hoặc document. Mặc định là document
	 */
	bind<Root extends HTMLElement | Document>(
		target?: Root
	): {
		[K in keyof ViewMap]: ResolveSelector<ViewMap[K]>;
	} & {
		/**
		 * Phần tử gốc của view map này
		 */
		_root: Root;

		/**
		 * Thực hiện query lại các phần tử, cập nhật view map hiện tại
		 */
		_rebind(): void;

		/**
		 * Kiểm tra xem phần tử HTML có phải hoặc thuộc thành phần `viewKey` trong view map không
		 * @param element - Phần tử HTML hoặc target của event
		 * @param viewKey - Tên của element (tên trường) được định nghĩa trong view map
		 */
		_isBoundTo(element: HTMLElement | EventTarget, viewKey: keyof ViewMap): boolean;
	};
}

/**
 * Hàm tạo ViewBinding từ định nghĩa view map
 */
export function createViewBinding<ViewMap extends ViewMapDefinition>(
	viewMap: ViewMap
): { viewBinding: ViewBinding<ViewMap>; viewMap: ViewMap };

/**
 * Truy vấn các phần tử dựa trên bộ chọn và bộ lọc thẻ tùy chọn.
 * @param target - Gốc DOM để tìm kiếm
 * @param selector - Selector CSS để truy vấn
 * @param expectedTag - Tên thẻ mong đợi (viết thường, tùy chọn)
 * @param isList - Nếu true, trả về danh sách; ngược lại trả về phần tử đầu tiên
 */
export function queryElements(
	target: HTMLElement | Document,
	selector: string,
	expectedTag: string | undefined,
	isList: boolean
): HTMLElement | HTMLElement[] | null;
