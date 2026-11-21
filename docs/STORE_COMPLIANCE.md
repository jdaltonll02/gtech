# Pepper store compliance and privacy inventory

Last repository review: 2026-11-21. This is an engineering submission
checklist, not legal advice. The release owner must verify the live binary,
provider contracts, store forms, and laws in every launch country.

Official policy references:

- [Apple App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/)
- [Apple account-deletion guidance](https://developer.apple.com/go/?id=ar-ad-support)
- [Apple App Privacy data types](https://developer.apple.com/app-store/app-privacy-details/)
- [Google Play Developer Program Policy](https://support.google.com/googleplay/android-developer/answer/18265346)
- [Google Play account-deletion guidance](https://support.google.com/googleplay/android-developer/answer/13327111)

Policy text changes. Re-read these sources for every submission rather than
copying old console answers.

## Release decision

Pepper is **not ready for public store submission yet**. Core safety and account
lifecycle APIs exist, but the unchecked blockers below must be resolved and
verified in a release build.

## Engineering compliance matrix

| Requirement | Repository status | Release evidence/action |
|---|---|---|
| 18+ gate | Implemented: onboarding validates date of birth and the product states 18+ | Test boundary dates, set store age ratings, and document reviewer flow |
| Report, block, unmatch | Implemented in API and mobile chat safety UI | Verify access from every profile/chat surface and moderation response SLA |
| Content filtering/moderation | Provider abstraction, photo status, reports, queue, audit records exist | **Blocker:** replace development `auto_approve`; staff and escalation process must be operational |
| Published safety contact | Not configured | **Blocker:** publish support/safety contact in app, website, privacy policy, and listing |
| In-app account deletion | Implemented in mobile/web settings; immediate hiding and 30-day hard deletion | Verify worker execution, deletion confirmation/cancellation policy, subscriptions, and completion notice |
| Deletion outside Android app | Not implemented | **Blocker for Google Play:** publish an authenticated web deletion page and enter its direct URL in Play Console |
| Data export | Implemented using a 15-minute signed JSON download | Test complete export, authorization, expiry, and accessibility to the user |
| Privacy policy / terms / community rules | Auth copy has placeholder routes; mobile settings rows do not navigate | **Blocker:** publish stable HTTPS documents and wire every link |
| Digital purchases | Flutter uses store purchase APIs outside debug; backend verifies Apple/Google events | Configure products, signing keys, sandbox review accounts, restore flow, subscription disclosures, cancellation help |
| Mobile-money purchase methods | Server/web support Orange Money and MTN MoMo | Keep these out of native digital-feature checkout unless current store policy and counsel explicitly permit them |
| Sign in with Apple | Flutter dependency and iOS entitlement exist | If Google login ships on iOS, configure and test Apple login with the production service/bundle IDs |
| Permissions | Android declarations and iOS purpose strings exist | Confirm each permission is requested only in context; remove any unused declaration |
| Secure transport | Release Android does not enable cleartext | Production API/media/webhook URLs must be HTTPS; verify network security in release binary |
| Android signing | Release currently points at debug signing | **Blocker:** configure protected upload/release signing outside git |
| Push notifications | Server FCM provider exists | **Blocker if push is advertised:** add/test Flutter Firebase client wiring and store configuration |
| Original product identity | Pepper name, chili/red identity, and original copy are used | Complete trademark/name review and replace any placeholder icon/art before submission |
| Reviewer access | Seeded dev login exists only for local development | Create a stable review account or approved demo mode with clear review notes and any OTP instructions |
| Production controls | Production rejects unsafe JWT/encryption defaults and fake payment provider | Run release checklist, secret scan, provider tests, backups, monitoring, and incident drill |

Apple requires user-generated-content apps to filter objectionable material,
offer reporting and blocking, respond to concerns, and publish contact
information. Dating is also a saturated category in Apple's guidelines, so the
listing and review notes should explain Pepper's differentiated Liberia and
diaspora focus without referencing another app's trademarks.

## Data inventory for store forms

The following is derived from current migrations, repositories, and clients.
Mark data as linked to the user unless the production implementation genuinely
de-identifies it before collection and prevents relinking.

| Store data category | Pepper examples | Purpose | Retention/deletion |
|---|---|---|---|
| Contact info: phone number | OTP login identifier | Authentication, security | Deleted with account unless a documented legal/security exception applies |
| Contact info: name | Display name | Profile and personalization | Deleted with account |
| Precise location | Latitude/longitude supplied for discovery | Nearby recommendations and safety controls | Stored server-side; never returned to another client; deleted with account |
| Coarse location | County/passport locations and rounded distance output | Discovery and personalization | Deleted with account |
| Sensitive info | Gender, show-me preferences, relationship goals, optional profile attributes | Matching/personalization | Linked to account; delete with account; confirm encryption classification |
| User content: photos | Profile, chat, verification selfie | Profile, messaging, safety verification | Private object storage; associated keys removed by hard-delete worker |
| User content: messages | Text and image conversations | Core chat and safety | Linked to participants; deletion behavior must match published policy |
| Other user content | Bio, job, school, interests, languages, reports | Profile, matching, safety | Deleted/anonymized according to published lifecycle policy |
| Identifiers: user ID | UUID account and related record IDs | Core functionality, fraud prevention | Deleted with account where referential/legal retention permits |
| Identifiers: device ID/token | FCM token and app/platform metadata | Push delivery and security | Removed on unregister/account deletion; verify provider retention |
| Purchases | Products, receipts/provider references, subscription status | Entitlements, fraud prevention, accounting | State the legally required financial/audit retention separately |
| Product interaction | Swipes, likes, matches, blocks, preferences | Core matching, quotas, safety | Linked to account; deletion lifecycle applies |
| Diagnostics/security | IP address on OTP/rate-limit records and server logs | Security, abuse prevention, operations | Define short retention and access controls before launch |

Private messages count as “Emails or Text Messages” in Apple's privacy
taxonomy. Profile/chat photos count as “Photos or Videos.” Exact device
coordinates sent to Pepper should be declared as precise location even though
the application protects them from other users.

### Not currently collected by product code

The current application does not request contacts, microphone, health/fitness,
or advertising identifiers, and contains no third-party advertising SDK. Do
not declare “no tracking” solely from this document: review every production
SDK and provider before answering store forms.

### Processor/sharing review

Before submission, list every production processor and what it receives:

- SMS provider: phone number and OTP delivery metadata
- Apple/Google identity and stores: identity/purchase assertions
- Firebase: push token and notification payload/metadata
- object-storage/CDN provider: uploaded user content and access metadata
- hosting/database/Redis providers: account data and operational metadata
- error monitoring, if enabled: strictly scrubbed diagnostic data
- Orange Money/MTN MoMo on web: MSISDN and transaction metadata

Determine with counsel and each provider's contract whether a transfer is
“sharing” under the Google form or qualifies as service-provider processing.
Store answers must reflect production, not the credential-free development
configuration.

## Permissions

| Platform permission | Declared reason | Required release behavior |
|---|---|---|
| Android coarse/fine location | Nearby discovery | Ask during location onboarding, support county fallback, keep core non-location features usable |
| Android camera | Profile/verification photos | Ask when the user chooses camera capture |
| Android media images / legacy storage | User-selected profile/chat image | Use system picker where possible; verify legacy permission is limited to API 32 and below |
| Android notifications | Match/message alerts | Ask after explaining value; respect notification preferences |
| iOS camera | Profile photos and identity verification | Keep `NSCameraUsageDescription` accurate and contextual |
| iOS location when in use | Nearby discovery without sharing coordinates | Never request background location |
| iOS photo library | Selected profile/chat photos | Prefer limited picker access; add photo-library-add purpose only if saving is introduced |
| iOS notifications | User-selected match/message alerts | Request through notification APIs in context; the plist explanation does not replace runtime consent |

Take screenshots of each permission pre-prompt and system prompt for the review
record. Test denial, limited access, and later revocation.

## Account deletion verification

Apple requires account-creating apps to initiate deletion in-app; Google also
requires a readily discoverable external web route. Before submission:

- [ ] Mobile Settings → Delete account is discoverable and requires explicit confirmation.
- [ ] Web Settings deletion works for the authenticated account.
- [ ] A public HTTPS deletion URL lets an authenticated user request deletion outside Android.
- [ ] The UI explains immediate hiding, the 30-day deletion date, and how active subscriptions are cancelled separately.
- [ ] Access and refresh tokens stop working immediately.
- [ ] The account disappears from discovery, likes, matches, and chat surfaces immediately.
- [ ] The hourly worker deletes due database records and profile/chat/verification/export objects.
- [ ] Any legally retained fraud/payment/audit data is minimized and disclosed.
- [ ] The user receives a deletion-request and completion confirmation without exposing private data.

The current API's 30-day delayed hard deletion can be acceptable only if the
delay is transparent and complies with applicable law. Pause is not a substitute
for deletion.

## User-generated content and safety operations

- [ ] Production photo filtering is active before content is discoverable.
- [ ] Report and block are available wherever another user's content appears.
- [ ] Blocking immediately separates both accounts across deck, likes, matches, and chat.
- [ ] A staffed moderation queue has a published response target and emergency escalation route.
- [ ] Review actions create an immutable audit record and use least-privilege staff access.
- [ ] Community Guidelines prohibit sexual exploitation, trafficking, harassment, impersonation, scams, non-consensual imagery, and underage use.
- [ ] A process exists for urgent safety reports, evidence preservation, appeals, and lawful requests.
- [ ] Reviewer notes explain the anti-scam message warning and photo verification flow.

Do not launch with `MODERATION_PROVIDER=auto_approve`.

## Purchases and subscriptions

- [ ] Native digital subscriptions and consumables use Apple IAP / Google Play Billing.
- [ ] Products, prices, duration, auto-renewal, free-trial terms, and recurring value are clear before confirmation.
- [ ] Restore purchases works and entitlement state reconciles after reinstall/login.
- [ ] Cancellation/help links point to platform subscription management.
- [ ] Sandbox tests cover purchase, renewal, grace/expiry, cancellation, refund, replay, and provider outage.
- [ ] Store server notifications use production credentials, authenticated endpoints, and idempotent processing.
- [ ] Mobile-money checkout is confined to the web product unless explicitly approved under current store rules.
- [ ] Terms and privacy policy describe billing, refunds, and retained transaction records.

## Listing and review package

- [ ] App name, subtitle, description, screenshots, icon, and preview media are final and original.
- [ ] Description clearly differentiates the Liberia/diaspora service and does not promise unfinished features.
- [ ] Age-rating questionnaires disclose dating, messaging, user content, and potential mature themes accurately.
- [ ] Privacy Policy URL, support URL, marketing URL (if used), and Google deletion URL are public and stable.
- [ ] Privacy nutrition label and Play Data safety answers match the release binary and production providers.
- [ ] App Review receives a working account/demo, review steps, safety-flow location, purchase notes, and support contact.
- [ ] Export-controlled encryption questions and country availability are answered by the release owner.
- [ ] Accessibility, low-bandwidth, offline, and permission-denial checks pass on representative devices.

## Per-release sign-off

Record the binary version/build, commit, API revision, schema migration, store
product configuration, provider configuration, policy review date, test results,
review-account verification, privacy-form reviewer, safety-operations owner,
and final approver. Archive the completed checklist with the release record.
