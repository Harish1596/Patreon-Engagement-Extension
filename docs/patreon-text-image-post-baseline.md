# Patreon post-page reference: text posts with inline images

Last maintained: November 3, 2026. Current hotfix: **1.1.1** (live confirmation pending).
Post export is an unreleased development feature with synthetic verification;
live Patreon export verification is pending.
Feature baseline: **1.1.0**, renumbered from
the local **1.3.9** development series without changing behavior or preferences.
Historical 1.3.x references below retain their original checkpoint numbers.
The user confirms completed testing at that checkpoint, including live Patreon
and the latest 1.1.0 changes, applies to release **1.1.0**, not the subsequent
1.1.1 hotfix. Earlier labels describe development
checkpoints for that release, not separate published versions.
The user reports Chrome Web Store version **1.0.0** and a dashboard upload of
**1.1.0**; approval/publication was not confirmed. The temporary local 1.2.0
release number is superseded.
DOM ownership commit `c9a2c84`; later 1.3.9 refinements include swatch ordering
and the creator-avatar separation rule documented below.
Original HTML baseline: **1.2.2**, commit `89eff4b`.
The filename is retained so existing links continue to work.

Repository-layout update: runtime files now live under `extension/`, grouped into
`shared/`, `content/`, `popup/`, and `icons/`. Runtime links below reflect these new
locations; the 1.3.9 behavior and historical evidence are unchanged. Test HTML and
API/control setup were extracted to `tests/fixtures/` and `tests/helpers/`.
Load `extension/` as the unpacked source directory, not the repository root.

This is the canonical repository reference for the common text-and-image post
page. It consolidates the supplied HTML/screenshots, current extension behavior,
known CSS interactions, and a procedure for detecting future Patreon UI changes.
It is not a complete specification of all Patreon post types or a promise that
the current live site is identical to the capture. Page content, counts, generated
IDs, and signed URLs are not an integration API.

[AGENTS.md](../AGENTS.md) directs future coding sessions in this repository to
read this reference before page-integration work and maintain it as new evidence
is established. A chat without this repository must be given this document or
access to it; conversation memory alone is not the persistence mechanism.

## Start here

