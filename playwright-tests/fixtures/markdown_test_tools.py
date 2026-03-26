import uuid


import hashlib

def md_cell(source: str):

    # Generate cell IDs deterministically from the cell source.
    # This keeps fixture IDs stable across regeneration unless the
    # cell source itself changes. It also avoids IDs that depend on
    # fixture-generation order, which would happen if a shared seeded
    # random number generator were used.
    cell_id = hashlib.sha256(source.encode("utf-8")).hexdigest()[:8]
    return {
        "cell_type": "markdown",
        "id": cell_id,
        "metadata": {},
        "source": source.splitlines(keepends=True),
    }

def notebook(cells):
    return {
        "cells": cells,
        "metadata": {
            "kernelspec": {
                "display_name": "Python 3",
                "language": "python",
                "name": "python3"
            },
            "language_info": {
                "name": "python",
                "version": "3.11"
            }
        },
        "nbformat": 4,
        "nbformat_minor": 5
    }
