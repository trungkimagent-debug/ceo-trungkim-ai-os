# legacy-core

Lớp adaptor mỏng để app mới gọi lại dữ liệu của hệ cũ mà không cần import nguyên file `thumay.js` / `thugop.js` rất lớn.

## Mục tiêu
- giữ nguyên Firebase project `trungkimstar`
- giữ nguyên collection cũ
- tách vài hàm đủ dùng để ghép dần sang app mới

## File
- `firebase-client.js`: init app/auth/db/storage của hệ cũ
- `thumay-repo.js`: observer + create/update ticket Thu máy
- `thugop-repo.js`: observer + create/update ticket Thu góp
- cả hai đều export danh sách collection staff/login để bám đúng hành vi file gốc

## Collection đang giữ nguyên
### Thu máy
- `thumay_posts`
- `thumay_staffs`
- `thumay_techs`

### Thu góp
- `thugop_posts`
- `thugop_staffs`
- `thugop_product_image_archive`
- `thugop_cash_handover_logs`

## Ghi chú
Đây là bước bóc lõi đầu tiên. Chưa thay dữ liệu đang chạy, chỉ tạo lớp tái dùng để ghép dần vào UI/app mới.
