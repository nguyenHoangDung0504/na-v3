## Nén dữ liệu:

```bash
node .\@data_compressor\
```

**_Note:_** Đang thử nghiệm thuật toán lưu URL mới, hiện tại, sử dụng:

```bash
node .\.data_compressor\testing\
```

_**Lưu ý phải chạy từ project root**: Trong mã nguồn có sử dụng đường dẫn tương đối -> chạy file trực tiếp sẽ lỗi_

## Sửa descriptions:

_Với `code` là code của track_, chạy:

```bash
node .\.edit-description.js code
```

## Chạy dev-server

```bash
node .\.dev-server.js
```

## Note khác

### Lưu trữ URL prefix

Hiện tại đừng cố `decodeURI` hay `decodeURIComponent` trước khi lưu trữ vì cái nào cũng có case lỗi. Sau này khi quá kém tối ưu hẵn tính
