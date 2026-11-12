FROM python:3.11-slim

WORKDIR /app

COPY services/ai-engine/requirements.mock.txt .
RUN pip install --no-cache-dir -r requirements.mock.txt

COPY services/ai-engine .

ENV MOCK_AI=true

CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT:-5000}"]
