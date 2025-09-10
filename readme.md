## Nén dữ liệu:

```bash
node .\@data_compressor\
```

## Sửa descriptions:

_Với `code` là code của track_, chạy:

```bash
node .\.edit-description.js code
```

## Chạy dev-server

```bash
node .\.dev\
```

## Note khác

### Lưu trữ URL prefix

- Hiện tại đừng cố `decodeURI` hay `decodeURIComponent` trước khi lưu trữ vì cái nào cũng có case lỗi. Sau này khi quá kém tối ưu hẵn tính
- **_Đã fix_**, sử dụng `decodeURIComponent` khi lưu trữ và export lại khi lấy ra (Version sau 18/8/2025)