- [Evidence and limits](#evidence-and-limits): what was actually supplied/verified.
- [Page regions and ownership](#page-regions-and-ownership): DOM boundaries.
- [Selector map](#selector-map): internal hooks and safe scoping.
- [Component details and CSS pitfalls](#component-details-and-css-pitfalls): native markup and failure modes.
- [Current settings and color contract](#current-settings-and-color-contract): exact preferences/palettes.
- [Runtime and settings ownership](#runtime-and-settings-ownership): code and lifecycle.
- [Post export boundary](#post-export-boundary-unreleased): local formats, media access, and evidence limits.
- [Collection export boundary](#collection-export-boundary-unreleased): separate-file ZIP behavior and evidence limits.
- [UI-change comparison procedure](#ui-change-comparison-procedure): how to update this reference.
- [Captured hook inventory](#captured-hook-inventory): all observed data-tag/testid values and counts.
- [Not yet established](#not-yet-established): gaps that must not be assumed away.

## Evidence and limits

The reference combines the following evidence:

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
- **Later user reports/screenshots:** 14:25:21 shows parent-comment text, author
  names, and comment actions retaining white on a light surface; 15:02:00 shows
  Sepia banner text on a native dark card; 15:09:17 shows the corrected banner
  background, weak card separation, and the native comment-entry surface.
  Later user messages confirm banner background/shadow changes worked and ask
  for a darker input surface. These are scoped confirmations, not full-site QA.
- **Collection-page structure:** An October 31, 2026 screenshot and two sanitized
  structural captures show `/collection/{numeric-id}?view=expanded`, a
  `main[role="main"]` region, a collection heading, 74 displayed posts, 20
  initially rendered `a[class*="_gridCard"]` elements, direct
  `/posts/{numeric-id}?collection={numeric-id}` destinations, and a
  `[class*="_loadMoreContainer"] button`. The sanitized payloads are not committed.
- **Collection pagination response:** A later October 31 user-supplied request and
  response establish a same-origin `/api/posts` query filtered by campaign and
  collection, ordered by `collection_order`. Its page contains 20 post resources;
  `meta.pagination.total` reports 74 and `meta.pagination.cursors.next` supplies
  the next cursor. The raw response, IDs, cursor, and post/media content are not
  committed.
- **Live collection access flags, November 1, 2026:** Read-only inspection of the
  user's signed-in Brave collection session found 75 posts across four API pages,
  with `attributes.current_user_can_view` true for 74 and false for one. The
  updated discovery function returned 74 preparation URLs and one locked skip.
  This establishes access filtering on that session, not complete installed
  export behavior after reload; no raw response or post content is retained here.
- **User-confirmed live testing:** On October 25, 2026, the user confirmed live
  Patreon testing was completed for the entire recorded testing history. This
  broader manual confirmation supersedes earlier live-testing-pending notes;
  individual execution dates, browser/OS versions, and scenarios were not itemized.
- **Isolated snapshot checks:** The supplied full HTML and its linked public CSS
  were used with website scripts removed and browser network requests blocked
  to verify the comment SVG-fill and comment-field fixes. A native disabled-field
  opacity of 0.6 was measured in that setup. These checks are not live sessions.

Browser context reported by the user: Google Chrome 156.0.8078.48, arm64, macOS.
The earlier 1.1.0 extension report belongs to the initial missing-Aa investigation;
do not assign that installed version to all subsequent screenshots. Post title
and displayed publication date differ in the capture; retain them as separate
fields rather than deriving one from the other. No precise timezone was established
for Patreon's displayed publication date.

These are separate captures, not a synchronized recording. The HTML has active
Sepia Reader variables and an injected Aa button. The original seven screenshots look native/dark
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
| Outer surface | `[class*="_singleColumnContentWrapper"]` | Preferred full post-background target, including outer spacing; supports historical readable and current generated prefixes. |
| Inner column | `[class*="_singleColumnContent"]` | Fallback/inner surface; its substring also matches the outer wrapper. |
| Inner post | `[data-testid="single-column-post-wrapper"]` | Useful inner anchor; not the outermost background boundary. |
| Article body | PostContent → RichText pattern shown below | Scope typography and article text here. |
| Post actions | `[data-tag="top-engagement"]` | Select the visible variant associated with the main title/card. |
| Native actions | `like-button`, `comment-post-icon`, `reshare-button`, `share-post-icon`, `more-actions-button` | Match exact `data-tag` attributes within the selected row; Repost/More are code-supported, not present in this captured top row. |
| Image block | `[data-image-container="true"]` under RichText | Distinguish inline media from avatars and thumbnails. |
| Collection area | `[data-tag="post-collections"]` | Inside background surface, outside article typography. |
| Membership banner | `[data-testid="cta-banner-wrapper"]` → `[class*="CTABanner-module__"][class*="__root"]` | Theme the inner card as well as its text; preserve Join controls and media. |
| Comment thread | `[data-tag="content-card-comment-thread-container"]` | Inside background surface; excluded from article detection/typography. |
| Comments | `comment-row`, `comment-body`, `comment-actions`, `comment-more-actions` | Separate text, interaction controls, and nested replies. |
| Entry field | `comment-field-box` → `comment-field-with-affixes` → `comment-field` | Background/border wrappers and textarea have separate native styles. |
| Logged-out entry | `[data-tag="login-field"]` | Login anchor around a disabled textarea; styling must not enable editing or break navigation. |
| Author name | `[data-tag="commenter-name"]` | A button with nested text, not plain metadata. |
| Comment sort | Button `role="combobox"` with `aria-haspopup="listbox"`, `IconSortingArrow` SVG | Observed outside `comment-actions`; no dedicated Reader theme rule as of 1.3.9. |
| Floating bar | `div[data-tag="floating-engagement-sheet"]` | Independent visibility feature; never an insertion point for Reader. |
| Related posts | `creator-home-horizontal-section`, `creator-home-horizontal-card` | Separate carousel, outside Reader's current surface. |
| Navigation | `main-app-navigation`, `creator-sticky-nav` | Separate page chrome, outside Reader's current surface. |

Current article-body selector in [patreon-dom.js](../extension/content/patreon-dom.js):

```css
[class*="_postContent"] [class*="_additionalStylesPostContentWrapper"]
```

The original capture used readable CSS-module prefixes, as retained in the
historical schematic above. A sanitized live probe on October 29, 2026 found
generated prefixes (`JRIMpq_postContent` and
`_5kju5G_additionalStylesPostContentWrapper`) with the same semantic suffixes.
Same-card discovery remains mandatory; suffix matching is not permission to
select an unrelated page region globally.

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

| Concern | Current implementation boundary (1.3.9) |
| --- | --- |
| Master enablement | Extension toolbar popup; not the in-page Reader panel. |
| Article typography | Marked title/body for font/size; title size is 1.5× an explicit body size. Paragraph and line-spacing rules target body content only. |
| Background | Marked outer wrapper plus known inner surfaces/body. |
| Metadata and comment foreground | Matching surface ink on selected text elements; not article font/spacing. |
| Post creator avatar | Byline avatar container receives a theme-aware outline/drop shadow for non-default colors; native shape and sizing retained. |
| Main post actions | Marked top action row; Download, Reader, and known native controls only. |
| Comment text and authors | Surface ink, including clickable parent rows and author-name buttons; native comment typography retained. |
| Comment actions | Buttons within `comment-actions` inside the marked surface; icons/counts and interaction colors follow the palette. |
| Membership banner | Inner CTA card follows page background with tinted outline/drop shadow; Join buttons and artwork remain native. |
| Comment-entry field | Tagged wrappers use a darker page tint; text/fill/placeholder/caret, border, and focus follow surface ink. Native disabled opacity/login behavior preserved. |
| Other controls | No blanket theme override for sort, reply-expansion, collection-card surfaces, return-to-top, Join/login buttons, or unrelated forms. Inheritance can still affect unthemed descendants. |
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
| `data-patreon-download-button` | Extension-created post-export trigger; independent of Reader enablement. |
| `data-patreon-download-panel` | Host for the Shadow DOM PDF/EPUB/Markdown chooser. |
| Root `data-patreon-reader-*` flags and `--patreon-reader-*` properties | Enable individual overrides and supply validated values. |
| Root `data-hide-patreon-floating-engagement` | Activates the independent floating-bar hiding rule. |

The native root has `data-token-color-mode="auto"`, with further automatic-theme
containers. This alone does not reveal the effective dark/light theme. The HTML
capture's Reader background is Sepia (`#f4ecd8`), with effective brown text and
surface ink (`#5b4636`). No Reader font/size/spacing override flags are active.
In that historical 1.2.2 capture, effective brown does not distinguish Auto from
an explicit Brown selection. Current 1.3.9 has neither independent text colors
nor an Auto text control: Post Color supplies a fixed background/foreground pair.

In 1.2.2, [content.css](../extension/content/content.css) themes main-row icons, descendant wrappers,
counts, borders, hover, focus, selected/pressed, and disabled states using a
background-dependent palette. This palette is independent of reading-text color.
SVG `currentColor` follows the corrected foreground. Native handlers and aria
state remain Patreon's responsibility. Other controls inside the full background
wrapper remain separate components; background containment is not permission to
apply every article style to them.

The paragraph above describes the 1.2.2 implementation. Current additional
component rules and their rationale are documented below; it must not be read
as saying comment actions or the composer are still left entirely native.

The panel lives in Shadow DOM to isolate its UI styles. Ordinary `outerHTML`
does not capture its controls or styles; the empty panel host in the HTML is
expected. The captured Aa button has `aria-expanded="false"`.

## Component details and CSS pitfalls

The following examples are sanitized/simplified. `HASH` means a generated suffix
that must not be hard-coded. Native CSS findings below came from the stylesheets
linked in the supplied HTML, not from an assumption that screenshots reveal CSS.

### Post title, byline, and actions

Title markup is an h1 with `data-tag="post-title"` and a nested div carrying
`elementtiming="Post : Post Title"` / `data-is-key-element="true"` in the sample.
The title, creator identity/avatar, date, and engagement row are separate pieces.
`post-details` and creator-info desktop/mobile hooks coexist. Do not infer article
boundaries from a creator avatar or a generic `Stack` layout class.

`like-button` is reused for top engagement, comments, and floating engagement.
`share-post-icon` and SVG icon tags also occur outside a single main action row.
Scope to the selected top row before injecting Aa or styling main-post actions.
Native counts and ARIA labels are dynamic, can be localized, and are not selectors.
Native Repost/More actions are not created by the extension when absent.

### Creator avatar separation

The original HTML contains a `CreatorByLine-module__HASH__avatarContainerWithFreeMembership`
wrapper around an anchor and an `Avatar-module__HASH__container` holding the
image and follow-button overlay. The captured avatar is square; preserve native
rounding rather than forcing every creator avatar into a circle. Navigation
uses separate CreatorInfo markup and must not inherit this effect.

The October 25, 2026 17:54:09 screenshot shows a different creator's byline avatar
blending into the White post surface. Its exact DOM was not supplied; the fix
uses the existing captured byline structure, not selectors inferred from pixels.
Under the marked Reader surface, only Avatar containers within a
`CreatorByLine-module__…__avatarContainer…` wrapper receive a one-pixel shadow
outline at 45% surface-ink opacity and `0 2px 6px rgba(0,0,0,.2)` drop shadow.
The outline is dark on light presets and light on Charcoal. Default or disabling
Reader restores native shadows. No border width, radius, image filter, padding,
or event behavior changes; follow overlays, article images, navigation, and
comment avatars remain outside this rule. Synthetic checks cover square/round
avatars; the user's final 1.1.0 testing completion confirmation includes this
change, although no additional HTML or computed-style capture was supplied.

### Comments and author names

```html
<div data-tag="content-card-comment-thread-container">
  <div data-tag="comment-row" role="button" tabindex="0">
    <button data-tag="commenter-name"><span>AUTHOR_OMITTED</span></button>
    <time datetime="DATE_OMITTED">AGE_OMITTED</time>
    <div data-tag="comment-body"><div><p><span>TEXT_OMITTED</span></p></div></div>
    <div data-tag="comment-actions">ACTION_BUTTONS_OMITTED</div>
  </div>
  <div data-tag="comment-row">REPLY_CONTENT_OMITTED</div>
</div>
```

The captured parent has `role="button"`; the captured reply does not. An exclusion
such as `[role="button"] *` therefore excludes the entire parent comment, not just
its controls. Current CSS exempts `comment-row` from that generic exclusion, while
actual nested buttons retain their own styling rules. Author-name buttons need
an explicit foreground rule as ordinary paragraphs do not cover them.

Reply indentation, connecting lines, author badges, and View/Collapse replies
are observed UI. Exact thread-line CSS, badge palettes, and reply-expansion event
behavior are not a maintained Reader contract. Later screenshots show expanded
replies; this does not establish every possible nesting depth or pagination rule.

### Comment Like, Reply, and More SVGs

All three buttons are inside `comment-actions`. Like has `data-tag="like-button"`
and `aria-pressed`; More has `data-tag="comment-more-actions"`, `aria-expanded`,
and `aria-haspopup="menu"`. The captured Reply button has no dedicated data-tag;
it has `aria-label="Reply to comment"`. Group scoping avoids depending on that
English label or accidentally selecting the top post Comment action.

Like's TextLink classes include `hasIconColor`; Reply and More lack that class.
Patreon's linked CSS uses the following pattern (hashes normalized):

```css
.TextLinkStyle-module__HASH__root:not(.TextLinkStyle-module__HASH__hasIconColor) svg {
  fill: var(--TextLinkStyle-color) !important;
}
```

Consequences: changing button `color` is not enough; even `svg { fill: currentColor; }`
loses to that important fill declaration. The real paths inherit fill from the
SVG. A synthetic path with `fill="currentColor"` can conceal the bug, which is why
the regression fixture now reproduces the competing rule and inherited paths.
The current fix sets `fill: currentColor !important` only on comment-action SVGs
inside the active reading surface. Counts/wrappers inherit button foreground;
pressed/expanded states use the selected accent. Handlers and native state
attributes are not replaced. Main-row and comment-action styling remain separate.

### Membership banner

```html
<div data-testid="cta-banner-wrapper">
  <div class="PostBodies-module__HASH__singleColumnContent">
    <div class="CTABanner-module__HASH__root">
      <!-- Responsive variants: artwork, explanatory paragraphs, Join controls -->
      <div class="CTABanner-module__HASH__textContent"><p>TEXT_OMITTED</p></div>
      <button data-tag="join-for-free-button">Join for free</button>
    </div>
  </div>
</div>
```

Desktop/mobile variants differ in text, imagery, and button wrappers. There are
two `join-for-free-button` hooks in the capture, plus other responsive Join
buttons without that tag. Do not style every banner descendant or assume a
single CTA button. The actual inner `CTABanner` root owns its background; updating
the surrounding post column alone leaves a dark card behind recolored text.

Current non-default behavior: inner card uses the page background, with a
one-pixel shadow outline made from surface ink at 28% opacity and a drop shadow
of `0 6px 18px rgba(0,0,0,.18)`. The outline becomes light on Charcoal. Box-shadow
does not add border width or change layout. Default/disable restores the native
shadow; artwork, Join button colors, and native event behavior are preserved.

### Comment-entry field / login affordance

```html
<a data-tag="login-field" href="LOGIN_URL_OMITTED">
  <div class="TextInput-module__HASH__root TextInput-module__HASH__disabled">
    <label data-tag="comment-field-label">Comment Field</label>
    <div data-tag="comment-field-box">
      <div data-tag="comment-field-with-affixes">
        <!-- inputsOnly and growWrap layout divs omitted -->
        <textarea data-tag="comment-field" disabled aria-invalid="false"
                  placeholder="Join the conversation..." rows="1"></textarea>
      </div>
    </div>
  </div>
</a>
```

The real label is visually hidden and uses for/id plus `aria-labelledby` on the
textarea. Preserve those relationships. The textarea's grow wrapper has a
`data-replicated-value` attribute used for sizing; never log or persist its value
because it may contain a comment draft. Do not alter sizing wrappers, rows,
draft values, disabled status, login links, or submission behavior to fix colors.

Native findings: `inputsWithAffixes` owns background/border and focus styling;
textarea background is transparent; `::placeholder` has its own muted color;
disabled text uses `-webkit-text-fill-color` separately from `color`. The disabled
TextInput root also applies opacity (0.6 in the isolated supplied-page check).
Ignoring any of those layers can leave gray/white text or an old dark background.

Current non-default behavior: `comment-field-box` and `comment-field-with-affixes`
use `color-mix(in srgb, PAGE_BACKGROUND 92%, black)`. Both wrappers are opaque and
use the same tint; this is not two stacked translucent layers. The textarea stays
transparent. Text, text fill, caret, placeholder, and border use surface ink.
Focus-within uses a two-pixel outline with a two-pixel offset. Fields marked
`aria-invalid="true"` are excluded from custom border/focus rules so native error
presentation remains. Native disabled opacity remains in effect; the extension
does not make a logged-out field editable. Default/disable removes these rules.

### Other surrounding components

The collection card has its own thumbnail, label/count, and arrow; its surface
is not explicitly themed. The comments sort control is a combobox/listbox trigger,
not part of `comment-actions`. Its arrow remaining white in a light-theme
screenshot is evidence to inspect if that control is placed in scope later,
not proof of a fix in 1.3.9. Likewise separators, thread lines, reply-expansion
links, badges, toasts, carousel arrows/cards, navigation, and return-to-top need
their own scoped analysis. Avoid claiming every pixel in the surface is themed.

## Current settings and color contract

Source of truth: [extension.js](../extension/shared/extension.js), [reader.js](../extension/content/reader.js), and
[content.css](../extension/content/content.css). Colors are paired presets, not independent text
and background choices. Selecting Default removes color overrides rather than
guessing Patreon's native theme.

| Post Color label | Stored `postColor` | Text / surface ink |
| --- | --- | --- |
| Default | `null` | Native; no Reader color override. |
| White | `#ffffff` | `#222222` |
| Sepia | `#f4ecd8` | `#5b4636` |
| Light Green | `#e3eddf` | `#222222` |
| Charcoal | `#202124` | `#f5f5f0` |

Swatches are plain color circles with names and accessible radio semantics; no
Aa text inside them. The Default swatch retains a reset symbol. The Aa icon in
the actual post action row remains the Reader trigger. Charcoal was previously
called Black, then Dark; only labels changed, not stored hex values.

Display order (updated October 25, 2026): Default, Charcoal, Light Green, Sepia,
White. Only the non-default swatches were reversed; stored values, palette
definitions, and legacy nearest-color migration order are unchanged. Keyboard
arrow/Home/End navigation follows the displayed order.

| Interaction palette | White / Sepia / Light Green | Charcoal |
| --- | --- | --- |
| Hover surface | `#d5d5ce` | `#35373c` |
| Pressed/expanded accent | `#9b2343` | `#ffb3bf` |
| Pressed/expanded surface | `#f4dce4` | `#452b36` |

Action hover styling excludes disabled/aria-disabled controls. Main and comment
actions have a keyboard-focus outline and disabled opacity 0.55/cursor cue.
These action rules do not override the composer's separate native disabled opacity.
Article links remain underlined when Reader text color is active.

| Preference | Default | Allowed value / scope |
| --- | --- | --- |
| `isHidden` | `true` | Independent floating-engagement visibility toggle. |
| `readerEnabled` | `false` | Master popup toggle; gates insertion and all Reader styles. |
| `readerPreferences.font` | `"default"` | Fixed font identifier; title/body only. |
| `readerPreferences.textSize` | `null` | 12–32px, step 1; title uses 1.5× body size. |
| `readerPreferences.postColor` | `null` | Paired preset above; local display only. |
| `readerPreferences.paragraphSpacing` | `null` | 0–48px, step 1; body paragraph bottom margin, top margin zero. |
| `readerPreferences.lineSpacing` | `null` | 1–2.5, step 0.1; body line-height multiplier. |

Font IDs/labels: `default` (Patreon default), `systemSans` (System Sans), `arial`,
`verdana`, `trebuchet`, `georgia`, `times`, `monospace`. Exact fallback stacks live
in source. They reference installed fonts; no font enumeration, downloads, or
bundled font assets. Appearance settings are global within local extension
storage, not per-post and not synchronized across different browser profiles.

Normalization clamps numeric ranges, checks the font allowlist, and accepts only
valid six-digit hex colors before mapping to the nearest offered preset by RGB
distance. An explicit new `postColor` key, including `null`, wins over legacy
`backgroundColor`. Legacy independent `textColor` is dropped; text-only legacy
preferences become Default. The next settings change saves the normalized schema
without old color fields. No automatic network or server-side data migration occurs.

Root override suffixes currently are `font`, `text-size`, `title-size`,
`text-color`, `background-color`, `surface-color`, `action-hover`, `action-accent`,
`action-selected`, `paragraph-spacing`, and `line-spacing`. Each corresponds to a
`data-patreon-reader-SUFFIX` flag and `--patreon-reader-SUFFIX` CSS variable.
Input tints and banner shadows are derived CSS, not extra saved preferences.

## Runtime and settings ownership

| File | Responsibility |
| --- | --- |
| [manifest.json](../extension/manifest.json) | Patreon match scope, packaged CSS/scripts, background worker, storage/downloads/offscreen/alarms permissions, and optional media-origin envelope. |
| [extension.js](../extension/shared/extension.js) | Browser API adapter, validated preference schema, fixed fonts/presets, contrast and legacy-color normalization. |
| [patreon-dom.js](../extension/content/patreon-dom.js) | Patreon selectors, post discovery, and surface/action-row selection; no preference or panel state. |
| [content.js](../extension/content/content.js) | Supported-route detection, storage events, popup state messages, floating-bar visibility, batched reconciliation. |
| [reader.js](../extension/content/reader.js) | Uses the DOM adapter; owns markers, appearance state, Aa/panel lifecycle, controls, serialized saves. |
| [export.js](../extension/content/export.js) | Uses the DOM adapter; extracts the current title/body, sanitizes markup, embeds inline media, and creates PDF/EPUB/Markdown output. |
| [content.css](../extension/content/content.css) | Page-side typography, surfaces, action contrast, floating-bar hiding. |
| [popup.js](../extension/popup/popup.js) | Load/save master preferences and show page-connection status. |
| [media.js](../extension/background/media.js) | Permission-checks and fetches HTTPS image bytes for a user-requested export. |

The manifest loads `shared/extension.js`, `content/patreon-dom.js`, `content/reader.js`,
`content/export.js`, and `content/content.js` at document
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
The Reader observer does not watch every attribute-only or character-data change, and
there is no universal interception of every History API call. Do not claim
arbitrary Patreon state transitions are covered solely because an observer exists.

### Engagement visibility recovery (1.1.1)

Visibility is reconciled after each batched page update even when the pathname
is unchanged. A separate root-only MutationObserver watches just
`data-hide-patreon-floating-engagement`, restoring/removing it according to the
saved hide preference and recognized post route. It does not wait for an
animation frame, so background-tab recovery is not gated by frame scheduling.
The guarded writer changes the attribute only when presence differs from the
desired state, preventing redundant mutations/observer feedback loops. It does
not inspect all page attributes, change Reader settings, or broaden URL support.

Evidence: the user reported identical recognized URLs, enabled Hide Engagement
Bar in the new tab, a working off/on workaround, and persistent Reader settings.
An installed-extension synthetic check reproduced the symptom by removing the
flag without changing URLs; ordinary new-tab storage persistence worked. This
establishes a recoverable failure mode, not proof that live Patreon hydration
removed the flag. Recovery tests fail on the old code and pass on 1.1.1; final
verification on the user's affected live page is still needed.

Detection/surface selection in `patreon-dom.js`, used by `reader.js`, in order:

1. Gather eligible titles outside floating/comment regions; prefer h1 candidates
   and a visible candidate. Otherwise consider titles outside post cards.
2. Search ancestors up to the candidate's card/main boundary for a visible Like
   in the same card; prefer a Like inside `top-engagement`.
3. Ascend far enough to include the shared RichText body despite responsive
   title duplicates. Keep body/title membership inside the same selected card.
4. Choose the Like ancestor `singleColumnContentWrapper`, else inner
   `singleColumnContent`, else `single-column-post-wrapper`, else its post card,
   else the discovered scope. Mark that surface and matching title/body targets.
5. Mount Aa immediately before Like; mark the nearest `top-engagement` row or
   Like's parent fallback. Remount if the anchor, placement, or row changes.
6. On route change, unsupported route, disablement, or failed detection, remove
   the panel/button, markers, root override flags, and variables. Keep saved
   preferences. Missing native structure must not create controls elsewhere.

The content script's route is a pathname check, not an authentication check.
Its reserved-root list in `content.js` excludes routes such as login/settings
and must be consulted before extending matching. A recognized URL without
eligible DOM targets can legitimately report that controls were not found.

The toolbar popup saves the two master booleans to local storage and queries the
active tab with `GET_STATE`. Content replies with `isHidden`, `readerEnabled`,
`readerMounted`, and `isPostPage`. It also accepts the legacy `SET_HIDDEN` message
from this extension only. It does not accept remote styling instructions.

| Popup status | Interpretation |
| --- | --- |
| Available on Patreon post pages | Connected page reports an unsupported pathname. |
| Reader controls not found on this post | Supported route, Reader enabled, no mounted Aa detected. |
| Open or refresh a Patreon post to connect | Tab message failed or did not return usable page state. |
| Preferences apply to all posts | Connected supported page; not proof that every region was visually tested. |

Appearance previews apply immediately. The Reader serializes writes within its
own save queue and suppresses stale incoming configuration while writes are
pending. A failed save leaves the preview visible and reports failure in the
panel; a subsequent control adjustment retries. This is not transactional conflict
resolution across tabs. Storage-change listeners propagate preferences to other
open post tabs; simultaneous independent edits remain a separate concurrency case.

Panel behavior: accessible dialog, close button, Escape/focus return, outside
pointer/focus dismissal, Tab/Shift+Tab wrapping, arrow/Home/End color radios with
roving tabindex, and live save status. Desktop panel width is 332px; at viewport
width <=480px it uses a bottom-sheet-like placement with viewport margins.
Scrolling/resize/visualViewport updates reposition it. Those dimensions belong
to the extension, not an inferred Patreon responsive breakpoint.

A packaged background service worker now supports post export. The manifest
declares `https://*/*` only as an optional host-permission envelope; it does not
grant those origins at installation. When an export contains remote inline
images, the trusted content script registers only the exact HTTPS origins present
in the selected post body with the worker. The packaged extension-origin format
frame retrieves that registration before enabling its buttons and calls the
permissions API directly from the user's format-button gesture. It returns the
validated format through extension runtime messaging; the worker binds the token
to the originating Patreon tab and delivers the choice with `tabs.sendMessage`
to the isolated content-script world. The worker rechecks permission and the Patreon sender before
fetching those image URLs without credentials. Since the November 2 streaming-ZIP
change, storage, downloads, and offscreen are required extension permissions.
A subsequent November 2 retention update adds alarms for automatic expiry cleanup.
No remote executable code, selectors, analytics, or fonts
are fetched.

## Post export boundary (unreleased)

**Intended behavior:** A Download control is mounted before Reader/Like on the
same selected main-post action row and remains available when Reader customization
is disabled. It offers PDF, EPUB, and Markdown. Extraction is limited to the
selected post title and RichText body discovered through the existing same-card
DOM adapter. Comments, membership banners, recommendations, navigation, floating
engagement, and other page UI are excluded. Scriptable/form/embed elements,
event attributes, site classes, IDs, and inline styles are removed from the copy.

Inline body images are embedded for offline use. Data URLs are processed locally.
Remote images require a user-approved exact-origin permission and are fetched by
the packaged worker only for a request originating from a Patreon tab. Non-HTTPS
sources, non-image responses, individual images over 25 MiB, and combined image
payloads over 100 MiB are rejected. A denied or failed image request aborts the
export rather than silently producing a partial offline document. Signed image
URLs are used transiently and are not written to the generated document.

**November 2 export security hardening (synthetic evidence):** Media responses
are consumed with a streaming byte counter, cancelled on overflow, and subject
to a 30-second deadline including queue time. The worker allows two simultaneous
image requests; each post fetches distinct images sequentially and passes its
remaining budget, accounting for repeated Markdown image occurrences. Redirects
are rejected rather than contacting another origin. Embedded data URLs are size
checked before decoding, restricted to JPEG/PNG/GIF/WebP/AVIF/SVG, and raster
signatures must match the declared type. These are payload limits, not a total
extension RAM cap: DOM trees, base64 and encoding buffers also consume memory.

SVGs are parsed as XML with document/entity declarations rejected and rebuilt
using an explicit graphics-only element/attribute allowlist. Scripts, events,
stylesheets, animation, links, embedded HTML and external image/reference URLs
are removed. Local fragment paint/clip references and basic shapes/text/gradients
are retained. Unsupported effects can change appearance. Cached images receive
the same validation lazily on first use during each conversion; older cached
SVGs or SVGs disguised as raster formats cannot bypass sanitization. Raster
signatures are a format check, not full image-decoder validation.

Markdown text, metadata and labels are escaped as literal content; generated
formatting and HTTP(S) links are retained. Link delimiters are encoded, and code
fences grow beyond any backtick run in the original code. Synthetic fixtures
cover markup injection, code fences, active/external SVG content, cache reuse,
MIME disguises and invalid declarations. Worker fixtures cover streaming overflow,
reader cancellation, exact bytes, concurrency and timeout cancellation. Live
Patreon media-host compatibility and third-party reader behavior remain unverified.
Previously saved exports are not rewritten. Local caches remain unencrypted;
expiry/lifecycle cleanup retains its documented best-effort crash limitations.

**November 2 nested Markdown follow-up:** List continuation lines are indented
under their marker, preserving fenced code inside lists, nested lists and
blockquotes. Malformed inline/heading containers render embedded preformatted
text as inline code so a heading cannot consume an opening fence. A CommonMark
parser is pinned as a development-only dependency; generated HTML is inspected
and previewed with external requests blocked to confirm code stays inert. This
extends the earlier escaping tests with actual Markdown parsing, not live reader
compatibility claims.

**November 2 newline containment correction:** The follow-up audit established
that bare CR characters in code could bypass list/blockquote prefixes because
those containers split only LF lines. Markdown serialization now normalizes
CRLF and bare CR to LF before escaping text, fencing code or applying container
prefixes. Inline-code line folding uses that same normalization. Source DOM and
cached trees are not rewritten; restored sources are normalized when converted,
so older caches receive the fix too. Synthetic CommonMark/preview regressions
cover LF, CRLF and CR in lists, nested lists, blockquotes, quoted lists, headings,
inline code and ordinary text, including embedded backtick runs. The tests check
both fresh and cached output for absent active HTML, script effects and external
requests. This corrects the newline gap in the earlier nested-block evidence;
it does not establish authenticated Patreon or third-party-reader verification.

**November 2 encrypted source-cache follow-up:** New disk source entries use
AES-256-GCM with random nonces and owner/post-bound authenticated context. Titles
and source trees/images are encrypted together; headers retain only size, expiry
and format markers. The key is stored only in extension `storage.session`, survives
worker suspension, and is lost when the extension/browser session ends. Legacy
plaintext records, malformed ciphertext and authentication failures become deleted
cache misses. This supersedes the unencrypted-source observation above. It does
not protect against a compromised running browser, privileged memory inspection,
OS swap/hibernation captures or files the user deliberately saves.

**November 2 encrypted retry/budget follow-up:** Archive retry chapters are stored
as bounded AES-GCM frames authenticated to job/index/transfer/offset. Packaging
decrypts one frame at a time into the browser-required temporary plaintext ZIP.
The final ZIP is not an idle reusable cache: failed handoffs remove it and startup
removes idle ZIPs. Active native-download backing files remain until completion.
Legacy plaintext retry metadata/files are discarded. This supersedes the earlier
unencrypted-retry observation; temporary ZIPs can still leave plaintext after a
forced termination, and deletion does not establish secure erasure.

All archive jobs share a separate 1 GiB payload budget, counting committed files,
pending writes and the ZIP simultaneously. Serialized writes prevent concurrent
jobs from exceeding that payload budget; restart reconstructs usage from disk and
failed deletion keeps accounting conservative. The source cache retains its own
512 MiB budget. Filesystem metadata/overhead and user-saved downloads are outside
these payload limits. Tests cover concurrency, abort/retry accounting, staged-ZIP
limits after worker restart, tampering, failed handoff cleanup and legacy purging.

**November 2 permission-management follow-up:** The toolbar popup lists the count
of saved optional HTTPS media-origin grants and offers Forget media access. It
uses the extension permission API, excludes the required Patreon origin, and
reports removal failures separately from preference saving. Revocation does not
clear source caches, user-saved files or preferences; future remote-media requests
require access again. Popup fixtures cover success/failure, retained Patreon
access/preferences, and light/dark layout; installed Brave verifies the native
permission list is available. No page selectors or Reader boundaries changed.

**November 2 source reuse:** Individual exports retain one inert source tree and
distinct image data URLs for two hours in page memory, up to 16 MiB. A SHA-256
fingerprint of normalized body markup, image sources, and post metadata invalidates
it when content changes; Reader styles are removed before fingerprinting. Download
time is regenerated for each output. Route changes clear the entry. Larger posts
still export but are not retained in this small memory cache. Repeated image
sources share an asset index and EPUB image entry. EPUB decodes cached image bytes
on demand; Markdown uses data URLs directly.

**Historical PDF path (superseded November 4, 2026):** PDF uses a sanitized,
self-contained print view and the browser's native print
dialog; the user selects Save as PDF. The print view uses a temporary same-tab
iframe so it does not depend on popup permission after the extension-frame gesture.
During printing, both the iframe and Patreon tab temporarily use the sanitized
post title so Chrome suggests it as the PDF filename; the original tab title is
restored immediately afterward. EPUB and Markdown downloads use the same
sanitized title stem with their respective extensions.
Its `@page` margin is zero to remove Chrome's automatic date/title and
URL/page-number regions; an inner document wrapper restores 18 mm content margins.
At the top of the document, above the post title, it lists Creator, Download time,
and Source in that order. Creator
prefers scoped byline/post-detail text and falls back to the Patreon document-title
pattern. Source removes query and fragment data. Downloaded uses the user's local
date, time, and timezone.
EPUB is an uncompressed EPUB 3 ZIP containing
XHTML, navigation, CSS, package metadata, and image files. Its visible XHTML has
the same Creator, Download time, and Source block above the title; creator and
source are also recorded in OPF metadata. Markdown is a single `.md` file whose
image destinations are embedded data URLs and whose top section shows the same
three details before the title. Links are resolved to HTTP(S) URLs. The exporter
does not bypass Patreon authentication or access
content that was not rendered for the user.

**Evidence:** Synthetic Playwright fixtures verify control placement, exclusion
of comments/recommendations, embedded data and remote images, exact-origin
permission requests, permission denial, EPUB container contents, rerender
recovery, and route cleanup. An installed Brave test changes Reader font and
color, then performs a real Markdown download through the packaged chooser and
isolated content script. Reopening Download clears the previous chooser document
before registering its new token, preventing a stale-button race. After each
completed export, the content script loads a uniquely addressed fresh chooser
instance so its controls are enabled for another format without closing the panel.
The installed test performs consecutive Markdown and EPUB downloads in one open
panel. These tests do not establish current live Patreon
media hosts, browser permission-prompt presentation, print-dialog behavior in
every browser, EPUB-reader interoperability, or export of non-text post types.
No new Patreon markup observation is claimed by this feature as of October 29,
2026; the original October 25 capture remains the live structural baseline.
The chooser frame explicitly matches the surrounding white or `#232326` panel
background so its rectangular canvas does not appear as a black strip in dark mode.
The post dialog displays an indeterminate activity bar while registering its
chooser and preparing post text and inline media. It hides the bar after the
download or print handoff starts and on preparation errors, while the live status
message retains the result.

## Collection export boundary (unreleased)

**November 3 automatic network retries:** A packaged `shared/retry.js` helper
is loaded by content scripts and the media worker. Idempotent collection API and
inline-image reads retry at most three times total, using 1s/2s exponential waits
plus less than 250ms jitter, per-attempt 30s deadlines and abortable waits. Only
fetch/read TypeErrors, attempt timeouts and HTTP 408/429/500/502/503/504 qualify.
HTTP Retry-After seconds or dates increase the delay; waits over 60s stop for a
manual retry rather than violating the requested wait. Header interpretation
follows the [HTTP Retry-After reference](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Retry-After).

Retries keep permission/origin checks, omitted media credentials, redirect rejection,
byte limits and the two-request concurrency cap. A failed image stream is discarded
and that image restarts from zero; the media slot releases between attempts. API
response-body reads are retried only for transport errors, not JSON syntax or
content validation failures. 401/403 access errors and exhausted/long-wait transient
API reads surface instead of silently triggering DOM fallback. The private-API
format/availability fallback still applies to other nontransient discovery errors.
Permission denials, unsupported content, invalid or oversized media, archive
storage errors and download/package mutations are not auto-retried.

The existing 60x250ms page-readiness loop remains separate. Completed BUILD error
responses are now terminal unless explicitly reporting an unfinished/incorrect
page; this prevents multiplying three network attempts across repeated builds or
an existing-tab fallback. Manual Retry failed posts/Retry packaging remains
available and committed chapter entries are retained. The UI shows retry attempt
and wait time; media progress messages retain owner/operation correlation, and
post exports also show media retry waits. This introduces no new site selectors,
permissions, storage keys, remote dependencies or access bypass.

Synthetic unit cases verify delay growth, both Retry-After forms, bounded attempts,
permanent errors, timeout/abort handling and interrupted-stream restart. Worker
cases verify unchanged media request policy and cancellation during backoff, plus
one build attempt for a completed chapter failure. Browser fixtures use a virtual
clock to check recovery, cancellation, long waits, exhausted requests and denied
access without fallback. Installed Brave recovers from a transient private-API
failure before preparing cached exports. No live Patreon or permission-prompt
verification is claimed by these fixtures.


**November 3 incremental refresh:** Refresh collection now reconciles the existing
owner/token namespace instead of cancelling it before discovery. API pagination
is reread for fresh order/access. The request asks for the already observed
`content_json_string`, `title` and `current_user_can_view` fields. A valid nonempty
structured body plus boolean-true access yields a SHA-256 fingerprint over body,
title, available post/embed/file/image/author references and returned related
image/author attributes. Only the digest is sent/stored with prepared metadata;
raw response content and signed URLs are not added to session storage. Publication
time alone is not used as an edit detector. The public [Patreon Post API reference](https://docs.patreon.com/#post-v2)
does not establish a reliable published-post edit timestamp for this private
collection integration; fingerprint behavior is synthetic evidence, not a live
API contract or proof of unchanged inaccessible fields.

The worker accepts refresh only for the same owner, rejects concurrent prepare/
build work, and preserves cached sources only for matching revisions. Reusing
preparation requires a live source entry too; uncached/expired records are
rechecked. Removed, changed, locked or unverifiable records are deleted before
preparation. Retained encrypted records keep their original two-hour deadlines;
reads and refreshes do not rewrite/renew them. The discovered order becomes the
new post order. Generated retry checkpoints and reports reset on explicit refresh,
including when all posts become locked/empty. Missing/invalid full-content or
access evidence, private API failure and DOM fallback cause conservative full
revalidation. Previously skipped posts are retried, not treated as cached successes.

Synthetic worker/cache cases cover new/edited/removed/reordered posts, unchanged
source hits after restart, independent-owner rejection, uncached/expired sources,
fixed deadlines, and cancellation with late replies. Browser cases inspect
fingerprint/order/token messages and access changes; installed Brave verifies
unchanged-source refresh opens no post tabs after cached book/ZIP downloads.
The native fixture waits for its initial API performance entry before asserting
revisions; the first attempt lacked that discovery evidence. Earlier November 1/2
statements below that Refresh deletes all source data are superseded by this
behavior; their historical checkpoint observations are preserved. Changed generated
output is still rebuilt, and the existing cache/disk/access bounds remain in place.


**November 3 download reports:** The existing collection dialog now includes a
collapsible Download report with per-post title/canonical link, status and reason,
plus an explicit Save report action for a standalone plain-text file. Reports
use text nodes and checked HTTPS Patreon post URLs only. Error URLs are omitted;
worker preparation errors become fixed, limited explanations rather than raw
messages. API-exposed membership locks produce individual skipped records even
when the entire collection is locked. Preparation skips have individual records
in prepared browser-session metadata and survive worker restart under the same
owner/two-hour lifecycle. Older sessions with only aggregate skips show unknown
rows and ask for refresh rather than invent titles or causes.

Generation results distinguish Prepared, Failed, Cancelled and Download started.
Only browser handoff marks prepared posts as included; packaging failure never
claims a successful download. Retry rebuilds statuses from committed entries and
replaces previous failures. The latest attempt survives reopening the dialog;
new downloads replace it, explicit Refresh resets it, and page navigation/reload
or a two-hour timer removes it. Cancel leaves the report for review. The report
itself is page-local and is not added to CacheStorage or the generated archive.
User-saved reports persist as ordinary downloads. The report does not monitor
native download completion/interruption, and says so explicitly. No Patreon DOM
selector, access rule, permission or EPUB/ZIP contents changed.

Synthetic fixtures cover locked-only collections, skip/failure details, URL
redaction, inert titles, packaging failure, successful retry, cancellation,
reopening/refresh/navigation and expiry. Worker fixtures cover unsupported-only
collections, per-post skips after restart and absent signed error URLs. Installed
Brave verifies the report after native EPUB handoff. Desktop/light and narrow/dark
screenshots were inspected using synthetic pages. No current live Patreon markup
or native completion-tracking claim is established.


**November 3 single-book writer:** A new packaged worker module assembles one
EPUB from independently staged, encrypted chapter EPUBs. It decrypts/inflates a
chapter as a stream, validates stored-resource sizes/CRCs and safe resource names,
and writes a single outer EPUB with chapter-specific image directories. The
first physical entry is the uncompressed `mimetype`, with no extra fields. The
writer adds a collection title page, EPUB navigation document, OPF manifest/spine,
creator/source/download-time metadata and shared styles. Only central-directory
and publication metadata accumulate across chapters; file bodies/images are
streamed. Staged chapter input stays bounded and validated against its recorded
size/CRC. The existing archive budget, expiry, native handoff and cleanup apply to
both `.zip` and `.epub` outputs. This follows the [EPUB ZIP container contract](https://www.w3.org/TR/epub-33/#sec-zip-container),
without claiming third-party reader certification.

Synthetic Node disk fixtures verify streaming assembly after worker restart,
quota failure without partial plaintext output, rejected nested paths/invalid
metadata, and owner closure while assembly is in progress. Earlier November 2
separate-file ZIP observations below remain historical evidence for that mode.


**November 3 single-book UI:** The collection chooser now groups Single EPUB
under One book and the existing EPUB/Markdown buttons under Separate files (ZIP).
The iframe is taller to fit both groups and retains the surrounding light/dark
background. Single EPUB uses the same discovery/access checks and cached sources,
with a separate retry checkpoint from the ZIP modes. Each chapter is rendered
through the existing snapshot sanitizer and staged independently, with stable
chapter paths for images/styles and previous/next/Contents links. A direct `.epub`
download is named from the collection title; it has no outer ZIP of chapter books.
The title page includes Creator, Download time and Source. Completion reports EPUB
book download started; assembly, finalization and handoff progress use EPUB labels.
The hidden downloader supplies the EPUB or ZIP MIME explicitly via a disk-backed
Blob slice, so the browser uses the correct saved extension. The installed
regression checks both native extensions after an initial ZIP-MIME mismatch was
caught and corrected.
Mode changes discard only generated retry files, while source caching remains
available. Book preparation has the existing 100-post and temporary-storage limits.
No Patreon DOM selectors, local-only data boundary or media permissions changed.

**Intended behavior:** On a pathname matching `/collection/{identifier}`, a
fixed extension-owned **Download Collection** control offers Single EPUB or
separate EPUB/Markdown ZIP files.
Its dialog shows an extension-owned progress bar from discovery through ZIP
packaging. Discovery and packaging are indeterminate when no trustworthy total is
available; preparation, generation, and page-side file receipt report completed
post counts against the validated total. Completion and error states hide the bar
while retaining the live status message.
The extension-owned Cancel action stays available during discovery, preparation,
generation, chunk receipt, and packaging. It aborts extension API discovery,
stops further Load more polling/clicks, cancels pending worker requests and tagged
media fetches, closes only the extension's worker, and removes prepared/transfer
state. The UI shows Cancelling until cleanup acknowledges, then Cancelled and
Start again. Completed discovery can be reused, while incomplete discovery is
retried from the start. Late replies, cancelled transfer IDs, and late worker
creation cannot restart work or save a ZIP. Existing user-opened post tabs are
preserved. Cancel is hidden after ZIP handoff and does not undo a browser download
or abort a Patreon-owned Load more request already started by its native button.

The separate-file option creates one ZIP named from the collection heading. It
first finds the current page's observed same-origin `/api/posts` request for the
route's collection ID, removes its cursor, and follows validated next links or
cursors until none remains. It accepts numeric post resources in API order and
requires their unique count to match the stable reported total. Request URLs are
kept only in memory. If no usable API template is available or the private response
changes, discovery falls back to activating the collection-scoped Load more
control and reading direct `/posts/{numeric-id}` grid-card links. A temporarily
disabled control is treated as in-progress; a stalled control produces an error
instead of silently preparing a partial set. Both paths remove duplicates while
preserving collection order and create numbered title-based files.
API discovery explicitly requests `current_user_can_view` on every page and
excludes posts only when its value is boolean `false`. Unique totals and the
100-post bound count all discovered posts, including locked ones. Locked posts
never reach the preparation worker and are reported separately from generic
unavailable/unsupported failures. Missing or nonboolean flags retain normal
preparation checks. An all-locked result stops before worker preparation with a
membership message; it does not fall back to visiting locked pages. The DOM-only
fallback has no new inferred lock selector and retains generic skipping behavior.
The outer collection archive uses `application/zip`, valid DOS timestamps, and
ZIP method-8 actual DEFLATE compression for compatibility with macOS archive detection;
individual EPUB payloads retain `application/epub+zip` and their required stored
`mimetype` entry.
**November 1 investigation:** The previous stored-block implementation did not
achieve compatibility for large nested EPUBs. Stored DEFLATE blocks leave the nested EPUB MIME
marker visible to macOS's early format scan, causing generic-data classification
and the reported Archive Utility rejection. Actual compression passes the
synthetic detection and Archive Utility extraction control. The writer now uses
the browser's compression stream and strips the zlib wrapper to produce the raw
DEFLATE required by ZIP. Individual EPUB containers retain their original bytes.
See [current
diagnostic evidence](../TESTING.md#automated-checks).
**Historical collection limitation (superseded November 4, 2026):** PDF was
deliberately deferred: the previous post PDF path used Chrome's interactive
Save as PDF UI and cannot package generated PDF bytes into a ZIP.

The worker prepares each linked post through its normal rendered post page. Post
content scripts register their own tab URL with the worker, allowing an already
open matching tab to be reused without the broad `tabs` permission. Otherwise the
worker creates one inactive temporary Patreon tab and navigates that same tab
through unopened posts in sequence. Since the November 1 focus fix, readiness
checks retry in the background for up to 60 attempts at 250 ms intervals without
activating either the worker or collection tab. The previous brief worker/owner
activation fallback was removed because it repeatedly interrupted other tabs.
The tab
must finish loading the requested post before answering preflight/build requests:
the content script compares the requested numeric post ID with its immutable
initial document identity and current URL, and requires `readyState=complete`.
The background validates the returned ID before accepting successful metadata,
retrying stale replies during navigation. A registered open tab that no longer
qualifies falls back to a freshly navigated worker. The worker
closes immediately when preflight finishes. As of November 2, file generation
requests one chapter at a time and closes its worker after receiving that chapter
in the background. Cancellation,
failure, expiry detection, and collection-tab closure also clean up any active worker.
The preflight gathers only exact remote-image origins before the packaged chooser
enables its direct user-gesture permission request. After approval, each post uses
the same sanitized extraction and embedded-media path as individual export.
As of November 2, generation transfers a versioned, format-independent source
snapshot: title, creator, canonical source URL, language, an inert content tree,
and one data URL per distinct image. The collection page renders its selected
format from that snapshot. Hydration creates only allowlisted inert elements,
validates post identity, and does not insert the source tree into the live page.
Download time is generated at rendering time, not retained in the source.
The background's `post-cache.js` stores snapshots in extension-origin CacheStorage,
keyed by collection token and post ID. Synthetic HTTPS cache keys never cause
network requests. Entries expire two hours after insertion and share a 512 MiB
budget with oldest-entry eviction; failures or eviction fall back to fetching.
Only one chapter is loaded into memory for conversion at a time. The initial
source-cache change retained generated-file retry/ZIP buffers proportional to
archive size. The subsequent November 2 streaming-ZIP change below replaces them
with private disk files and bounded byte streams.
Refresh, Cancel, and owner-tab closure delete the collection's sources. Worker
startup prunes expired and orphaned entries against restored session metadata;
expiry deletion is lazy, so disk records may remain while the browser is closed,
but are not reused in a new browser session. Cancelled pending writes are removed
after storage completes. Corrupt records are treated as misses. Source snapshots
are not added to `storage.session`, do not contain signed image request URLs, and
are never exposed as web-accessible resources. Closing the panel, successful ZIP
handoff, and format changes preserve source reuse within the prepared session.
Generated file metadata crosses first; file contents are then pulled in at most
1 MiB character chunks from the post tab to the background and from the background
to the collection page. Completed source chunks are released, the final ZIP is
assembled locally on the collection page. As of November 2, generation/transfer
failures preserve prepared metadata and completed page-side chapter files.
This avoids the browser's 64 MiB per-message limit without changing embedded-media
behavior.

Unavailable or unsupported post pages are skipped during preflight and their count
is shown. As of November 2, a failure after preflight no longer discards completed
chapters: generation/transfer continues through the remaining posts, then offers
Retry failed posts for missing files. The ZIP is withheld until every prepared
chapter succeeds. Retry packaging reuses the completed entries after a compression
failure. Checkpoint metadata stays in collection-page memory and generated files
now stay on private disk as described below; they survive panel closure and
metadata-only worker restarts, and are cleared by reload/navigation, Cancel,
Refresh collection, switching formats, or successful ZIP handoff. Expired/missing
prepared metadata is rebuilt from cached discovery before retry; retained entries
are reused only when the prepared URL sequence is unchanged. This does not retry
preflight skips. Synthetic tests cover these recovery paths; authenticated live
recovery is not yet confirmed. The current implementation
accepts at most 100 unique post links per collection request. As of November 1,
collection discovery (links and locked counts) is retained in page memory for
two hours; prepared metadata is saved in `storage.session` for two hours after
preparation or generation. It is restored before collection requests are handled
when the background worker wakes after suspension. Stored records contain only
owner IDs, post URLs/titles, image origins, skipped counts, expiry, and a schema
version; post bodies, generated files, and signed media URLs are not saved.
Closing the panel preserves those caches without retaining a
worker tab. Successful finalization releases all generated transfer files and
retains only the prepared metadata for another format. Reopening or finishing a
download checks the existing session before deciding whether preflight is needed.
Missing/expired saved state repeats preparation using cached links when the panel
is reopened; routine worker suspension restores metadata without preflight. Expired page
discovery is fetched again on the next opening. Refresh collection explicitly
discards both caches and refetches. Navigation/reload clears page state, and
navigation/cancellation/tab closure discards the background session. Stored
records are removed on cancellation, owner-tab closure, or expiration; browser
session storage ends with the browser session. Post content and media are
rendered anew for each format from the bounded source cache described above;
they are not included in this metadata cache. Cache misses fetch them normally.

Chooser errors are sent directly to the owning panel through `postMessage`,
because the failed session cannot be relied on to relay them. The panel checks
extension origin, current chooser window, active token, and error-message type
before displaying the error. This path handles both initial chooser setup failure
and a later failed click without silently swallowing the message. Existing direct
user-gesture media permission requests remain in the packaged chooser.

Synthetic cache verification covers repeat format actions, panel reopening,
refresh, discovery expiry, lost background state, route invalidation, transferred
data release, repeated build worker cleanup, metadata restoration after real
Brave worker-target termination, and visible missing-session errors. Live authenticated cache behavior
remains pending confirmation. Cached chooser reuse avoids an intermediate
`about:blank` navigation, which caused a navigation race in repeat-download tests.

**Evidence and limits:** The original October 25 post capture contains a collection
link/card but not the collection page itself. The later October 31 screenshot and
sanitized structure establish the collection route, main boundary, grid-card link
suffix, direct numeric post routes, initial 20-card batch, Load more container, and
displayed 74-post total described above. They are user-supplied rendered evidence,
not an automated authenticated session. The supplied pagination response establishes
the internal cursor shape but not a public compatibility contract. Chrome fixtures
verify route scoping, two-page API traversal without clicking Load more, fallback
expansion, URL filtering/deduplication, direct post routing, order, ZIP filenames/
content, and cleanup.
The unpacked-Brave test verifies real extension messaging and download using two
already-open intercepted synthetic posts; Playwright cannot intercept navigation
initiated by an extension-created tab, so that creation path remains a manual/live
check. A full post export using the new cursor path remains pending user
confirmation. The private endpoint can change without notice; Load more remains
the compatibility fallback. Collections over 100 posts, alternate list markup,
remote images, and current live collection ordering remain unverified. November 1
inspection verifies live API access flags and the updated discovery filter;
locked-page DOM variants and membership changes during generation remain unverified.
Subsequent November 1 archive inspection additionally confirms repeated content:
74 numbered files in each available archive contain one unique title, source,
and post body. At the diagnostic checkpoint the worker sent export requests
immediately after `tabs.update` and accepted success without validating the
destination post identity. The subsequent identity guards are verified by a
delayed-navigation background test that returns successful old-document replies
before each destination, plus a browser test rejecting stale document requests.
The full authenticated collection still needs live post-fix confirmation.

## Verification and change history

**November 2 export retention update (intended behavior, synthetic evidence):**
`background/retention.js` coordinates export-only cleanup services. It schedules
one alarm for the next source/metadata/idle-job deadline, serializes maintenance
against new collection requests, and disarms when no deadline remains. Source
entries keep their fixed two-hour insertion expiry; cached reads do not extend it.
Prepared metadata and idle retry files are actively swept instead of waiting for
another export or worker restart. Expired archive GET requests now delete/reject
the job rather than renewing expired files. Active worker tasks are allowed to
finish; files already backing a native download are protected until completion
or interruption. Page discovery and individual-post memory caches have expiry
timers too. An idle collection panel receives expiry notifications and offers
Start again, or discards its expired retry checkpoint.

Closing the last accessible normal/popup browser window clears export caches and
blocks late requests until a window opens. Browser startup clears leftover export
data; ordinary worker suspension/restart preserves unexpired session caches.
Maintenance never clears `storage.local` or Reader customisations. Orphan cleanup
on worker startup remains as a fallback. This supersedes the earlier lazy-expiry
and post-expiry archive-renewal behavior recorded below. The new alarms permission
supports worker wakeups. Browser sleep/scheduling can delay alarm delivery, and
crashes or forced termination can prevent shutdown deletion; on-disk leftovers
may remain until the next startup. This is cache housekeeping, not a guaranteed
shutdown-time secure-erasure mechanism. See Chrome's [alarm timing](https://developer.chrome.com/docs/extensions/reference/api/alarms)
and [asynchronous shutdown limits](https://developer.chrome.com/docs/extensions/reference/api/runtime/#event-onSuspend).

Evidence: mocked lifecycle events verify last-window/startup cleanup and preference
preservation separately from worker restarts. Real worker sweeps delete expired
source records and OPFS retry files without a follow-up export, and reject expired
renewal. The installed Brave test advances its worker clock and fires a native
alarm, verifies that source images, session metadata, and an unfinished disk entry
are removed, and compares saved customisations before/after. These synthetic checks
do not establish guaranteed cleanup during a real OS crash or forced browser quit.

**November 2 detailed collection progress update (intended behavior):** The
extension-owned panel now has separate current-post/file, counts, byte-detail,
and elapsed-time lines. Existing final ready/success/error status text remains.
Discovery reports found counts; preflight reports checked counts and the current
index, adding a title when available. Download work shows the prepared post title,
receiving or cached-source reading, formatting, compression/saving, ZIP copying,
finalization, and browser handoff as distinct stages. Completed-post counts stay
separate from per-stage percentages. Compression reports processed input and
written compressed bytes, stays below 100% while flushing/committing, and reaches
100% only after the disk entry is persisted. ZIP copy progress measures compressed
payload bytes, excluding its small headers/directory; finalization is explicit.

Elapsed time uses a monotonic clock, updates once per second and on progress/
visibility changes, and freezes on completion, failure, cancellation, or removal.
Retries start a new elapsed clock and attempt-specific cache/failure counters,
while retaining completed disk-entry counts. The clock measures extension work
through handoff, not the browser's later download duration. Timer text is outside
the live status region. Long untrusted titles use plain text and are clamped;
the panel scrolls within the viewport. Byte progress is throttled between updates,
with immediate stage/file boundaries. No timing/title telemetry is added to storage.

Preparation/build messages and ZIP copy/handoff messages carry an ephemeral
attempt ID. The panel verifies that ID together with the current token/archive
ID and active operation, ignoring old or malformed updates after cancellation,
completion, or retry. Cache-hit flags and post titles come from existing worker
metadata, without additional page visits. The source-cache lifetime and disk ZIP
pipeline remain as recorded below. Evidence is synthetic: focused browser tests
cover monotonic elapsed timing, cancellation freeze, safe title rendering, stale
IDs, byte/percentage stages, cache/failure counts, and retry resets. Background
tests verify correlated cache-hit titles and monotonic copy bytes. The unpacked
Brave regression verifies real handoff with correlated progress IDs. Live
authenticated Patreon progress remains pending confirmation.

**November 2 streaming collection ZIP update (intended behavior, synthetic evidence):**
`content/archive-stream.js` consumes one generated chapter's Blob stream, computes
CRC-32 incrementally, compresses it, strips the zlib framing with a four-byte tail,
and awaits bounded chunk writes to `background/archives.js`. Completed entries
are raw-DEFLATE files in extension-origin OPFS, not retained chapter byte arrays.
The page's retry entries contain only names, sizes, checksums, and archive IDs.
Session storage retains the same small archive metadata with owner IDs and expiry;
no archive/file chunks are put there. Metadata restoration preserves completed
chapters after worker suspension. Missing or expired jobs rebuild their files from
available source snapshots. An open checkpoint can renew existing retry metadata.

The background streams each compressed file into a temporary `archive.zip`, then
writes its small central directory. ZIP headers/CRC primitives are shared with
post export through `shared/zip.js`; UTF-8 names, actual DEFLATE, and valid DOS
timestamps are preserved. The writer rejects missing files, out-of-order chunks,
and 32-bit size/offset overflow before download. ZIP64 remains unsupported; the
finished archive must fit below 4 GiB. Temporary disk quota failures are visible
and retain completed chapters for retry. There is no whole-archive RAM fallback.
Source extraction and individual EPUB/Markdown rendering still hold one chapter
in memory, so this is streaming archive construction, not fully streamed rendering.

Before download, the background obtains an explicit handoff acknowledgement from
the active collection operation, closing the Cancel race. The required offscreen
permission provides a hidden first-party extension document that gets the OPFS
File and creates its Blob URL without reading the whole file. The required
downloads permission starts that ZIP and checks only its own download IDs.
Completion/interruption revokes the URL, deletes temporary files/metadata, and
closes the hidden document when no other archive download needs it. No download
tab is opened or focused. Owner closure, Cancel, Refresh, and format changes
discard unfinished archives; files already handed to the browser stay until
completion/interruption. Expired and orphaned directories are pruned at subsequent
worker startup. These files are separate from the reusable two-hour source cache.

Evidence: Chrome/Brave fixtures use the real archive controller with a test download
handoff; a random-data archive forbids whole-file `arrayBuffer()` reads and is
checked with independent ZIP inflation, `unzip`, and macOS `ditto`. New cases cancel
disk writes and packaging, verify disk-error reporting without partial downloads,
and restore staged files across worker restart. The unpacked Brave test uses real
OPFS, the hidden document, and browser downloads in an isolated output directory;
it checks cleanup of both files and the hidden document. These are synthetic pages,
not live authenticated Patreon verification or a measured cross-browser peak-RAM
benchmark. Required APIs target current Chromium/Brave; Firefox/Safari export
compatibility is not established.

Original feature verification (1.3.9): 27 Chrome fixture tests and 28
Brave tests, including one actual unpacked-extension test; syntax and whitespace
checks passed. The installed-extension test still uses synthetic intercepted
Patreon responses, not a signed-in/live Patreon session. Mocked promise-based
`browser` API tests do not constitute Firefox-engine testing.

Following DOM-adapter extraction, 28 Chrome cases and all 29 Brave cases passed,
with one new direct adapter case. The existing visibility/discovery functions
were preserved verbatim, and the version remains 1.3.9. This refactor adds no new
Patreon feature behavior or claim of live compatibility.

See [testing history](testing-history.md) for exact release records, the one-level canvas
readback tolerance used in Brave, a prior intermittent popup-toggle failure,
and [TESTING.md](../TESTING.md) for current commands and manual validation requirements.
Chrome's command skips the Brave-only
installed test intentionally. Historical browser/OS versions in that log belong
to their recorded runs, not a guarantee about every later test environment.
Browser discovery now checks common install paths and supports explicit executable
overrides through the shared development browser configuration.
Completed testing recorded before the 1.1.1 hotfix is attributed to release
1.1.0, including live Patreon and the latest 1.1.0 changes, as confirmed by the
user on October 25, 2026. This is separate evidence from automated run records
and does not cover the subsequent hide-bar hotfix or future changes.
The confirmation does not itemize Firefox, Safari, assistive technology, real
authenticated comment submission, or every live UI variant, so specific coverage
of those areas remains unestablished. CSS uses
`color-mix()`, `:has()`, and `-webkit-text-fill-color`; assess browser support when
changing targets instead of assuming API compatibility establishes rendering.

| Version / commit | Integration knowledge established |
| --- | --- |
| 1.1.1 | Creator-prefixed post routes/main-card and responsive-title detection corrected; see test log. |
| 1.2.0–1.2.1 | Limited presets and full outer-column coverage, including wrapper padding. |
| 1.2.2 / `89eff4b` | Top action-row contrast; original full-page baseline. |
| 1.3.0 / `9c14229` | One paired Post Color control; legacy separate colors normalized. |
| 1.3.1 / `d817f5c` | Clickable parent comments and author names; plain swatches. |
| 1.3.2 / `50e7e05` | Comment-action palette introduced; important SVG-fill rule still missed. |
| 1.3.3 / `f1f9900` | Reply/More important SVG-fill rule identified and overridden with accurate regression CSS. |
| 1.3.4 / `49e81f9` | Black renamed Dark; stored color unchanged. |
| 1.3.5 / `cbbe39c` | Dark renamed Charcoal; stored color unchanged. |
| 1.3.6 / `4f363f4` | Inner CTA banner background matches page. |
| 1.3.7 / `67b2469` | Banner outline/drop shadow added for non-default colors. |
| 1.3.8 / `82fdd26` | Composer wrappers, placeholder, disabled text fill, focus and invalid borders handled. |
| 1.3.9 / `d59a994` | Composer surface deliberately darker than page; readability checks retained. |

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

Existing [fixture test suites](../tests/) and the
[installed-extension test](../tests/installed.spec.js) cover synthetic text/media,
card/outer-wrapper boundaries, responsive variants, action contrast, settings,
and lifecycle behavior. They do not replay this complete captured website.
See [TESTING.md](../TESTING.md) for the recorded browser results and validation
limits; this documentation change does not constitute new runtime validation.

## UI-change comparison procedure

Keep **native Patreon evidence**, **extension changes**, and **test evidence**
separate. A source snapshot with Reader already applied is not a native baseline.

1. Record date, browser/version/OS, extension version/commit, zoom, viewport,
   effective theme, public/member/locked context, login state, Reader enabled
   state, Post Color and other preferences. Capture a direct page load and any
   relevant client-side navigation/expanded state. Do not record session tokens.
2. Capture the affected region with Reader disabled and enabled on the same
   accessible page. Record screenshots and sanitized structural markup with
   immediate ancestors, labels/roles, state attributes, and responsive siblings.
   Expand comments only with the user's normal access; never bypass a paywall.
3. Compare page ownership and hook availability with the map/inventory here.
   Recheck same-card containment, duplicate/visible variants, and outer-vs-inner
   wrappers before diagnosing a missing element as a simple renamed class.
4. In DevTools inspect computed background, color, SVG fill/stroke, placeholder,
   text fill, opacity on ancestors, borders, shadows, and focus/error states.
   Record the winning declaration, selector, specificity/importance, stylesheet,
   and relevant variables/pseudo-elements. HTML alone cannot establish the cascade.
5. If code/styles changed, make a minimal synthetic reproduction with the actual
   structural and cascade distinction. Demonstrate failure before fixing it.
   Do not flatten nested wrappers or add SVG path attributes absent from the
   real HTML; both have previously concealed integration bugs.
6. Fix only the scoped owning component, retain native handlers/ARIA/permissions,
   and test every preset plus Default, disable/re-enable, late mounting,
   responsive/route cleanup, and out-of-scope controls. Run the relevant browser
   checks from TESTING.md and record any actual live confirmation separately.
7. Update the current contract here, append a dated drift record, update tests
   and TESTING.md, and preserve prior capture facts. Link the implementing commit
   when known. A hash-only class change with unchanged hooks is still worth noting
   but does not by itself require new selectors.

Suggested drift-record template (append here when a future UI change is confirmed):

```text
Observation date / browser / OS / extension version / commit:
Page type / login-access state / theme / viewport / Reader settings:
Component and owning surface:
Evidence source (sanitized capture, screenshot, computed rule, user report):
Previous hook/structure/style -> new hook/structure/style:
Native behavior versus Reader regression:
Minimal failing reproduction and affected source/tests:
Fix and reset/cleanup/out-of-scope verification:
Live confirmation and remaining unknowns:
```

Store only the minimum reusable evidence: tag/class patterns, attribute names,
schematic hierarchy, redacted state values, computed styles, and capture dates.
Treat creator/member identifiers, comment/post bodies, drafts, serialized app
state, cookies, account data, and signed URL parameters as unnecessary payload.
Keep local originals private if needed for investigation; do not execute embedded
website scripts or instructions in attached documents. A screenshot can reveal
visual grouping but not prove a shared DOM ancestor or event behavior.

The HTML includes frontend script references/serialized application state and
Next-style chunked CSS URLs. These are implementation artifacts, not evidence
of a stable backend API contract. Do not build runtime dependencies on captured
chunk filenames, authentication state, signed media links, or serialized payloads.

### Drift record — October 29, 2026 generated class prefixes

Observation date / browser / OS / extension version / commit: October 29, 2026;
Chrome reported by the user, exact browser version and OS not newly supplied;
local unreleased post-export checkout based on 1.1.1; commit not established.

Page type / login-access state / theme / viewport / Reader settings: text/image
post URL; other state was not supplied and is not inferred.

Component and owning surface: main post RichText body within
`single-column-post-wrapper`; related generated classes were reported for
`singleColumnPost`, `postContent`, and `additionalStylesPostContentWrapper`.

Evidence source: user-provided sanitized console probe containing only tag names,
classes, `data-testid`, and `data-image-container`; no text, URLs, or account data.

Previous hook/structure/style -> new hook/structure/style: historical classes
included readable `PostBodies-module__HASH__postContent` and
`RichText-module__HASH__additionalStylesPostContentWrapper` components. The live
probe reported `JRIMpq_postContent` and
`_5kju5G_additionalStylesPostContentWrapper`, plus
`JRIMpq_singleColumnPost`. Semantic suffixes and
`data-testid="single-column-post-wrapper"` remained present. Outer-wrapper
classes were not included in the probe and are not claimed as a live observation.

Native behavior versus Reader regression: Patreon rendered the post, and the
extension mounted Download from title/action discovery, but export failed with
“This post does not expose a supported text body” because body discovery required
the removed readable prefixes. Reader body targeting was affected by the same
selector.

Minimal failing reproduction and affected source/tests: a synthetic card now
uses the supplied generated-prefix structure. It fails the former selector and
is covered in `tests/detection.spec.js`. `patreon-dom.js` and the corresponding
surface CSS now use confirmed semantic suffixes while retaining card scoping and
outer-before-inner selection.

Fix and reset/cleanup/out-of-scope verification: targeted and complete browser
verification covers body discovery, Download generation, Reader typography,
surface selection, recommendations/comments exclusion, rerenders, and route
cleanup. No native handlers or content are changed.

Live confirmation and remaining unknowns: the pre-fix live failure and structural
difference are confirmed. Post-fix export on the affected page is pending user
retest. Full current outer-wrapper classes, other post types, responsive variants,
and computed styling remain unestablished.

## Captured hook inventory

This is the complete `data-tag`/`data-testid` value inventory from the original
full HTML attachment, recounted October 25, 2026 with script/style blocks removed.
Counts include hidden responsive variants and unrelated page regions, not just
visible elements. Capitalization is significant. This is a drift reference,
not a recommendation to use all these hooks in runtime selectors. There are
also extension-owned `data-patreon-reader-*` markers listed earlier.

| `data-tag` value | Count |
| --- | --- |
| account-menu-toggle-combined | 1 |
| action-button-desktop | 2 |
| chip-container | 13 |
| chip-icon | 11 |
| comment-actions | 2 |
| comment-avatar-wrapper | 2 |
| comment-body | 2 |
| comment-field | 1 |
| comment-field-box | 1 |
| comment-field-label | 1 |
| comment-field-with-affixes | 1 |
| comment-more-actions | 2 |
| comment-post-icon | 3 |
| comment-row | 2 |
| comment-send-avatar | 1 |
| comment-send-avatar-root | 1 |
| commenter-name | 2 |
| content-card-comment-thread-container | 1 |
| creator-header-see-membership-options | 8 |
| creator-home-horizontal-card | 12 |
| creator-home-horizontal-section | 1 |
| creator-info-desktop | 2 |
| creator-info-mobile | 2 |
| creator-sticky-nav | 1 |
| floating-engagement-sheet | 1 |
| IconArrowNe | 1 |
| IconBell | 1 |
| IconBubbleChat | 1 |
| IconBubbleOutline | 17 |
| IconChevronDownAlt | 2 |
| IconChevronLeft | 1 |
| IconChevronRight | 2 |
| IconClose | 1 |
| IconHeartOutline | 17 |
| IconLock | 11 |
| IconMenu | 2 |
| IconMore | 2 |
| IconMoreAlternate | 1 |
| IconPhone | 1 |
| IconPlus | 2 |
| IconSearch | 1 |
| IconShare | 5 |
| IconSortingArrow | 1 |
| join-for-free-button | 2 |
| like-button | 5 |
| like-count | 3 |
| logged-out-web-navigation | 1 |
| login-field | 1 |
| main-app-navigation | 1 |
| mobile-header-revamp | 1 |
| mobile-nav-hamburger-button | 2 |
| navbar | 1 |
| post-card | 1 |
| post-collections | 1 |
| post-details | 2 |
| post-title | 2 |
| share-post-icon | 5 |
| teaser-post-content | 1 |
| toaster | 1 |
| top-engagement | 2 |
| top-nav-Collections | 2 |
| top-nav-Home | 2 |
| top-nav-Membership | 2 |
| top-nav-mweb-Collections | 2 |
| top-nav-mweb-Home | 2 |
| top-nav-mweb-Membership | 2 |
| top-nav-mweb-Posts | 2 |
| top-nav-Posts | 2 |

| `data-testid` value | Count |
| --- | --- |
| cta-banner-wrapper | 1 |
| single-column-post-wrapper | 1 |

SVG icon counts are not action counts: icons appear in navigation, recommendations,
and multiple action areas. Not every action is tagged and not every tagged node
is interactive. Dynamic comment/like/collection counts and card ordering must
never become fixed runtime expectations based on this inventory.

## Not yet established

- Complete computed CSS across the page, exact native layout dimensions,
  Patreon breakpoint values, capture zoom, and image-zoom behavior. The specific
  SVG-fill/composer rules and measured disabled opacity above are established
  only for their recorded snapshot checks.
- Signed-in layouts or interactions requiring authentication; the screenshots
  show login/join affordances, not an inspected authentication session.
- Live reply expansion/collapse and comment submission, action menus, sorting,
  carousel clicks, and upward-arrow event behavior. Later screenshots establish
  expanded reply visuals, not a complete interaction model.
- Other creators, multiple inline images, native lists/headings/quotes, galleries,
  dedicated video/audio posts, and locked full-post layouts. Locked recommendation
  cards visible here are not evidence of a locked post's full layout.
- Complete live-site or browser compatibility from these captures. Mobile visuals,
  Firefox/Safari Reader behavior, and arbitrary future Patreon updates remain
  separate validation work.

No extra capture is required to use this text-and-image baseline. Extend its
evidence when the next feature or post variation actually needs it.


**November 3 large collection batches:** Discovery and prepared session metadata
now accept up to 1,000 collection posts, superseding the earlier 100-post discovery
bound recorded above. API and DOM discoveries exceeding that
bound fail visibly rather than falling back to a potentially partial collection.
The output writer retains its 100-chapter limit: the content controller processes
ordered batches and automatically hands each completed part to the browser before
starting the next. Larger collections show a numbered-parts warning in the dialog.
Markdown/EPUB separate files produce numbered ZIPs; Single EPUB produces numbered
books. Collections with at most 100 prepared posts keep the existing filenames.
ZIP chapter filenames retain global collection numbering; each book has local
chapter paths, spine, TOC and previous/next links confined to that part.

The current checkpoint identifies the total collection, offset and current part.
Retry resumes that part's failed chapters or packaging without rebuilding earlier
handed-off parts. Choosing a different format restarts at the first chapter.
Reports preserve earlier included rows; cancellation marks only remaining posts
cancelled and explicitly preserves earlier handoffs. Progress includes the part
and global chapter positions. Source cache ownership, two-hour expiry, sequential
inactive worker, encrypted retry files and disk-backed native handoff are unchanged.
No new DOM selector, access rule or permission is introduced.

Splitting is by chapter count, not adaptive byte estimates. The existing 512 MiB
source-cache and shared 1 GiB archive disk budgets remain enforced; image-heavy
parts or overlapping native downloads can still exhaust temporary space and need
manual retry after space becomes available. This does not guarantee a RAM ceiling.
Synthetic fixtures cover 101 chapters across all three formats, ordered independent
parts, later-part retry/cancellation, format changes and the discovery bound.
Worker fixtures cover metadata restore at 1,000 posts and the final indexed build.
Installed Brave regression coverage uses its smaller native-download fixture;
no live Patreon collection of more than 100 posts was inspected in this task.


**November 4 collection download results:** The report now tracks native download
completion/interruption per generated archive, superseding the earlier handoff-only
report limit above. Each numbered part is registered with its archive ID and post
URLs before packaging, so results arriving before the PACKAGE reply are retained.
Reports show In progress for handed-off files and update affected rows to Completed
or Interrupted when the worker reports a native result. Missing browser history
on worker restoration shows Status unavailable with unconfirmed rows. Per-file
results and row statuses are included in saved text reports. Included totals count
all handed-off posts; completed/interrupted totals are listed separately.

The worker notifies only the owning tab before deleting temporary archive files.
It reconciles native state after the download call and when restoring a pending
archive after restart, as well as handling downloads.onChanged events. Interruption
reasons use fixed explanations; raw browser errors, local paths and URLs are not
forwarded. Terminal results are deduplicated. The content listener accepts only
messages from the extension background context for IDs in the current report.
New attempts/Refresh/navigation/expiry discard those IDs, preventing stale events
from changing a later report. Closed dialogs retain updates while their page and
two-hour report remain alive; no new durable report storage is introduced.
Cancellation/retry of remaining parts preserves earlier terminal outcomes.

Synthetic worker fixtures cover both terminal states, cleanup, unrelated events,
restart/search reconciliation, missing history and private-error redaction.
Browser fixtures cover early completion, closed/reopened reports, saved results,
independent parts, stale sender/attempt rejection and expiry. Installed Brave
confirms Completed after a real native EPUB download; interruption/restart cases
are synthetic. No live Patreon markup, new selector, access rule or permission
was established. Browser completion confirms saving, not archive validity.


**November 4 collection chooser layout:** A supplied dark-theme screenshot showed
an internally scrolled/clipped collection chooser, plus the final checked chapter
and elapsed preparation time crowding the ready state. Current source used a
136px permission frame for a multi-section chooser. The screenshot's older ZIP-only
intro differs from the current source's book-or-ZIP copy; this is observed version
drift, not evidence of a new Patreon selector or access boundary.

The collection menu now presents three full-width actions with descriptions:
Single EPUB, individual EPUBs in a ZIP, and individual Markdown files in a ZIP.
ZIP badges and download icons distinguish their outputs. The existing permission
frame is retained; a ResizeObserver reports measured content height to the owning
panel. The panel accepts bounded integer heights only from its current frame,
extension origin and token, then acknowledges settled layout before the chooser
enables its buttons. The original direct user-gesture permission request remains
in the chooser's click handler. Escape from that frame closes the idle panel and
returns focus to the trigger. No new permissions, Patreon selectors or data reads
are introduced.

The panel has a wider desktop layout and fits narrow viewports. Preparation and
finished progress details collapse; active progress opens them. Report totals move
inside the expandable report, leaving a concise result on its summary. Refresh is
a secondary footer action. Choices remain dimmed in place during generation to
avoid repeated frame disappearance/repositioning. Initial preparation keeps the
blank frame hidden. The outer panel remains scrollable on short viewports; this
change removes clipping/scrolling inside the chooser, not every scrollbar in a
long expanded download report.

Synthetic layout cases load actual chooser assets and inspect light/dark desktop,
dark narrow layout, enlarged text, message guards, keyboard download and Escape.
Screenshots were inspected in two batches. The mechanical scan's small ZIP text
finding was corrected from 10px to 11px. Native Brave verifies repeated real EPUB,
EPUB-book and Markdown downloads. These checks do not establish live signed-in
Patreon verification or an exhaustive browser/zoom/localization matrix.


**November 4 independent UI critique (open findings):** Two isolated reviewers
inspected sanitised fixtures, not live account markup. In a 375×667 busy collection
panel, Cancel began below the visible scroll viewport while Close was disabled
and Escape kept the busy panel open; scrolling or tabbing remained a workaround.
Opening an expanded error report could similarly push Retry below the viewport.
Both reviewers reproduced collection focus remaining on the external trigger and
Tab reaching underlying links despite aria-modal=true. Reader's existing Tab
containment differs. These are extension-owned UI observations, not new Patreon
selector evidence or repaired behaviour. A measured disclosure text colour also
falls below ordinary-text contrast in both themes. The archived critique linked
from TESTING.md records priorities and limits. Runtime, CSP and permissions remain
unchanged; implementation work requires a subsequent user request.


**November 4 P1 critique remediation:** The collection tool is now explicitly a
nonmodal labelled dialog. Opening focuses the panel; dismissal restores its
trigger. Close/Escape can dismiss during work without cancelling; reopening uses
the same active operation. Cancel remains the explicit stop action. A dedicated
scrollable body leaves the action footer visible, and unavailable format choices
compact during busy work while the permission frame remains mounted. Synthetic
375×667 cases now verify Cancel and expanded-report Retry geometry. These changes
supersede the two P1 observations above; they introduce no Patreon DOM selector,
permission or cache-lifecycle change and have not yet been checked on a live page.


**November 4 P2 critique remediation and five-fix verification:** Post choices now
have associated descriptions for browser print/save PDF, ebook reading and editable
text; the post frame is 144px tall to show them. Collection descriptions include
ZIP packaging for separate files and ebook/editor use. Their button names and
format values remain unchanged. Disclosure text uses readable light/dark muted
colours; measured contrast is 6.20:1 and 7.97:1. Popup secondary copy is 12.5px.

Both original independent reviewers marked all five approved findings resolved
within their inspected fixtures, including the earlier P1 layout/nonmodal fixes.
The installed extension fixture also verifies native completion while the panel
is dismissed. This supersedes the five open critique findings' implementation
status, not the original dated score or evidence limits. The source remains a
Patreon-integrated extension with unchanged access, origin and cache policy; no
new live Patreon DOM evidence or full accessibility certification is implied.


**November 4 saved media access UI removal:** The toolbar popup now contains only
its two preference toggles and page-connection status. The saved-origin count and
Forget media access action, including their popup handlers/styles, are removed.
This supersedes the November 2 popup permission-management behavior above.
Download-triggered exact-origin permission requests, saved browser grants and
external image fetching are retained. No grant is revoked by opening the popup.
No Patreon markup, selector or Reader boundary changes are introduced. Syntax
and a Node VM popup smoke check pass; browser verification is blocked by Chrome
aborting at launch, including an elevated retry. No live Patreon check was made.


**November 4 direct PDF generation (development implementation; browser verification pending):**
PDF now generates bytes locally through packaged pdfmake 0.3.13 and bundled
Roboto fonts in a disposable worker owned by the extension's offscreen document.
The previous print iframe, native print call and temporary Patreon-title mutation
are removed. A post downloads directly as `.pdf`; collections offer Single PDF
and individual PDF files in a ZIP. Collection order, 100-post numbered parts,
1,000-post discovery bounds, source-cache reuse, encrypted retry staging and
native completion/interruption reports retain their existing contracts.

Single PDF stages validated inert chapter JSON in encrypted retry files, checks
size/CRC while inflating it, then generates a combined document with linked
contents, chapter page breaks and page numbers. It uses bounded renderer buffers;
it does not inherit EPUB's fully streamed assembly or promise a total RAM cap.
PDF ZIP renders chapters sequentially. Documents use a light A4 layout with 51pt
margins and keep creator/download-time/source metadata and embedded images.
No new Patreon selector, access rule or permission is introduced; offscreen
leases coordinate archive Blob URLs and active PDF workers. Cancellation stops
its worker and rejects late file handoffs. Rendering code/fonts are local and
library URL requests are disabled.

Limits: 24 MiB serialized input per PDF, 32 MiB PDF output, 8,192 pixels per image
side, 16 million pixels per image, 32 million raster pixels per document, and a
120-second rendering deadline. PNG inflation is separately bounded from declared
dimensions in a reproducible vendor patch, avoiding library-created Blob workers.
GIF/WebP/AVIF conversion uses browser decoding and static PNG output; SVG remains
sanitized/restricted vector content. Font coverage is the intersection of the four
bundled Roboto faces; Latin/Greek/Cyrillic fixtures pass, while unsupported glyphs
produce an explicit error rather than silently disappearing. Decoding support is
browser dependent and is not established for every image format by Node tests.

Evidence: real packaged-worker PDFs are parsed independently with PDF.js, and a
rendered sample page was visually inspected. Synthetic DOM tests drive the real
post/collection controllers through extraction, rendering, encrypted staging,
ZIP or direct-PDF handoff, failed-post retry and 101-post parts. Tooling covers
packaging retry, cancellation, restoration, owner validation, image embedding,
PNG inflation limits and shared offscreen leases. These are synthetic results,
not live Patreon or installed-extension verification. Chrome and Brave test
launches abort in the current environment before any page assertion; native
messaging/CSP, browser conversion and chooser layout still require browser QA.
The collection chooser adds two existing-style choices and raises its accepted
measured height bound from 600 to 2,048px, retaining the outer panel's scrolling
and fixed recovery controls. No rendered browser layout pass is claimed.


**November 4 Single Markdown collections:** The existing collection chooser now
offers both Single Markdown (`.md`) and Markdown ZIP, alongside its two EPUB
choices. The combined file has collection Creator/Download time/Source metadata,
a collection title and linked contents list, ordered level-two chapter titles,
per-post metadata and embedded inline images. Generated chapter anchors use local
part numbering; body headings nest under their chapter. Standalone post and
separate-file Markdown output keep their original document structure.

The controller stages each generated chapter independently and requests a validated
Markdown document mode on the existing archive job. A dedicated worker module
streams authenticated/decompressed UTF-8 chapters into disk output, checking raw
size and CRC. It uses text/markdown;charset=utf-8 for native delivery and shares
existing retry, cancellation, ownership, expiry, quota and completion cleanup.
Metadata mode/filename mismatches are rejected at creation and restoration. No
new permission, data source or Patreon DOM selector was introduced. Prepared
sources are reused; larger collections retain 100-chapter numbered parts.

Four choices at initial doubled text can exceed the previous 600px frame limit.
A failing synthetic case and independent review established this; the finite
allowance is now 1,000px while the parent scroll body remains viewport bounded.
Initial enlarged choices were rechecked at narrow and desktop sizes. Native Brave
verifies actual combined Markdown saving, embedded images and confirmed completion.
The explicit extension package allowlist includes the new writer. These are fixture
and installed-extension observations, not new live Patreon evidence.


**November 4 on-demand collection downloads:** Opening/reopening Download
Collection now displays all four format choices without collection API discovery,
Load more clicks, post descriptions or worker-tab visits. A format choice starts
URL discovery and registers metadata only (`deferred` session mode); there is no
separate all-post preflight pass. Each uncached chapter describes and exports the
same loaded document. Completed source snapshots still support other formats and
retries without network reads. Existing open matching tabs are reused. Refresh
invalidates discovery/output state; rereading starts with the next format choice.

Image hosts are discovered per chapter during that selected download. Existing
browser grants proceed automatically. Missing exact HTTPS-host grants pause for
an extension-frame Allow images and continue click while retaining the loaded
post. The frame reads required origins from the worker session; the worker checks
actual grants again before build. Token, frame origin/source, request ID and
operation checks guard the exchange. Cancel/navigation resolve pending waits and
close owned workers; dismissal/reopen retains the waiting operation. Denial stops
the attempt rather than repeatedly requesting the same host on later chapters.
No broad HTTPS grant, manifest permission or Patreon selector was added.

Unavailable/unsupported descriptions are reported as skipped during generation,
matching the previous preflight exclusion boundary. Persistent archive skip
markers distinguish them from retryable missing chapters. All output modes omit
skipped slots while preserving discovered numbering; sparse book paths/Markdown
anchors can have gaps. Single EPUB assembly repairs previous/next links and TOC,
manifest and spine for included chapters. Only a skipped-part EPUB's chapter XHTML
is buffered for navigation repair; image resources remain streamed. An entirely
skipped part produces no empty native file. Build/image/formatting failures retain
the existing retry requirement, and skipped posts are excluded from native result
membership.

Synthetic Node regressions cover no-visit registration, same-document approval,
denial/cancellation, cache hits, worker restart and skip-aware ZIP/EPUB/Markdown
assembly/navigation. Updated browser fixtures cover delayed discovery, permission
wait guards/reopen/cancel, skips, refresh, retries, batching and installed output.
Browser execution is blocked by Chrome/Brave launch aborts (SIGABRT/EPERM), even
with elevation. No rendered/native-permission or live Patreon confirmation is
claimed for this change; see TESTING.md for exact commands/results.


**November 5 export integration:** The Markdown/on-demand collection changes and
PDF changes are combined. The chooser has six options (Single EPUB/Markdown/PDF,
and individual EPUB/Markdown/PDF ZIPs), plus the existing per-chapter image
permission section. Opening still performs no discovery or post visits. PDF modes
use the deferred source pipeline and omit its persisted skipped-post slots;
collections entirely skipped in a part do not create empty downloads. Combined
PDFs include only supported chapters in order; ZIP numbering keeps discovered
positions. The finite measured chooser height bound is 2,048px, superseding the
separate four-choice 1,000px bound while preserving source/origin/token guards and
outer scrolling. No new Patreon selectors, access permissions or cache boundaries
are introduced. Synthetic tooling and independent integration review pass; the
current browser launch blocker still prevents native/layout/live confirmation.


**November 5 collection selectors:** The extension-owned collection frame now
separates Format (EPUB, PDF, Markdown) and Packaging (Single file, Separate files
(ZIP)) into labelled native radio groups, with one Download action. Its name and
accessible description update for the selected pair; changing either selection
performs no collection reads. EPUB / Single file is the initial choice. The six
existing format values and output limits are retained. The parent message
allowlist now includes both PDF values, fixing an integration omission which
otherwise disabled the chooser without starting PDF generation.

Changing the selected description can resize the bottom-anchored panel. The action
uses aria-disabled until the existing bounded frame/source/origin/token layout
acknowledgement for the current layout revision settles, preventing rapid pointer clicks from missing the moved
button while keeping it in keyboard tab order. Native radio focus stays intact.
Exporting disables all controls and retains the original image permission button
and explicit user gesture. Recovery controls remain outside the scroll body.
These observations concern synthetic extension UI, not new Patreon markup or
access rules. Existing cache, output part, origin and membership boundaries remain.

Refresh now hides an obsolete Retry action when its checkpoint has been dropped;
a failing existing browser regression established this stale extension UI state.
Fixture updates align completion reports, error injection, clock advancement and
incremental refresh checks with deferred registration. They do not alter source
fetching or cache lifetime. Native tests reuse registered synthetic post tabs and
observe actual downloads API completion; the PDF-specific fixtures use ordinary
chapter text instead of the shared 70,000-character unbroken Markdown stress word.
CDP-managed Brave output names may differ from requested names; synthetic controller
tests retain filename assertions, while installed PDF checks inspect saved bytes.
No new live Patreon inspection or real media permission-prompt coverage is claimed.
