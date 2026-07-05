# Sử dụng image Node.js chính thức làm base
FROM node:20-slim

# Cài đặt các công cụ hệ thống cần thiết (Python, git, curl)
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    git \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy uv từ image chính thức của Astral vào /bin để chạy toàn cục
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

# Thiết lập thư mục làm việc trong container
WORKDIR /app

# Sao chép file cấu hình package và cài đặt Node dependencies
COPY package*.json ./
RUN npm install --production

# Sao chép toàn bộ mã nguồn vào container
COPY . .

# Expose cổng PORT (Railway/Render sẽ ghi đè cổng này qua biến môi trường PORT)
EXPOSE 3000

# Chạy backend server
CMD ["node", "server.js"]
