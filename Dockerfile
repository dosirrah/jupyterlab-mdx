# This is the Docker file for production builds.
#

# Dockerfile
# ————————————————————————————
# 1) Builder: compile TS → lib/, labextension
FROM node:18 AS builder
WORKDIR /src
RUN npm install -g yarn
COPY package.json yarn.lock ./
RUN yarn install
COPY . .
RUN yarn build:labextension:dev   # produces lib/ + jupyterlab_mdx/labextension/

/src

# ————————————————————————————
# 2) Runtime: lean Python + JupyterLab + your extension
FROM python:3.11-slim
WORKDIR /home/jovyan/jupyterlab-mdx

# 2a) bring in only the built bits + install JupyterLab
COPY --from=builder /src/lib ./lib
COPY --from=builder /src/jupyterlab_mdx/labextension ./jupyterlab_mdx/labextension
COPY setup.py pyproject.toml ./
RUN pip install jupyterlab setuptools wheel \
 && pip install -e .

# 2b) minimal JS deps just for runtime (if any)
#    *usually none — all JS is prebuilt into lib/*

# default startup
CMD ["jupyter", "lab", "--no-browser", "--ip=0.0.0.0"]

