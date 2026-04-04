FROM python:3.11-slim

WORKDIR /app

RUN apt-get update && apt-get install -y curl

COPY requirements.txt /app/requirements.txt
RUN pip install --upgrade pip \
    && pip install --no-cache-dir -r requirements.txt

COPY main.py /app/main.py
COPY services /app/services
COPY model /app/model

EXPOSE 8000

CMD ["python", "-m", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
