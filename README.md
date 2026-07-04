# Content Writer AI (React + OpenRouter)

Ứng dụng React đơn giản: nhập một **tiêu đề**, AI (qua [OpenRouter](https://openrouter.ai)) sẽ viết một bài nội dung hoàn chỉnh xoay quanh tiêu đề đó, hiển thị dạng streaming (chữ chạy ra dần).

## 1. Lấy API key OpenRouter

1. Vào https://openrouter.ai → đăng ký/đăng nhập.
2. Vào **Keys** → **Create Key**, copy key dạng `sk-or-v1-...`.
3. Nạp credit (OpenRouter tính phí theo model, một số model có bản free).

## 2. Cài đặt

Yêu cầu: Node.js >= 18.

```bash
cd content-writer-ai
npm install
```

## 3. Chạy local

```bash
npm run dev
```

Mở trình duyệt tại địa chỉ hiện ra (mặc định `http://localhost:5173`).

## 4. Sử dụng

1. Dán API key OpenRouter vào ô **OpenRouter API key**.
   - Tick "Ghi nhớ key trên trình duyệt này" nếu muốn lần sau không phải nhập lại (key được lưu trong `localStorage` của trình duyệt).
2. Chọn model AI và độ dài bài viết mong muốn.
3. Nhập tiêu đề, bấm **Viết nội dung**.
4. Nội dung sẽ hiện dần ra ở khung bên phải. Bấm **Sao chép nội dung** để copy.

## Lưu ý quan trọng về bảo mật

Ứng dụng này gọi thẳng OpenRouter API **từ trình duyệt** (frontend-only), nghĩa là API key sẽ nằm trong request gửi từ máy người dùng. Điều này **chỉ phù hợp để bạn tự dùng/test cục bộ**.

**Không nên** deploy bản này công khai (ví dụ lên Vercel/Netlify cho nhiều người dùng) vì bất kỳ ai mở DevTools cũng có thể lấy được API key của bạn. Nếu muốn deploy công khai, cần thêm một backend nhỏ (Node/Express hoặc serverless function) để giữ API key ở phía server — mình có thể giúp bạn làm phần đó khi cần.

## Build production

```bash
npm run build
npm run preview
```

## Tuỳ biến

- Thêm/bớt model: sửa mảng `MODELS` trong `src/App.jsx` (danh sách model xem tại https://openrouter.ai/models).
- Đổi prompt hệ thống: sửa hàm `buildPrompt` trong `src/App.jsx`.
- Đổi giao diện: sửa `src/index.css`.
