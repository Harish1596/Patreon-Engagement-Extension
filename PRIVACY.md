# Privacy Policy

Last updated: October 25, 2026

Patreon Engagement Toggle (the "extension") is designed to provide its single
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
  insert Reader controls. It does not read, record, or retain post text, comments,
  messages, account details, or other page content.
- Font choices reference fonts already available on the device through CSS.
  The extension does not enumerate installed fonts, access font files, or
  download fonts.

The extension does not collect browsing history, authentication information,
financial information, personal communications, user-generated content, or
personally identifiable information.

## How Information Is Used

The locally processed pathname is used only to decide whether the extension is
on a supported post page. The locally stored preference is used only to apply
the user's selected visibility and reading appearance settings. Saved Reader
preferences are retained while Reader is disabled so they can be restored when
it is enabled again. Appearance changes affect only local display.

Information processed by the extension is not used for analytics, advertising,
profiling, tracking, or any purpose unrelated to the extension's single
purpose of improving the local Patreon post reading experience.

## Data Transmission and Sharing

The extension makes no external network requests and does not transmit data to
the developer or any third party. No information is sold, shared, or made
available for human review.

## Permissions

The extension uses the following access:

- **Storage:** Saves engagement visibility, Reader enablement, and appearance
  preferences locally in the browser.
- **Access to `https://www.patreon.com/*`:** Loads the packaged content script
  and stylesheets, identifies supported post URLs and DOM elements, hides or
  restores the floating engagement bar, and adds optional Reader controls and
  appearance styles. The extension does not access other websites.

## Retention and Deletion

Preferences remain in local extension storage until the user changes them,
clears the extension's stored data, or uninstalls the extension. Resetting Reader
replaces its appearance preferences with site defaults; it preserves the Reader
enablement and engagement visibility choices. Disabling Reader retains its
appearance preferences.
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
