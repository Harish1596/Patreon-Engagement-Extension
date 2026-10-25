# Patreon post-page reference: text posts with inline images

Last maintained: October 25, 2026. Current release: **1.1.0**, renumbered from
the local **1.3.9** development series without changing behavior or preferences.
Historical 1.3.x references below retain their original checkpoint numbers.
The user reports Chrome Web Store version **1.0.0**; **1.1.0** is the intended
next feature release. The temporary local 1.2.0 release number is superseded.
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
| Outer surface | `[class*="PostBodies-module__"][class*="__singleColumnContentWrapper"]` | Preferred full post-background target, including outer spacing. |
| Inner column | `[class*="PostBodies-module__"][class*="__singleColumnContent"]` | Fallback/inner surface; its substring also matches the outer wrapper. |
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

| Concern | Current implementation boundary (1.3.9) |
| --- | --- |
| Master enablement | Extension toolbar popup; not the in-page Reader panel. |
| Article typography | Marked title/body for font/size; title size is 1.5× an explicit body size. Paragraph and line-spacing rules target body content only. |
| Background | Marked outer wrapper plus known inner surfaces/body. |
| Metadata and comment foreground | Matching surface ink on selected text elements; not article font/spacing. |
| Post creator avatar | Byline avatar container receives a theme-aware outline/drop shadow for non-default colors; native shape and sizing retained. |
| Main post actions | Marked top action row; known Reader/native controls only. |
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
avatars; live confirmation on the new creator's markup is still needed.

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
| [manifest.json](../extension/manifest.json) | Patreon match scope, packaged CSS, ordered scripts, storage permission. |
| [extension.js](../extension/shared/extension.js) | Browser API adapter, validated preference schema, fixed fonts/presets, contrast and legacy-color normalization. |
| [patreon-dom.js](../extension/content/patreon-dom.js) | Patreon selectors, post discovery, and surface/action-row selection; no preference or panel state. |
| [content.js](../extension/content/content.js) | Supported-route detection, storage events, popup state messages, floating-bar visibility, batched reconciliation. |
| [reader.js](../extension/content/reader.js) | Uses the DOM adapter; owns markers, appearance state, Aa/panel lifecycle, controls, serialized saves. |
| [content.css](../extension/content/content.css) | Page-side typography, surfaces, action contrast, floating-bar hiding. |
| [popup.js](../extension/popup/popup.js) | Load/save master preferences and show page-connection status. |

The manifest loads `shared/extension.js`, `content/patreon-dom.js`, `content/reader.js`, and
`content/content.js` at document
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

No background/service-worker file or runtime network dependency is declared.
Only storage permission is requested; packaged content scripts match
`https://www.patreon.com/*` at document start. Development tools can fetch public
styles for investigation; the shipped extension itself does not fetch them.

## Verification and change history

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
Live Patreon testing across the history recorded at the time of confirmation
is completed, as confirmed by the user on October 25, 2026; this is separate
evidence from automated runs and does not cover subsequent changes automatically.
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
