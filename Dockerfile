# Dockerfile (two‐stage: build TS+Python → runtime with vim)
#
# Better yet use docker compose.
#
#   docker-compose up
#
# To just want to build an image that builds jupyterlab-mdx::
#   docker build -t jupyterlab-mdx:latest .
#
# To run jupyter lab with mdx plugin,
#
#   docker run --rm -it jupyterlab-mdx:latest bash
#

# --------- STAGE 1: build JS & Python ----------
FROM node:20-slim AS build-node

# 1. Install Python 3.11 and required tools
# I added vim, unzip, dos2unix for debugging the build. --Dave
RUN apt-get update \
  && apt-get install -y --no-install-recommends \
       python3.11 python3.11-venv python3-pip curl vim dos2unix nodejs npm unzip \
  && ln -s /usr/bin/python3.11 /usr/local/bin/python \
  && rm -rf /var/lib/apt/lists/*

# 2. Enable corepack globally as root.  Why?  I don't know.  Suggested by ChatGPT.
RUN corepack enable

# 3. Create non-root user
RUN useradd --create-home --shell /bin/bash jovyan \
  && mkdir -p /home/jovyan/jupyterlab-mdx \
  && chown -R jovyan:jovyan /home/jovyan

# 4. Set working directory and switch to jovyan
WORKDIR /home/jovyan/jupyterlab-mdx
USER jovyan

# 5. Copy source code into the container into the WORKDIR.
COPY --chown=jovyan:jovyan . ./

# 6. HACK.  Yarn wasn't installing correctly, so I had to work around
# it by directly downloading the desired yarn version using curl.
RUN mkdir -p .yarn/releases \
  && curl -fL https://repo.yarnpkg.com/4.9.1/packages/yarnpkg-cli/bin/yarn.js \
       -o .yarn/releases/yarn-4.9.1.cjs

RUN npm install --no-save @yarnpkg/cli@4.9.1
RUN mkdir -p node_modules/.bin \
  && ln -sf ../../.yarn/releases/yarn-4.9.1.cjs node_modules/.bin/yarn \
  && chmod +x node_modules/.bin/yarn

ENV PATH="/home/jovyan/jupyterlab-mdx/node_modules/.bin:${PATH}"

# 7. Prepare Python venv & install JupyterLab + jupyterlab-mdx package
ENV VENV_DIR=/home/jovyan/.venv
ENV PATH="$VENV_DIR/bin:${PATH}"
RUN python -m venv $VENV_DIR \
 && pip install --upgrade pip setuptools wheel hatchling \
 && pip install jupyterlab \
 && pip install -e .

RUN yarn install && yarn run build:lib && yarn run build:labextension

RUN python -m hatchling build

# 8. Confirm core files were built
RUN echo "🔍 Checking labextension build output..." \
 && test -f jupyterlab_mdx/labextension/jupyterlab-mdx/package.json \
 && echo "✅ package.json found" \
 && test -f jupyterlab_mdx/labextension/jupyterlab-mdx/static/remoteEntry.*.js \
 && echo "✅ remoteEntry.*.js found" \
 && test -f jupyterlab_mdx/labextension/jupyterlab-mdx/static/style.js \
 && echo "✅ style.js found"

# Confirm wheel and sdist were built
RUN echo "🔍 Checking Python distribution artifacts..." \
 && test -f dist/*.whl \
 && echo "✅ wheel found" \
 && test -f dist/*.tar.gz \
 && echo "✅ sdist tarball found"

#RUN yarn test


# ─────────── STAGE 2: runtime image ───────────
FROM python:3.11-slim

# 1. Install just what we need at runtime:
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
    && rm -rf /var/lib/apt/lists/*


# 2. Create a non-root user "jovyan" to run Jupyter
RUN useradd --create-home --shell /bin/bash jovyan
USER jovyan
WORKDIR /home/jovyan

# 3. Set up venv
ENV VENV_DIR=/home/jovyan/.venv
ENV PATH="$VENV_DIR/bin:${PATH}"

RUN python -m venv /home/jovyan/.venv && \
    /home/jovyan/.venv/bin/pip install --upgrade pip setuptools wheel jupyterlab

# good packages to have for doing some minimalist data science.
RUN /home/jovyan/.venv/bin/pip install \
    numpy \
    pandas \
    scipy \
    statsmodels \
    matplotlib \
    seaborn \
    plotly \
    scikit-learn \
    tqdm \
    ipywidgets
  
# 4. Copy only the built wheel from Stage 1
COPY --chown=jovyan:jovyan --from=build-node /home/jovyan/jupyterlab-mdx/dist/*.whl /tmp/

# 5. Install the wheel (your extension)
RUN /home/jovyan/.venv/bin/python -m pip install /tmp/*.whl

# 6. ✅ Sanity check
RUN test -f /home/jovyan/.venv/share/jupyter/labextensions/jupyterlab-mdx/package.json \
    && echo "✅ Wheel installed labextension files as expected"
RUN jupyter labextension list && echo "✅ Extension is registered"

# 7. Write a Jupyter server config that disables authentication entirely.
#    Jupyter Server 2.x requires a custom IdentityProvider to bypass the
#    login redirect that otherwise occurs even with an empty token.
RUN mkdir -p /home/jovyan/.jupyter
COPY --chown=jovyan:jovyan jupyter_server_config.py /home/jovyan/.jupyter/jupyter_server_config.py

# 8. Default command: launch JupyterLab (no browser, no token)
CMD ["jupyter", "lab", "--ip=0.0.0.0", "--no-browser", "--ServerApp.token=", "--NotebookApp.notebook_dir=/home/jovyan/repo"]

# To test environment.
#CMD ["bash"]
