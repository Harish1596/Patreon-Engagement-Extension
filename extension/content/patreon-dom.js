/* Patreon-specific DOM hooks and discovery; no settings or panel state. */
(() => {
  const TITLE = '[data-tag="post-title"]';
  const BODY = '[class*="PostBodies-module__"][class*="__postContent"] [class*="RichText-module__"][class*="additionalStylesPostContentWrapper"]';
  const CARD = '[data-tag="post-card"]';
  const EXCLUDE = '[data-tag="floating-engagement-sheet"], [data-tag="comment"], [data-tag="comments"], [data-tag="comment-row"], [data-tag="comment-actions"], [data-tag="content-card-comment-thread-container"]';

  function visible(node) {
    return node.getClientRects().length > 0 && getComputedStyle(node).visibility !== "hidden";
  }

  function findPost() {
    const titles = [...document.querySelectorAll(TITLE)].filter((node) => !node.closest(EXCLUDE));
    // Patreon uses post-card for the actual post as well as previews. Prefer
    // the page's h1, then keep all searches inside that title's own card.
    const headings = titles.filter((node) => node.matches("h1") || node.querySelector("h1"));
    const candidates = headings.length ? headings : titles.filter((node) => !node.closest(CARD));
    for (const title of candidates.filter(visible)) {
      const card = title.closest(CARD);
      const belongs = (node) => !node.closest(EXCLUDE) && node.closest(CARD) === card;
      const boundary = card ?? title.closest("main");
      for (let parent = title.parentElement; parent && parent !== document.body && parent !== document.documentElement; parent = parent.parentElement) {
        const likes = [...parent.querySelectorAll('[data-tag="like-button"]')].filter((node) => belongs(node) && visible(node));
        const like = likes.find((node) => node.closest('[data-tag="top-engagement"]')) ?? likes[0];
        if (like) {
          let scope = parent;
          // Responsive title copies may share the body at a higher ancestor.
          // Their count must not prevent reaching that body.
          while (scope !== boundary && ![...scope.querySelectorAll(BODY)].some(belongs)
            && scope.parentElement && scope.parentElement !== document.body) scope = scope.parentElement;
          return { scope, like, belongs };
        }
        if (parent === boundary) break;
      }
    }
    return null;
  }

  function surfaceFor(like, scope) {
    // Prefer the outer wrapper before its shared-prefix inner column.
    return like.closest('[class*="PostBodies-module__"][class*="__singleColumnContentWrapper"]')
      ?? like.closest('[class*="PostBodies-module__"][class*="__singleColumnContent"]')
      ?? like.closest('[data-testid="single-column-post-wrapper"]') ?? like.closest(CARD) ?? scope;
  }

  function actionRowFor(like) {
    return like.closest('[data-tag="top-engagement"]') ?? like.parentElement;
  }

  globalThis.PatreonDOM = Object.freeze({ TITLE, BODY, findPost, surfaceFor, actionRowFor });
})();
