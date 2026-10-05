# Google Play Data safety: answer sheet

> **DRAFT.** Written from the code, to make the Play Console form faster to fill in. Google's questions
> and wording change, so read each one in the console rather than trusting this blindly. Re-check it
> whenever the app starts collecting something new. The answers must match the privacy policy.

## Does the app collect or share data? Is it encrypted? Can it be deleted?

| Question | Answer |
|---|---|
| Collects user data | Yes |
| Shares user data with third parties | No. Google (Firebase) processes data for us as a service provider, which Play does not count as sharing. Re-check this if you add ads or analytics. |
| Data encrypted in transit | Yes (HTTPS/TLS) |
| Users can request deletion | Yes, in the app (Settings → Account → Delete account) **and you must also give a web address** where people can ask for deletion without installing the app. That page doesn't exist yet. |

## Data types

| Play category → type | Collected? | Why | Optional? | Notes |
|---|---|---|---|---|
| Personal info → Name | Yes | Account management, app functionality | Required | Display name; shown to family members |
| Personal info → Email address | Yes | Account management | Required | |
| Personal info → User IDs | Yes | Account management, app functionality | Required | Firebase user id |
| Photos and videos → Photos | Yes | App functionality | Optional | Baby profile photo, activity photos. Private to the room |
| Health and fitness → Health info | **Decide** | App functionality | Optional | Feeding, diaper, sleep, bath and free-text notes about a baby. Google may treat tracking a child's care as health information. Declaring it is the cautious choice, and it becomes definite once medicine or vaccination records are added. |
| App activity → Other user-generated content | Yes | App functionality | Required for the journal | Entries and notes |
| Location | No | | | |
| Contacts, Messages, Audio, Files | No | | | Camera is used for QR scanning only; nothing is saved |
| Financial info / Purchase history | No (today) | | | Becomes "Yes" when Google Play billing ships; Play handles card details |
| Web browsing, Calendar | No | | | |
| App info and performance | No (today) | | | No crash or analytics tools yet |
| Device or other IDs | No (today) | | | No advertising ID. Becomes "Yes" if ads are added |

## Other declarations to check

- **Target audience:** adults (parents and caregivers), not children. Don't opt into the Families programme; if Play asks whether children are an audience, answer that they are not.
- **Ads:** "No ads" today. Must be changed to "Contains ads" before ads ship.
- **Account deletion:** the in-app path exists. Add the web deletion address and link to it in the Data safety form.
- **Privacy policy URL:** required. See `docs/privacy-policy-draft.md`.
- **Permissions in the manifest:** camera (QR scan), photos/media read for the picker, notifications. Each needs a clear reason in the store listing.

## Still needed before submitting

1. Host the privacy policy (and a deletion-request page) at public web addresses.
2. Decide the "Health info" answer.
3. Final app name and Android package id (cannot be changed after publishing).
4. Re-check every answer against the real app on the day you submit.
