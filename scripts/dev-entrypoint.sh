#!/bin/bash
# dev-entrypoint.sh — startup script for the development container.
#
# Installs the extension in editable mode from the mounted source tree,
# then creates a symlink so JupyterLab serves JS files directly from the
# local build output.  After this, `npm run build` on the host followed
# by a browser reload is the entire dev iteration cycle.
set -e

SRC=/home/jovyan/repo/jupyterlab-mdx
LABEXT_SRC=$SRC/jupyterlab_mdx/labextension/jupyterlab-mdx
LABEXT_DST=/home/jovyan/.venv/share/jupyter/labextensions/jupyterlab-mdx

echo "--- Installing extension in editable mode ---"
pip install -e "$SRC"

echo "--- Linking labextension to local build output ---"
mkdir -p "$(dirname "$LABEXT_DST")"
# Remove whatever pip put there (directory or old symlink) and replace
# it with a symlink to the local build output.
rm -rf "$LABEXT_DST"
ln -s "$LABEXT_SRC" "$LABEXT_DST"
echo "Symlink: $LABEXT_DST -> $LABEXT_SRC"

echo "--- Starting JupyterLab ---"
exec jupyter lab \
    --ip=0.0.0.0 \
    --no-browser \
    --ServerApp.token='' \
    --NotebookApp.notebook_dir=/home/jovyan/repo/jupyterlab-mdx
