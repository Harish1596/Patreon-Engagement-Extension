const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');
const source = fs.readFileSync(path.resolve(__dirname, '../../extension/content/patreon-dom.js'), 'utf8');

for (const card of [true, false]) {
  for (const layout of ['fullPost', 'singleColumn']) {
    test(`${layout} surface includes header, body and comments with post-card ${card}`, () => {
      const dom = new JSDOM(`<main ${card ? 'data-tag="post-card"' : ''}>
        <div id="outer" class="Changed_${layout}ContentWrapper"><div class="Changed_${layout}Content">
          <div data-testid="${layout === 'fullPost' ? 'full' : 'single-column'}-post-wrapper">
            <h1 data-tag="post-title">Example</h1><div data-tag="top-engagement"><button data-tag="like-button">Like</button></div>
            <div class="Changed_postContent"><div class="Changed_additionalStylesPostContentWrapper">Body</div></div>
            <div data-tag="content-card-comment-thread-container">Comment</div>
          </div>
        </div></div>
      </main>`, { runScripts: 'outside-only' });
      try {
        dom.window.eval(source);
        const doc = dom.window.document;
        const surface = dom.window.PatreonDOM.surfaceFor(doc.querySelector('button'), doc.querySelector('[data-testid]'));
        assert.equal(surface.id, 'outer');
        assert.ok(surface.contains(doc.querySelector('[data-tag="post-title"]')));
        assert.ok(surface.contains(doc.querySelector('[data-tag="content-card-comment-thread-container"]')));
      } finally { dom.window.close(); }
    });
  }
}

test('full-post semantic wrapper remains a fallback without class hooks', () => {
  const dom = new JSDOM('<main data-tag="post-card"><div id="post" data-testid="full-post-wrapper"><button>Like</button></div></main>', { runScripts: 'outside-only' });
  try {
    dom.window.eval(source);
    const doc = dom.window.document;
    assert.equal(dom.window.PatreonDOM.surfaceFor(doc.querySelector('button'), doc.querySelector('main')).id, 'post');
  } finally { dom.window.close(); }
});
