# Content Writer AI (Chạy ngầm qua Chrome Cookies)

Ứng dụng React đơn giản giúp bạn trích xuất hội thoại từ phụ đề SRT, gửi yêu cầu viết câu chuyện tiếng Tây Ban Nha chạy ngầm thông qua **Cookies Google Chrome** của bạn và tự động thu thập kết quả về mà **không cần API Key**, **tránh giới hạn rate limit của API.**

Hệ thống hoạt động thông qua một Node.js Backend kết nối với tiến trình **`gemini-webapi-mcp`** (tự động đọc session cookies của Chrome thông qua công cụ `uv`).

---

## 1. Hướng dẫn thiết lập ban đầu

### Bước 1.1: Cài đặt công cụ quản lý UV (Nếu chưa có)
Hệ thống sử dụng `uv` để chạy ngầm MCP server. Nếu máy tính chưa cài đặt `uv`, bạn có thể cài đặt nhanh qua các lệnh sau:
* **Windows**:
  ```powershell
  powershell -ExecutionPolicy ByPass -c "irm https://astral.sh/uv/install.ps1 | iex"
  ```
* **macOS/Linux**:
  ```bash
  curl -LsSf https://astral.sh/uv/install.sh | sh
  ```

### Bước 1.2: Đăng nhập Gemini trên Chrome
Bạn chỉ cần mở trình duyệt **Google Chrome** thông thường và đăng nhập tài khoản Google của bạn tại trang web [gemini.google.com](https://gemini.google.com). 
*(Tiến trình backend sẽ tự động đọc cookies đăng nhập từ trình duyệt Chrome của bạn để thực hiện xác thực chạy ngầm).*

---

## 2. Khởi chạy Ứng dụng

### Bước 2.1: Cài đặt thư viện Frontend
```bash
cd content-writer-ai
npm install
```

### Bước 2.2: Chạy Node.js Backend local
Backend sẽ tự động tải và chạy MCP server `gemini-webapi-mcp` thông qua `uv` để đọc cookies và giao tiếp với Gemini:
```bash
node server.js
```
Server backend sẽ chạy tại địa chỉ `http://localhost:3000`.

### Bước 2.3: Chạy Frontend React (Vite)
Mở một tab terminal mới và chạy:
```bash
npm run dev
```
Truy cập trang web hiển thị trên terminal (mặc định là `http://localhost:5173`).

---

## 3. Cách sử dụng

1. Tải lên (upload) các file phụ đề `.srt` của bạn.
2. Nhấn nút **🚀 Viết tự động bằng Chrome Cookies cho tất cả các file**.
3. Hệ thống sẽ tự động chạy ngầm, gọi API Gemini qua session cookies và thu nhận kết quả.
4. Khi viết xong, câu chuyện tiếng Tây Ban Nha sẽ tự động hiển thị ở phần xem trước cột bên phải.
5. Bạn cũng có thể dùng nút **📋 Copy Prompt** để tự dán thủ công nếu muốn, hoặc dán truyện thủ công vào ô nhập liệu để cập nhật bản lưu.
6. Click **Sao chép tất cả truyện đã viết** ở dưới cùng để gộp tất cả nội dung.

