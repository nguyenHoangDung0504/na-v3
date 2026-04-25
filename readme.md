## Nén dữ liệu:

```bash
node .\@data_compressor\
```

## Sửa descriptions:

_Với `code` là code của track_, chạy:

```bash
node .\.edit-description.js code
```

## Khởi tạo/mở file VTT đầu tiên của track:

```bash
node .\.gen-vtt.js code
```

## Quét audio chưa xóa:

```bash
node .\.find-audio.js ...<folder-path>
```

## Download audio:

```bash
node .\.download-audio.mjs -h # Để xem chi tiết cách dùng
```

## Chạy dev-server

```bash
node .\.dev\
```

## Note khác

### Lưu trữ URL prefix

- Hiện tại đừng cố `decodeURI` hay `decodeURIComponent` trước khi lưu trữ vì cái nào cũng có case lỗi. Sau này khi quá kém tối ưu hẵn tính
- **_Đã fix_**, sử dụng `decodeURIComponent` khi lưu trữ và export lại khi lấy ra (Version sau 18/8/2025)

### Cách gom audio

- CD vào path PS @descriptions\storage\140000\141682>
- Tạo file target, VD:
```
file '0.m4a'
file '1.m4a'
file '2.m4a'
file '3.m4a'
file '4.m4a'
file '5.m4a'
file '6.m4a'
file '7.m4a'
file '8.m4a'
file '9.m4a'
```
Sau đó, chạy:
```bash
ffmpeg -f concat -safe 0 -i list.txt -c copy C:\temp\out.m4a
```