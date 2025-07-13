/**
 * HTML Element có thể thu phóng nội dung bên trong.
 * @class
 */
class ZoomableContainer extends HTMLElement {
	static TAG_NAME = 'zoomable-content';

	constructor() {
		super();
		const shadow = this.attachShadow({ mode: 'open' });
		const templateElem = document.createElement('template');
		templateElem.innerHTML = this.#definedStyle + this.#definedHtmlTemplate;
		shadow.appendChild(templateElem.content.cloneNode(true));
	}

	get #definedStyle() {
		const style = /*css*/ `
            :host {
                display: block;
                overflow: hidden;
                cursor: grab;
            }

            :host(.dragging) {
                cursor: grabbing;
            }

            :host::part(content) {
                transform-origin: 0 0;
                width: 100%;
                height: 100%;
                user-select: none;
            }
        `;
		return `<style>${style}</style>`;
	}

	get #definedHtmlTemplate() {
		return /*html*/ `
            <div part="content">
                <slot></slot>
            </div>
        `;
	}

	/**
	 * @override
	 */
	connectedCallback() {
		this.scale = 1;
		this.minScale = 1;
		this.maxScale = 5;
		this.isDragging = false;
		this.isPinching = false;
		this.dragStart = { x: 0, y: 0 };
		this.offset = { x: 0, y: 0 };

		this.content = this.shadowRoot.querySelector('[part="content"]');

		// Xử lý cuộn để thu phóng (desktop)
		this.addEventListener('wheel', this.handleWheelZoom.bind(this));

		// Xử lý kéo thả để xem nội dung được thu phóng (desktop)
		this.addEventListener('mousedown', this.handleMouseDown.bind(this));
		this.addEventListener('mousemove', this.handleMouseMove.bind(this));
		this.addEventListener('mouseup', this.handleMouseUp.bind(this));

		// Xử lý vuốt ngón tay để thu phóng (mobile)
		this.addEventListener('touchstart', this.handleTouchStart.bind(this));
		this.addEventListener('touchmove', this.handleTouchMove.bind(this), { passive: false });
		this.addEventListener('touchend', this.handleTouchEnd.bind(this));

		// Chặn kéo thả các phần tử con khi nội dung đang được (như hình ảnh, link,...)
		this.content.addEventListener('dragstart', this.blockDrag.bind(this));
	}

	/**
	 * Xử lý chặn tính năng kéo thả mặc định của trình duyệt khi nội dung đang được zoom.
	 * @param {DragEvent} e
	 */
	blockDrag(e) {
		if (this.scale > 1) {
			e.preventDefault();
		}
	}

	/**
	 * Xử lý cuộn để thu phóng
	 * @param {WheelEvent} e
	 */
	handleWheelZoom(e) {
		e.preventDefault();

		const rect = this.getBoundingClientRect();
		const mouseX = e.clientX - rect.left;
		const mouseY = e.clientY - rect.top;

		const deltaScale = e.deltaY > 0 ? 0.9 : 1.1;
		const newScale = Math.min(Math.max(this.scale * deltaScale, this.minScale), this.maxScale);

		const scaleRatio = newScale / this.scale;

		this.offset.x = mouseX - scaleRatio * (mouseX - this.offset.x);
		this.offset.y = mouseY - scaleRatio * (mouseY - this.offset.y);

		this.scale = newScale;
		this.limitOffset();
		this.updateTransform();
	}

	/**
	 * Xử lý sự kiện khi trỏ chuột được ấn xuống (Bắt đầu kéo)
	 * @param {MouseEvent} e
	 */
	handleMouseDown(e) {
		if (this.scale > 1) {
			this.isDragging = true;
			this.classList.add('dragging');
			this.dragStart.x = e.clientX - this.offset.x;
			this.dragStart.y = e.clientY - this.offset.y;
		}
	}

	/**
	 * Xử lý sự kiện khi trỏ chuột di chuyển (Kéo)
	 * @param {MouseEvent} e
	 */
	handleMouseMove(e) {
		if (this.isDragging) {
			this.offset.x = e.clientX - this.dragStart.x;
			this.offset.y = e.clientY - this.dragStart.y;
			this.limitOffset();
			this.updateTransform();
		}
	}

	/**
	 * Xử lý sự kiện khi trỏ chuột được thả ra (Thả)
	 */
	handleMouseUp() {
		this.isDragging = false;
		this.classList.remove('dragging');
	}

	/**
	 * Xử lý sự kiện khi ngón tay bắt đầu chạm (Bắt đầu kéo)
	 * @param {TouchEvent} e
	 */
	handleTouchStart(e) {
		if (e.touches.length === 2) {
			this.isPinching = true;
			this.initialDistance = this.getDistanceBetweenTouches(e.touches);
			this.initialScale = this.scale;

			const rect = this.getBoundingClientRect();
			const [p1, p2] = e.touches;
			this.touchCenterX = (p1.clientX + p2.clientX) / 2 - rect.left;
			this.touchCenterY = (p1.clientY + p2.clientY) / 2 - rect.top;
		} else if (e.touches.length === 1 && this.scale > 1) {
			const touch = e.touches[0];
			this.isDragging = true;
			this.dragStart.x = touch.clientX - this.offset.x;
			this.dragStart.y = touch.clientY - this.offset.y;
		}
	}

	/**
	 * Xử lý sự kiện khi ngón tay di chuyển (Kéo)
	 * @param {TouchEvent} e
	 */
	handleTouchMove(e) {
		if (this.isPinching && e.touches.length === 2) {
			e.preventDefault();

			const newDistance = this.getDistanceBetweenTouches(e.touches);
			const scaleChange = newDistance / this.initialDistance; // Tính toán tỉ lệ zoom
			const newScale = Math.min(Math.max(this.initialScale * scaleChange, this.minScale), this.maxScale);

			// Tính toán lại trung điểm giữa hai ngón tay
			const rect = this.getBoundingClientRect();
			const newTouchCenterX = (e.touches[0].clientX + e.touches[1].clientX) / 2 - rect.left;
			const newTouchCenterY = (e.touches[0].clientY + e.touches[1].clientY) / 2 - rect.top;

			// Tính toán tỉ lệ thay đổi scale
			const scaleRatio = newScale / this.scale;

			// Điều chỉnh offset dựa trên trung điểm mới
			this.offset.x = newTouchCenterX - scaleRatio * (newTouchCenterX - this.offset.x);
			this.offset.y = newTouchCenterY - scaleRatio * (newTouchCenterY - this.offset.y);

			// Cập nhật giá trị scale mới
			this.scale = newScale;

			this.limitOffset();
			this.updateTransform();
		} else if (this.isDragging && e.touches.length === 1) {
			e.preventDefault(); // Chặn refresh trang khi kéo xuống
			const touch = e.touches[0];
			this.offset.x = touch.clientX - this.dragStart.x;
			this.offset.y = touch.clientY - this.dragStart.y;
			this.limitOffset();
			this.updateTransform();
		}
	}

	/**
	 * Xử lý sự kiện khi thả ngón tay ra (Thả)
	 * @param {TouchEvent} e
	 */
	handleTouchEnd(e) {
		if (e.touches.length === 2) {
			this.isPinching = false;
		} else if (e.touches.length === 1) {
			this.isDragging = false;
		}
	}

	/**
	 * Lấy khoảng cách giữa 2 điểm chạm
	 * @param {TouchList} touches
	 * @returns {number}
	 */
	getDistanceBetweenTouches(touches) {
		return Math.hypot(touches[0].clientX - touches[1].clientX, touches[0].clientY - touches[1].clientY);
	}

	/**
	 * Giới hạn tọa độ translate để không bị kéo quá lệch dẫn đến lúc zoom ra có sự lệch không mong muốn.
	 */
	limitOffset() {
		const rect = this.getBoundingClientRect();
		const scaledWidth = rect.width * this.scale;
		const scaledHeight = rect.height * this.scale;

		const minX = Math.min(0, rect.width - scaledWidth);
		const minY = Math.min(0, rect.height - scaledHeight);

		this.offset.x = Math.min(0, Math.max(this.offset.x, minX));
		this.offset.y = Math.min(0, Math.max(this.offset.y, minY));
	}

	/**
	 * Cập nhật lại transform của nội dung bên trong thẻ, bao gồm vị trí và tỉ lệ thu phóng.
	 */
	updateTransform() {
		this.content.style.transform = `translate(${this.offset.x}px, ${this.offset.y}px) scale(${this.scale})`;
	}
}

// Định nghĩa Element nếu chưa tồn tại
!customElements.get(ZoomableContainer.TAG_NAME) && customElements.define(ZoomableContainer.TAG_NAME, ZoomableContainer);
