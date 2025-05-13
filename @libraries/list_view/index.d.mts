/**
 * Class helper hỗ trợ render danh sách dữ liệu từ mẫu HTML và dữ liệu.
 */
export default class ListView<T> {
	/**
	 * Khởi tạo một instance của ListView
	 * @param DataType - Lớp định nghĩa kiểu dữ liệu
	 * @param listContainer - Container chứa danh sách
	 * @param dataBinder - Hàm xử lý binding dữ liệu
	 */
	public constructor(
		DataType: new (...args: any[]) => T,
		listContainer: HTMLElement,
		dataBinder: (template: HTMLElement, data: T) => void
	);

	/**
	 * Thiết lập cấu hình cho ListView
	 * @param config - Quyết định xem `ListView` có log hay không, sửa đổi các marker attribute
	 */
	config(config: { log?: true; containerMarkerAttribute?: string; templateMarkerAttribute?: string }): this;

	/**
	 * Thiết lập dữ liệu và render danh sách
	 * @param dataCollection - Danh sách dữ liệu
	 */
	setDataCollection(dataCollection: T[]): void;

	/**
	 * Cài đặt callback cho sự kiện trước khi thêm một phần tử vào giao diện
	 * @param callback - Hàm callback sẽ được gọi trước khi thêm phần tử
	 * @returns Trả về chính đối tượng hiện tại để hỗ trợ chain
	 */
	beforeItemAddedCall(callback: (item?: HTMLElement, data?: T, index?: number) => void): this;

	/**
	 * Cài đặt callback cho sự kiện sau khi một phần tử đã được thêm vào giao diện
	 * @param callback - Hàm callback sẽ được gọi sau khi thêm phần tử
	 * @returns Trả về chính đối tượng hiện tại để hỗ trợ chain
	 */
	afterItemAddedCall(callback: (item?: HTMLElement, data?: T, index?: number) => void): this;

	/**
	 * Cài đặt callback cho sự kiện trước khi bắt đầu quá trình render giao diện
	 * @param callback - Hàm callback sẽ được gọi trước khi bắt đầu render
	 * @returns Trả về chính đối tượng hiện tại để hỗ trợ chain
	 */
	beforeRenderCall(callback: (container?: HTMLElement, dataCollection?: T[]) => void): this;

	/**
	 * Cài đặt callback cho sự kiện sau khi hoàn thành quá trình render giao diện
	 * @param callback - Hàm callback sẽ được gọi sau khi hoàn thành render
	 * @returns Trả về chính đối tượng hiện tại để hỗ trợ chain
	 */
	afterRenderCall(callback: (container?: HTMLElement, dataCollection?: T[], items?: HTMLElement[]) => void): this;

	/**
	 * Render danh sách dựa trên dữ liệu hiện tại
	 */
	render(): void;

	/**
	 * Khởi tạo trước cấu hình `ListView` để sử dụng sau
	 * @param config - Định nghĩa cấu hình
	 */
	static createConfig(config: { log?: true; containerMarkerAttribute?: string; templateMarkerAttribute?: string }): {
		config: {
			log?: true;
			containerMarkerAttribute?: string;
			templateMarkerAttribute?: string;
		};
	};

	/**
	 * Tạo một dataBinder với kiểu dữ liệu được định nghĩa sẵn
	 * @param DataType - Kiểu dữ liệu
	 * @param bindFunction - Hàm xử lý binding
	 * @returns DataBinder được tạo
	 */
	static createDataBinder<T>(
		DataType: new (...args: any[]) => T,
		bindFunction: (template: HTMLElement, data: T) => void
	): (template: HTMLElement, data: T) => void;
}
