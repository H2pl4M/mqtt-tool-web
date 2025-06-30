# 使用Node.js作为构建环境
FROM node:16.15.1 AS builder

# 设置工作目录
WORKDIR /app

# 复制依赖文件并安装
COPY package*.json ./
RUN npm ci

# 复制所有源代码
COPY . .

# 构建生产版本的应用
RUN npm run build

# 使用Nginx作为运行环境
FROM nginx:1.23.3-alpine

# 从构建阶段复制构建产物
COPY --from=builder /app/build /usr/share/nginx/html

# 复制自定义Nginx配置
COPY nginx.conf /etc/nginx/conf.d/default.conf

# 暴露80端口
EXPOSE 80

# 启动Nginx服务器
CMD ["nginx", "-g", "daemon off;"]