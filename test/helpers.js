import React from 'react';
import ReactDOM from 'react-dom';

import { bigtestGlobals } from 'bigtest';

export function Mount(name, element) {
  return {
    description(`Mount Component ${element.type}`),
    action: async () => new Promise(resolve => {
      ReactDOM.render(element, getCleanTestingRoot(), resolve);
    })
  };
}

function getCleanTestingRoot() {
  let $root = document.getElementById('root');

  // if a root exists, unmount anything inside and remove it
  if ($root) {
    ReactDOM.unmountComponentAtNode($root);
    $root.parentNode.removeChild($root);
  }

  // create a brand new root element
  $root = document.createElement('div');
  $root.id = 'root';

  document.body.appendChild($root);

  return $root;
}
