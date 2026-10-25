# Patreon text-and-image post baseline

Recorded: October 25, 2026. Extension implementation reviewed: 1.2.2, commit
`89eff4b`. This is the working reference for future changes to a text post with
inline images. Other post types can be documented separately after this baseline.

Implementation update (1.3.0): the Reader panel now has one **Post Color** preset
instead of independent text/background choices. Each preset derives matched
text, surface, and action colors; internal CSS variables remain separate to style
those elements. Saved legacy backgrounds select the nearest preset and legacy
text overrides are discarded. References below to separate choices describe the
1.2.2 capture, not the current controls.

Implementation update (1.3.2): comment-action groups within the reading surface
now use the preset foreground and interaction palette for Like, Reply, and More,
including nested SVGs and counts. Earlier notes about preserving native comment
action colors describe the captured 1.2.2 implementation. Comment-entry forms and
unrelated controls still retain native styling.

## Evidence and limits

The baseline combines three kinds of evidence:

- **Observed HTML:** The user's full rendered-page HTML for
  [the example public post](https://www.patreon.com/FicticiousChaos/posts/update-oct-3rd-171363919).
  It was parsed offline with website scripts disabled and network requests
  blocked. SHA-256 of the original attachment:
  `42c2514d5937e444dcc6c3fff2562913bb9096d76f7c5861782cdc0d3917990e`.
- **Observed screenshots:** Seven desktop Chrome screenshots of that same post,
  captured on macOS between 13:58:37 and 13:59:48 on October 25, 2026. They show
  a dark page at successive scroll positions, with Join/Log in controls.
- **Code-backed behavior:** The extension source linked throughout this document.
  Intended behavior and test coverage are distinguished from live observations.

These are separate captures, not a synchronized recording. The HTML has active
Sepia Reader variables and an injected Aa button. The screenshots look native/dark
and do not show Aa in the top action row. Their extension settings and installed
version are not established; this difference is not evidence of a failure.

Original HTML and screenshots are not copied into the repository. The HTML
contains serialized application data and signed media URLs; the screenshots
contain third-party artwork and comments. Structural summaries below preserve
the useful architectural knowledge without those payloads.

### Screenshot index

The source names are `Screenshot 2026-10-25 at <time>.png`.

| Time | Region and visual facts |
| --- | --- |
| 13.58.37 | Left application rail, creator navigation, large title, creator avatar/byline/date, Like/Comment/Share actions, paragraphs and links, start of the image. |
| 13.58.44 | Centered inline image, narrower than the text column; floating engagement pill near the bottom of the viewport. Creator navigation remains at the top. |
| 13.58.52 | End of image, subsequent prose and attribution, collection heading/card, floating engagement pill. |
| 13.58.55 | Collection card, membership banner with its own surface and Join button, comments heading/sort control, comment entry field, start of a thread. |
| 13.58.59 | Parent comment, indented author reply with badge, connecting thread lines, comment actions, and a View replies link. |
| 13.59.39 | End of the thread, Popular posts carousel and its separate surface; an upward-arrow control is visible near the right of the post. |
| 13.59.48 | Popular-post cards, lock badges, dates/counts, carousel arrows, and site footer. |

The creator navigation and left rail appear to remain in place across scroll
positions. This is visual evidence of persistent navigation, not a measurement
of their CSS `position` values. The upward arrow suggests a return-to-top
control; its click behavior was not exercised. Small screenshot-preview overlays
in some captures are not treated as Patreon components.

## Page regions and ownership

```text
Page shell
├── Application navigation / left rail
├── Creator navigation (responsive and persistent variants)
├── Main post card [data-tag="post-card"]
│   ├── PostBodies … singleColumnContentWrapper   ← Reader background surface
│   │   └── PostBodies … singleColumnContent
│   │       └── [data-testid="single-column-post-wrapper"]
│   │           ├── Responsive title, creator byline, and date
│   │           ├── Responsive top engagement rows
│   │           ├── PostContent → RichText
│   │           │   ├── Paragraphs and links
│   │           │   ├── Inline image block
│   │           │   └── Further prose and attribution
│   │           ├── Collection link/card
│   │           ├── Membership banner
│   │           └── Comment thread and entry field
│   └── Floating engagement sheet                  ← outside Reader surface
├── Popular / related posts                       ← outside main post card
└── Site footer
```

Intermediate layout and token-override divs are omitted. Visual alignment does
not mean components share the same styling boundary: the floating bar belongs
to the main card but sits outside the Reader background surface. Popular-post
cards and creator navigation sit outside both that surface and the main card.

### Cardinality in the HTML capture

| Item | Count | Interpretation |
| --- | --- | --- |
| Main `post-card` | 1 | A main-post container, not a reason to exclude its descendants. |
| `post-title` | 2 | Desktop/mobile copies of the same title. |
| `top-engagement` | 2 | Responsive action-row variants. |
| Rich-text post body | 1 | The article's content, distinct from comments. |
| Injected Reader button / marked action row / marked surface | 1 each | Extension-owned state in this capture. |
| `like-button` | 5 | Two top variants, two comment likes, one floating-bar like. |
| Rendered comment rows | 2 | Not the same as the displayed total comment count. |
| Floating engagement sheet | 1 | Independently controlled by the extension. |
| Related `creator-home-horizontal-card` | 12 | Carousel DOM count, not the number simultaneously visible. |

The screenshots show a count of five comments and a View replies link. A counter
must not be interpreted as the number of currently rendered rows: replies can
be nested, collapsed, or loaded later. Related cards have their own component
hook in this capture; they should not be classified solely by title-like text.

## Text and image content model

The observed rich-text body contains five paragraphs, four links, one image,
and line breaks. It has no semantic headings, lists, or iframe embeds inside
the article body. Links include both Patreon destinations and external sites.
The image occurs between the introductory link paragraphs and subsequent prose.

Representative markup below is schematic; names, text, links, and media are
placeholders, and intermediate wrappers are simplified:

```html
<div class="PostBodies-module__HASH__postContent">
  <div class="TokenOverrides-module__HASH__tokensPostPage">
    <div class="RichText-module__HASH__root RichText-module__HASH__additionalStylesPostContentWrapper">
      <p>Introductory text<br><a href="/example/posts/example-123">Post link</a></p>
      <p><a href="https://example.org/community">Community link</a></p>
      <p><a href="/collection/123">Collection link</a></p>
      <p><a href="https://example.org/map">External resource</a></p>
      <div data-image-container="true" data-alignment="center">
        <figure>
          <div class="ImageWithChip-module__HASH__imageWrapper BlockImage-module__HASH__imageWrapperZoomIn">
            <img src="IMAGE_URL_OMITTED" data-media-id="MEDIA_ID_OMITTED"
                 loading="lazy" decoding="async">
          </div>
        </figure>
      </div>
      <p>Further prose<br><br>Attribution</p>
    </div>
  </div>
</div>
```

The quote-like passage and attribution are paragraph/line-break content here;
their appearance does not establish a semantic `blockquote` or image caption.
Headings, lists, and quotations are exercised in synthetic tests, but their
native Patreon markup is not established by this particular article.

Image boundaries matter for future changes:

- The image is part of RichText, not a separate post type or the creator avatar.
- The screenshots show it centered and inset from the text column's edges. No
  fixed pixel widths or zoom level are established by these captures.
- The source uses a media wrapper, `figure`, media identifier, lazy loading, and
  asynchronous decoding. A zoom-related class exists; zoom interaction is unverified.
- Keep media sizing, aspect ratio, loading attributes, wrappers, and click
  behavior intact when changing text presentation. Do not apply blanket filters
  or foreground/background changes to every descendant of RichText.
- Media identifiers and signed image URL parameters are content-specific. They
  are not selectors or reusable fixture data.

## Selector map

These are observed internal hooks, not a public compatibility contract. Semantic
attributes are preferable to build hashes, but Patreon can change either.

| Region | Hook / pattern | How to use it |
| --- | --- | --- |
| Main card | `[data-tag="post-card"]` | Keep title, body, and actions within the same card. |
| Title | `[data-tag="post-title"]` | Prefer an eligible h1 when detecting the main post; allow responsive copies. |
| Outer surface | `[class*="PostBodies-module__"][class*="__singleColumnContentWrapper"]` | Preferred full post-background target, including outer spacing. |
| Inner column | `[class*="PostBodies-module__"][class*="__singleColumnContent"]` | Fallback/inner surface; its substring also matches the outer wrapper. |
| Inner post | `[data-testid="single-column-post-wrapper"]` | Useful inner anchor; not the outermost background boundary. |
| Article body | PostContent → RichText pattern shown below | Scope typography and article text here. |
| Post actions | `[data-tag="top-engagement"]` | Select the visible variant associated with the main title/card. |
| Native actions | `like-button`, `comment-post-icon`, `share-post-icon` | Match exact `data-tag` attributes within the selected row. |
| Image block | `[data-image-container="true"]` under RichText | Distinguish inline media from avatars and thumbnails. |
| Collection area | `[data-tag="post-collections"]` | Inside background surface, outside article typography. |
| Membership banner | `[data-testid="cta-banner-wrapper"]` | Own card/button surfaces; do not infer its styles from surrounding paragraphs. |
| Comment thread | `[data-tag="content-card-comment-thread-container"]` | Inside background surface; excluded from article detection/typography. |
| Comments | `comment-row`, `comment-body`, `comment-actions`, `comment-more-actions` | Separate text, interaction controls, and nested replies. |
| Entry field | `[data-tag="comment-field"]` | An interactive control, not an article paragraph. |
| Floating bar | `div[data-tag="floating-engagement-sheet"]` | Independent visibility feature; never an insertion point for Reader. |
| Related posts | `creator-home-horizontal-section`, `creator-home-horizontal-card` | Separate carousel, outside Reader's current surface. |
| Navigation | `main-app-navigation`, `creator-sticky-nav` | Separate page chrome, outside Reader's current surface. |

Current article-body selector in [reader.js](../reader.js):

```css
[class*="PostBodies-module__"][class*="__postContent"]
  [class*="RichText-module__"][class*="additionalStylesPostContentWrapper"]
```

Do not hard-code hashes such as `JRIMpq`, transient IDs such as `_r_…`, action
counts, post IDs, exact article text, or a fixed number of ancestors. Explicitly
prefer `singleColumnContentWrapper` before the inner-column substring selector;
`closest()` otherwise finds the nearer inner column despite the shared prefix.

Repost and main-post More controls are absent from this sample's top row. The
implementation supports them if supplied, but does not invent missing native
actions. Main-post More must not be confused with `comment-more-actions`.

## Responsive and scrolling behavior

**Observed:** Desktop/mobile variants coexist in the HTML. Generated classes
contain `shownBreakpointSm` and `hiddenBreakpointSm`. The seven screenshots show
desktop layout only; they do not establish the mobile breakpoint or layout.

**Code-backed:** `findPost()` prefers an eligible title, ignores comment/floating
regions, searches inside that title's card, and chooses a visible Like button,
preferring one in `top-engagement`. Duplicate titles do not block reaching the
shared body. Reader is inserted immediately before Like. The chosen action row
is reevaluated on resize, and rerenders must not leave duplicate buttons.

**Observed:** The floating engagement pill appears near the viewport bottom in
the image/body screenshots and is absent from other screenshots. Its positioning
and conditional display are separate from the top row. No exact activation
threshold, scroll direction rule, or animation behavior has been measured.

## Reader integration and styling boundaries

| Concern | Current implementation boundary |
| --- | --- |
| Master enablement | Extension toolbar popup; not the in-page Reader panel. |
| Article typography | Marked title/body; title size is 1.5× an explicit body size. |
| Background | Marked outer wrapper plus known inner surfaces/body. |
| Metadata and comment foreground | Matching surface ink on selected text elements; not article font/spacing. |
| Main post actions | Marked top action row; known Reader/native controls only. |
| Membership controls, comment actions, forms | Retain native control styling; not covered by the main-action palette. |
| Images/media | Preserve native media presentation and behavior. |
| Navigation, popular posts, footer | Outside the Reader background boundary. |
| Floating engagement | Separate hide/show preference and root attribute. |

Extension-owned markers:

| Marker | Meaning |
| --- | --- |
| `data-patreon-reader-surface` | The selected outer background boundary. |
| `data-patreon-reader-title` / `data-patreon-reader-body` | Typography targets. |
| `data-patreon-reader-actions` | Selected main-post action row. |
| `data-patreon-reader-button` | Extension-created Aa button; does not have a native `data-tag`. |
| `data-patreon-reader-panel` | Host for the Shadow DOM appearance panel. |
| Root `data-patreon-reader-*` flags and `--patreon-reader-*` properties | Enable individual overrides and supply validated values. |
| Root `data-hide-patreon-floating-engagement` | Activates the independent floating-bar hiding rule. |

The native root has `data-token-color-mode="auto"`, with further automatic-theme
containers. This alone does not reveal the effective dark/light theme. The HTML
capture's Reader background is Sepia (`#f4ecd8`), with effective brown text and
surface ink (`#5b4636`). No Reader font/size/spacing override flags are active.
Effective brown does not distinguish Auto from an explicit Brown selection.

In 1.2.2, [content.css](../content.css) themes main-row icons, descendant wrappers,
counts, borders, hover, focus, selected/pressed, and disabled states using a
background-dependent palette. This palette is independent of reading-text color.
SVG `currentColor` follows the corrected foreground. Native handlers and aria
state remain Patreon's responsibility. Other controls inside the full background
wrapper remain separate components; background containment is not permission to
apply every article style to them.

The panel lives in Shadow DOM to isolate its UI styles. Ordinary `outerHTML`
does not capture its controls or styles; the empty panel host in the HTML is
expected. The captured Aa button has `aria-expanded="false"`.

## Runtime and settings ownership

| File | Responsibility |
| --- | --- |
| [manifest.json](../manifest.json) | Patreon match scope, packaged CSS, ordered scripts, storage permission. |
| [extension.js](../extension.js) | Browser API adapter, validated preference schema, fixed fonts/presets, contrast and legacy-color normalization. |
| [content.js](../content.js) | Supported-route detection, storage events, popup state messages, floating-bar visibility, batched reconciliation. |
| [reader.js](../reader.js) | Post detection, markers, surface selection, Aa/panel lifecycle, controls, serialized saves. |
| [content.css](../content.css) | Page-side typography, surfaces, action contrast, floating-bar hiding. |
| [popup.js](../popup.js) | Load/save master preferences and show page-connection status. |

The manifest loads `extension.js`, `reader.js`, and `content.js` at document
start. Post recognition currently accepts creator-prefixed routes shaped like
`/<creator>/posts/<slug>-<numeric-id>` (or a numeric ID without a slug), excluding
reserved first-path segments. Recognition is not evidence of DOM readiness.
Nonmatching routes do not receive Reader UI/styles.

Stored keys are `isHidden`, `readerEnabled`, and `readerPreferences`. Preferences
are global within a browser profile and stored locally. Disabling Reader removes
UI, markers, and overrides while retaining appearance choices. Reset replaces
appearance overrides with defaults while preserving both master toggles. Font
choices reference installed fonts through fixed CSS stacks; no enumeration or
font downloads are performed. See [README.md](../README.md) for current controls.

Startup and storage changes configure/reconcile Reader. Child-list/subtree DOM
changes are batched with `requestAnimationFrame`; popstate, resize, and the
Navigation API (when available) also trigger reconciliation. Unsupported routes,
route changes, missing target structure, and disablement trigger cleanup.
The observer does not watch every attribute-only or character-data change, and
there is no universal interception of every History API call. Do not claim
arbitrary Patreon state transitions are covered solely because an observer exists.

## Using this baseline for future changes

1. Identify the owning region and whether it is article content, surrounding post
   UI, or page chrome. Use the hierarchy before choosing a selector.
2. Determine the change boundary: body/title, full background surface, main
   actions, comment interactions, media, or navigation. Keep unrelated regions
   outside that change unless intentionally included in the feature.
3. Account for responsive duplicates, nested controls, and late-rendered content.
   A global first Like button or a uniqueness assumption about titles is unsafe.
4. Preserve anchors, image wrappers/loading, native action state/handlers,
   comment-entry semantics, and independent overlay/navigation behavior.
5. Update the relevant preference/markup/CSS owner above and add proportionate
   verification for the intended behavior, including reset and cleanup.
6. Record new observations separately from assumptions, and update this document
   when a supported Patreon layout actually changes.

Existing [fixture tests](../tests/reader.spec.js) and the
[installed-extension test](../tests/installed.spec.js) cover synthetic text/media,
card/outer-wrapper boundaries, responsive variants, action contrast, settings,
and lifecycle behavior. They do not replay this complete captured website.
See [TESTING.md](../TESTING.md) for the recorded browser results and validation
limits; this documentation change does not constitute new runtime validation.

## Not yet established

- Exact computed CSS, dimensions, breakpoint values, zoom, and image-zoom behavior.
- Signed-in layouts or interactions requiring authentication; the screenshots
  show login/join affordances, not an inspected authentication session.
- Expanded replies, comment submission, action menus, sorting, carousel clicks,
  and the upward-arrow control's event behavior.
- Other creators, multiple inline images, native lists/headings/quotes, galleries,
  dedicated video/audio posts, and locked full-post layouts. Locked recommendation
  cards visible here are not evidence of a locked post's full layout.
- Complete live-site or browser compatibility from these captures. Mobile visuals,
  Firefox/Safari Reader behavior, and arbitrary future Patreon updates remain
  separate validation work.

No extra capture is required to use this text-and-image baseline. Extend its
evidence when the next feature or post variation actually needs it.
