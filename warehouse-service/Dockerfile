FROM python:3.12-slim AS base

FROM base AS requirements-stage

WORKDIR /tmp

RUN pip install --upgrade pip \
    && pip install poetry \
    && poetry self add poetry-plugin-export

COPY pyproject.toml ./poetry.lock* /tmp/

RUN poetry export -f requirements.txt --output requirements.txt --without-hashes


FROM base

COPY --from=requirements-stage /tmp/requirements.txt /code/requirements.txt
WORKDIR /code

ENV SQLALCHEMY_SILENCE_UBER_WARNING=1
ENV PYTHONUNBUFFERED=1
ENV OMP_NUM_THREADS=1 \
    OPENBLAS_NUM_THREADS=1 \
    MKL_NUM_THREADS=1 \
    VECLIB_MAXIMUM_THREADS=1 \
    NUMEXPR_NUM_THREADS=1


RUN apt-get update && apt-get -y install --no-install-recommends \
    libpq-dev \
    gcc \
    jq \
    libglx-mesa0 \
    libglib2.0-0 \
    libbz2-dev \
    awscli \
    vim \
    curl \
    python-dev-is-python3 \
    apt-transport-https \
    ca-certificates \
    gnupg \
    awscli \
    && rm -rf /var/lib/apt/lists/*

COPY . /code/
RUN pip install --upgrade pip \
    && pip install --no-cache-dir --upgrade -r /code/requirements.txt \
    && pip install . \
    && rm -rf /root/.cache/pip \
    && gunzip /code/artifacts/xgboost.json.gz
EXPOSE 8000
EXPOSE 1337

CMD ["ddtrace-run", "hypercorn", "--bind=0.0.0.0:8000", "datapooler.web.app:app", "--log-level=INFO", "--access-logfile=-", "--max-requests=10000", "--max-requests-jitter=1000"]
