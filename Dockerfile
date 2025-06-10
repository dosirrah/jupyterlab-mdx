# Dockerfile (two‐stage: build TS+Python → runtime with vim)

# --------- STAGE 1: build JS & Python ----------
FROM node:20-slim AS build-node

# 1. Install Python 3.11 and required tools
RUN apt-get update \
  && apt-get install -y --no-install-recommends \
       python3.11 python3.11-venv python3-pip curl vim dos2unix nodejs npm \
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

# 10) Prepare Python venv & install JupyterLab + your package
ENV VENV_DIR=/home/jovyan/.venv
ENV PATH="$VENV_DIR/bin:${PATH}"
RUN python -m venv $VENV_DIR \
 && pip install --upgrade pip setuptools wheel hatchling \
 && pip install jupyterlab \
 && pip install -e .

# `npm run build` replaces the yarn install below.
RUN npm run build  

#RUN yarn install
#
#RUN yarn run build:lib \
# && jupyter labextension build . \
#      --output jupyterlab_mdx/labextension/jupyterlab-mdx

#&& yarn run build:labextension

# Generate install.json in the correct directory
#RUN cd jupyterlab_mdx/labextension/jupyterlab-mdx \
#  && jupyter labextension build . \
#  && echo "✅ install.json generated" \
#  && ls install.json


## generate the install.json manifest into the extension folder
#RUN jupyter labextension init jupyterlab_mdx/labextension/jupyterlab-mdx
#
## Stage 1, right after the JS build:
#RUN python -m hatchling build

## At this point, you should have:
##  - lib/             (compiled JS)
##  - jupyterlab_mdx/labextension/jupyterlab-mdx/  (prebuilt bundle with install.json and static/)
##  - a Python venv with jupyterlab and your package installed

#RUN echo "🔍 Checking labextension build output..." \
#  && ls -R jupyterlab_mdx/labextension \
#  && test -f jupyterlab_mdx/labextension/install.json \
#  && echo "✅ install.json found"
#
#RUN test -f jupyterlab_mdx/labextension/package.json \
#  && echo "✅ package.json found"
#
#RUN test -f jupyterlab_mdx/labextension/static/index.js \
#  && echo "✅ static/index.js found"


## 5) Build the Python wheel — this step respects the shared-data config in pyproject.toml
## 🛠️ Build wheel from this package (includes labextension via shared-data)
#RUN echo "🛠️ Building wheel using hatch..." \
#    && /venv/bin/hatch build \
#    && ls -lh dist/ \
#    && test -f dist/*.whl \
#    && echo "✅ Wheel created."


# ─────────── STAGE 2: runtime image ───────────
FROM python:3.11-slim

# 6) Install just what we need at runtime:
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

# Copy the venv from the build stage to the same path it lived there
COPY --chown=jovyan:jovyan --from=build-node /home/jovyan/.venv /home/jovyan/.venv

# Make sure python/jupyter come from that venv
ENV PATH="/home/jovyan/.venv/bin:${PATH}"

# 7) Copy only the built artifacts and the Python venv from build-node
#COPY --chown=jovyan:jovyan --from=build-node /home/jovyan/jupyterlab-mdx/ ./
#COPY --chown=jovyan:jovyan --from=build-node /venv /venv

# 8) Prepend /venv/bin so "python" and "jupyter" point to the venv’s executables

#ENV PATH="/venv/bin:${PATH}"

# 9) Install the built wheel into the runtime Python env
COPY --chown=jovyan:jovyan --from=build-node /home/jovyan/jupyterlab-mdx/dist/*.whl ./

RUN echo "📦 Installing wheel in final container..." \
    && pip install jupyterlab_mdx-*.whl \
    && echo "✅ Wheel installed."

# 10) Confirm labextension is registered and placed in Jupyter's extension dir
RUN echo "🔍 Checking JupyterLab extensions..." \
    && jupyter labextension list \
    || (echo "❌ Extension not registered!" && exit 1)

RUN echo "📂 Verifying final labextension placement..." \
    && ls -l /venv/share/jupyter/labextensions/jupyterlab-mdx \
    && test -f /venv/share/jupyter/labextensions/jupyterlab-mdx/install.json \
    && echo "✅ install.json present." \
    && test -f /venv/share/jupyter/labextensions/jupyterlab-mdx/static/index.js \
    && echo "✅ JS bundle present."

# 11) Expose JupyterLab’s port
EXPOSE 8888

# 12) Default command: launch JupyterLab (no browser, no token)
CMD ["jupyter", "lab", "--ip=0.0.0.0", "--no-browser", "--ServerApp.token=''", "--NotebookApp.notebook_dir=/home/jovyan/repo"]