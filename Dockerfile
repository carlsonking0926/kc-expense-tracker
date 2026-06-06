FROM python:3.12-slim

WORKDIR /app
ENV DATA_DIR=/app/data

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app ./app

EXPOSE 8080
# 用 shell form 讓 $PORT 可被展開（Zeabur 會注入 PORT；沒有就用 8080）
CMD uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8080}
