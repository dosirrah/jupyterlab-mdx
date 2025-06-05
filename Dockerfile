# ─────────────────────────────────────────────────────────────────────────────
# Dockerfile (two‐stage: build TS+Python → runtime with vim)
# ─────────────────────────────────────────────────────────────────────────────

# ─────────── STAGE 1: build JS & Python ───────────
FROM node:18-slim AS build-node

# 1) Install Python 3.11 so we can pip‐install JupyterLab & your package
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
         python3.11 \
         python3.11-venv \
         python3-pip \
    && ln -s /usr/bin/python3.11 /usr/local/bin/python \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /home/jovyan/jupyterlab-mdx

# 2) Copy your entire repo into /home/jovyan/jupyterlab-mdx
COPY . ./

# 3) Create a Python 3.11 venv, install JupyterLab + Hatchling + your package
RUN python --version \
    && python -m venv /venv \
    && /venv/bin/pip install --no-cache-dir --upgrade pip setuptools wheel hatchling \
    && /venv/bin/pip install --no-cache-dir jupyterlab \
    && /venv/bin/pip install --no-cache-dir -e .

# 4) Install JS deps and compile TS → lib/ + bundle the labextension
RUN corepack enable \
    && corepack prepare yarn@4.9.1 --activate \
    && yarn install \
    && yarn run build:lib \
    && yarn run build:labextension

# At this point, you have:
#  - lib/             (compiled JS)
#  - jupyterlab_mdx/labextension/jupyterlab-mdx/  (prebuilt bundle)
#  - a Python venv in /venv with jupyterlab and your package installed


# ─────────── STAGE 2: runtime image ───────────
FROM python:3.11-slim

# 5) Install just what we need at runtime:
#    - vim-tiny → gives us “vi” inside the container
#    - ca-certificates, git, curl → in case you want to clone or curl
#    Node.js & npm are NOT strictly required at runtime, because the extension is already built.
#    We omit 'corepack' entirely. Jupyter will load the prebuilt JS without needing yarn/Node again.
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
         ca-certificates \
         git \
         curl \
         vim-tiny \
    && rm -rf /var/lib/apt/lists/* \
    \
    # Create a non-root user "jovyan" to run Jupyter
    && useradd --create-home --shell /bin/bash jovyan \
    && chown -R jovyan: /home/jovyan

WORKDIR /home/jovyan/jupyterlab-mdx
USER jovyan

# 6) Copy only the built artifacts and the Python venv from build-node
COPY --chown=jovyan:jovyan --from=build-node /home/jovyan/jupyterlab-mdx/ ./
COPY --chown=jovyan:jovyan --from=build-node /venv /venv

# 7) Prepend /venv/bin so "python" and "jupyter" point to the venv’s executables
ENV PATH="/venv/bin:${PATH}"

# 8) Expose JupyterLab’s port
EXPOSE 8888

# 9) Default command: launch JupyterLab (no browser, no token)
CMD ["jupyter", "lab", "--ip=0.0.0.0", "--no-browser", "--ServerApp.token=''"]