# Privacy Policy

Last updated: October 18, 2026

Patreon Engagement Toggle (the "extension") is designed to provide its single
purpose without collecting or transmitting personal information. All processing
performed by the extension takes place locally in the user's browser.

## Information Processed Locally

The extension processes only the information needed to hide or show Patreon's
floating engagement bar:

- It checks the pathname of pages on `https://www.patreon.com` to determine
  whether the current page is a recognized Patreon post. The pathname is not
  recorded or retained.
- It stores one Boolean preference, `isHidden`, in the browser's local extension
  storage. This preference records whether the user wants the engagement bar to
  be hidden and contains no personal information.
- It observes page structure changes so it can respond to Patreon's client-side
  navigation. It does not read, record, or retain post text, comments, messages,
  account details, or other page content.

The extension does not collect browsing history, authentication information,
financial information, personal communications, user-generated content, or
personally identifiable information.

## How Information Is Used

The locally processed pathname is used only to decide whether the extension is
on a supported post page. The locally stored preference is used only to apply
the user's selected visibility setting.

Information processed by the extension is not used for analytics, advertising,
profiling, tracking, or any purpose unrelated to the extension's single
function.

## Data Transmission and Sharing

The extension makes no external network requests and does not transmit data to
the developer or any third party. No information is sold, shared, or made
available for human review.

## Permissions

The extension uses the following access:

- **Storage:** Saves the `isHidden` preference locally in the browser.
- **Access to `https://www.patreon.com/*`:** Loads the packaged content script
  and stylesheet, identifies supported post URLs, and hides or restores only the
  floating engagement bar. The extension does not access other websites.

## Retention and Deletion

The `isHidden` preference remains in local extension storage until the user
changes it, clears the extension's stored data, or uninstalls the extension.
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
