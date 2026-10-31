# Privacy Policy

Last updated: October 31, 2026

Patreon Reader (the "extension") is designed to provide its single
purpose without collecting or transmitting personal information. All processing
performed by the extension takes place locally in the user's browser.

## Information Processed Locally

The extension processes only the information needed to hide or show Patreon's
floating engagement bar and apply optional reading appearance preferences:

- It checks the pathname of pages on `https://www.patreon.com` to determine
  whether the current page is a recognized Patreon post. The pathname is not
  recorded or retained.
- It stores the Boolean `isHidden` preference, the Boolean `readerEnabled`
  preference, and a `readerPreferences` object in local extension storage. The
  object contains the selected system-font identifier, text size, paired Post
  Color preset, paragraph spacing, and line spacing. Legacy separate colors are
  read for migration and replaced on the next settings change. These settings contain
  no post identifiers, creator identifiers, or personal information.
- It observes page structure changes and inspects DOM attributes and hierarchy
  to locate the post title, body, and action row, respond to navigation, and
  insert Reader and Download controls.
- When the user explicitly exports a post, it temporarily processes the rendered
  post title, displayed creator name, source URL, formatted body, links, and
  inline-image URLs in memory to create the selected PDF, EPUB, or Markdown
  output. PDF also records the local export time. It excludes comments and
  surrounding page UI and does not retain a copy after generating the local file.
- When the user explicitly exports a collection, it reads the post links rendered
  in that collection and temporarily opens or reuses those Patreon post pages to
  create separate EPUB or Markdown files inside one local ZIP. Extension-created
  tabs are closed after packaging or cancellation. The extension does not request
  broad browser-history or tab-access permission.
- To embed remote inline images, it asks the browser for access to the exact
  image origins used by that post. After permission is granted, the locally
  installed extension fetches those image bytes directly from the media origin.
  It rejects non-HTTPS sources and does not send post content or image data to
  the developer or an intermediary service.
- Font choices reference fonts already available on the device through CSS.
  The extension does not enumerate installed fonts, access font files, or
  download fonts.

The extension does not collect browsing history, authentication information,
financial information, personal communications, user-generated content, or
personally identifiable information. Content selected for export is processed
locally at the user's request, not collected by the developer.

## How Information Is Used

The locally processed pathname is used only to decide whether the extension is
on a supported post page. The locally stored preference is used only to apply
the user's selected visibility and reading appearance settings. Saved Reader
preferences are retained while Reader is disabled so they can be restored when
it is enabled again. Appearance changes affect only local display.

Information processed by the extension is not used for analytics, advertising,
profiling, tracking, or any purpose unrelated to improving the local Patreon
reading and offline-export experience.

## Data Transmission and Sharing

The only feature-initiated network requests are user-approved retrievals of the
inline image URLs already displayed in the post being exported. Those requests
go directly from the user's browser to the image origin. The extension does not
transmit exported post content or images to the developer, analytics services,
or any other intermediary. No information is sold, shared, or made available
for human review by the developer.

## Permissions

The extension uses the following access:

- **Storage:** Saves engagement visibility, Reader enablement, and appearance
  preferences locally in the browser.
- **Access to `https://www.patreon.com/*`:** Loads the packaged content script
  and stylesheets, identifies supported post URLs and DOM elements, hides or
  restores the floating engagement bar, adds Reader/export controls and appearance
  styles, and locally processes user-selected post or collection exports.
- **Optional media-origin access:** Requested only after the user chooses an
  export containing remote inline images. The prompt is limited to the exact
  HTTPS origins found in that post body and allows the extension to retrieve
  image bytes for local embedding. Denying the request cancels the export.

## Retention and Deletion

Preferences remain in local extension storage until the user changes them,
clears the extension's stored data, or uninstalls the extension. Resetting Reader
replaces its appearance preferences with site defaults; it preserves the Reader
enablement and engagement visibility choices. Disabling Reader retains its
appearance preferences.
An approved optional media-origin permission may remain in the browser's extension
settings until the user revokes it or uninstalls the extension. The extension
uses that access only when the user starts another export
containing an image from the same origin.
No remotely stored data exists because the extension does not operate a server
or transmit information elsewhere.

## Security

All executable code and styles are packaged with the extension. The extension
does not download or execute remotely hosted code.

## Third-Party Services

The extension operates on Patreon webpages but is not affiliated with, endorsed
by, or sponsored by Patreon. A user's interaction with Patreon remains subject
to Patreon's own terms and privacy practices.

## Changes to This Policy

This policy may be updated if the extension's functionality or data practices
change. Updates will be published in this repository with a revised "Last
updated" date.

## Contact

Questions about this policy can be submitted through the project's
[GitHub issue tracker](https://github.com/Harish1596/Patreon-Engagement-Extension/issues).
