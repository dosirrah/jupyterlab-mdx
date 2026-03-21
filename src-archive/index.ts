import { JupyterFrontEnd, JupyterFrontEndPlugin } from '@jupyterlab/application';

const plugin: JupyterFrontEndPlugin<void> = {
  id: 'jupyterlab-mdx',
  autoStart: true,
  activate: (app: JupyterFrontEnd) => {
    console.log('MDX LOAD OK');
  }
};

export default plugin;
