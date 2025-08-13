# jupyterlab_mdx

[![Github Actions Status](https://github.com/dosirrah/jupyterlab-mdx/workflows/Build/badge.svg)](https://github.com/dosirrah/jupyterlab-mdx/actions/workflows/build.yml)[![Binder](https://mybinder.org/badge_logo.svg)](https://mybinder.org/v2/gh/dosirrah/jupyterlab-mdx/main?urlpath=lab)
Markdown extensions with support for cross-references

## Requirements

- JupyterLab >= 4.0.0

## Install

To install the extension, execute:

```bash
pip install jupyterlab_mdx
```

## Uninstall

To remove the extension, execute:

```bash
pip uninstall jupyterlab_mdx
```

## Contributing

### Development install

    % yarn install
    % docker-compose build jupyter
    % docker-compose up -d jupyter

HERE

Note: You will need NodeJS to build the extension package.

The `jlpm` command is JupyterLab's pinned version of
[yarn](https://yarnpkg.com/) that is installed with JupyterLab. You may use
`yarn` or `npm` in lieu of `jlpm` below.

```bash
# Clone the repo to your local environment
# Change directory to the jupyterlab_mdx directory
# Install package in development mode
pip install -e "."
# Link your development version of the extension with JupyterLab
jupyter labextension develop . --overwrite
# Rebuild extension Typescript source after making changes
jlpm build
```

You can watch the source directory and run JupyterLab at the same time in different terminals to watch for changes in the extension's source and automatically rebuild the extension.

```bash
# Watch the source directory in one terminal, automatically rebuilding when needed
jlpm watch
# Run JupyterLab in another terminal
jupyter lab
```

With the watch command running, every saved change will immediately be built locally and available in your running JupyterLab. Refresh JupyterLab to load the change in your browser (you may need to wait several seconds for the extension to be rebuilt).

By default, the `jlpm build` command generates the source maps for this extension to make it easier to debug using the browser dev tools. To also generate source maps for the JupyterLab core extensions, you can run the following command:

```bash
jupyter lab build --minimize=False
```

### Development uninstall

```bash
pip uninstall jupyterlab_mdx
```

In development mode, you will also need to remove the symlink created by `jupyter labextension develop`
command. To find its location, you can run `jupyter labextension list` to figure out where the `labextensions`
folder is located. Then you can remove the symlink named `jupyterlab-mdx` within that folder.

### Testing the extension

#### Frontend tests

This extension is using [Jest](https://jestjs.io/) for JavaScript code testing.

To execute them, execute:

```sh
jlpm
jlpm test
```

#### Integration tests

This extension uses [Playwright](https://playwright.dev/docs/intro/) for the integration tests (aka user level tests).
More precisely, the JupyterLab helper [Galata](https://github.com/jupyterlab/jupyterlab/tree/master/galata) is used to handle testing the extension in JupyterLab.

More information are provided within the [ui-tests](./ui-tests/README.md) README.

### Future

Add hierarchical enumerations.  @foo/bar would be a named enumeration foo
with the number assigned to @foo followed by period and 
a number assigned to bar within the namespace of foo. For example,

"""
    # @foo About Foo.

    ## @foo/intro Introduction

    ## @foo/related Related Work
"""

woudl appear as 

"""
   1. About Foo     // formatted as title.
   
   1.1 Introduction  // formatted as section.

   1.2 Related Work  // formatted as section.
""" 


### Packaging the extension

See [RELEASE](RELEASE.md)
