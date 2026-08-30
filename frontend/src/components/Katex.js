import React from 'react';
import katex from 'katex';

export function Katex({ tex, display = false }) {
  let html = '';
  try {
    html = katex.renderToString(tex || '', { displayMode: display, throwOnError: false });
  } catch (e) {
    html = tex;
  }
  return <span data-testid="katex" dangerouslySetInnerHTML={{ __html: html }} />;
}

export default Katex;
