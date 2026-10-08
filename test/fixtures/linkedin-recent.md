---
layout: Conceptual
monikers:
- li-lms-2025-10
- li-lms-2025-11
- li-lms-2026-01
- li-lms-2026-02
- li-lms-2026-03
- li-lms-2026-04
- li-lms-2026-05
- li-lms-2026-06
- li-lms-2026-07
- li-lms-2026-08
- li-lms-2026-09
defaultMoniker: li-lms-2026-09
versioningType: Ranged
title: Recent Marketing API Changes - LinkedIn | Microsoft Learn
canonicalUrl: https://learn.microsoft.com/en-us/linkedin/marketing/integrations/recent-changes?view=li-lms-2026-09
config_moniker_range: li-lms-2025-10 || li-lms-2025-11 || li-lms-2026-01 || li-lms-2026-02 || li-lms-2026-03 || li-lms-2026-04 || li-lms-2026-05 || li-lms-2026-06 || li-lms-2026-07 || li-lms-2026-08 || li-lms-2026-09
breadcrumb_path: /linkedin/breadcrumb/toc.json
recommendations: false
feedback_system: Standard
feedback_product_url: https://www.linkedin.com/help/linkedin/ask/dsapi
uhfHeaderId: MSDocsHeader-LinkedIn
description: LinkedIn Marketing API release changelog and breaking changes.
author: Deeksha-ramesh
ms.author: li_dramesh
ms.date: 2026-09-16T00:00:00.0000000Z
ms.topic: article
ms.service: linkedin
ms.subservice: marketing
locale: en-us
document_id: 5dc168e8-5dbc-9718-fd00-fdadfe99ae8e
document_version_independent_id: ab261610-6e48-39df-4cdf-301edca92e53
updated_at: 2026-09-16T07:33:00.0000000Z
original_content_git_url: https://github.com/MicrosoftDocs/linkedin-api-docs/blob/live/linkedin-api-docs/marketing/integrations/recent-changes.md
gitcommit: https://github.com/MicrosoftDocs/linkedin-api-docs/blob/02b3aecc68460f0b168a492a718c6e6e037c6c81/linkedin-api-docs/marketing/integrations/recent-changes.md
git_commit_id: 02b3aecc68460f0b168a492a718c6e6e037c6c81
default_moniker: li-lms-2026-09
site_name: Docs
depot_name: MSDN.linkedin-api-docs
page_type: conceptual
toc_rel: ../toc.json
feedback_help_link_type: ''
feedback_help_link_url: ''
word_count: 16308
asset_id: marketing/integrations/recent-changes
moniker_range_name: c132356d6bc754fe9fef67387f33e2b8
monikers:
- li-lms-2025-10
- li-lms-2025-11
- li-lms-2026-01
- li-lms-2026-02
- li-lms-2026-03
- li-lms-2026-04
- li-lms-2026-05
- li-lms-2026-06
- li-lms-2026-07
- li-lms-2026-08
- li-lms-2026-09
item_type: Content
source_path: linkedin-api-docs/marketing/integrations/recent-changes.md
cmProducts:
- https://microsoft-devrel.poolparty.biz/DevRelOfferingOntology/aec7dc3e-0dad-4b82-accf-63218d8767d5
spProducts:
- https://microsoft-devrel.poolparty.biz/DevRelOfferingOntology/f260444a-7ec6-4768-8e41-ad2438092724
platformId: 757729e3-60c5-ebef-c091-b3d6b7568f4d
---

# Recent Marketing API Changes - LinkedIn | Microsoft Learn

Warning

**Deprecation Notice:** The Marketing Version 202510 (Marketing October 2025) will be sunset on October 15, 2026. We recommend that you migrate to the latest [versioned APIs](../versioning) to avoid disruptions. For information on all the supported versions, refer to the [migrations](migrations#api-migration-status) documentation. If you haven’t yet migrated and have questions, submit a request on the [LinkedIn Developer Support Portal](https://www.linkedin.com/help/linkedin/ask/dsapi).

## September 2026 - Version 202609 (Latest)

### Product & Platform Announcements

- **[Company Intelligence API](../account-intel/account-intel-api#company-intelligence-filter-criteria): New `campaignGroup`, `objectiveType`, and `seniority` filters**:

    Starting with the `202609` version, the `accountIntelligence` endpoint finder now supports filtering results by the following optional fields under filterCriteria: `campaignGroup`, `objectiveType`, or member `seniority`, in addition to the existing `campaign` filter. Only one of `campaign`, `campaignGroup`, `objectiveType`, or `seniority` can be passed in the `filterCriteria` parameter. Organic metrics are 0 when campaign, campaignGroup or objectiveType filter is used. The `seniority` filter is supported only with `LAST_90_DAYS` lookback window and when `campaign`, `campaignGroup`, and `objectiveType` aren't used in the filterCriteria. These fields are request-only and do not change the response schema. Versions 202608 and below do not support these filters.
- **[Ads Reporting API](ads-reporting/ads-reporting-schema#analytics-finder-query-parameters): New `MEMBER_DESIGNATED_MARKET_AREA` pivot**:

    Starting with the `202609` version, in the `adAnalytics` endpoint's analytics finder, `pivot.value` parameter now supports `MEMBER_DESIGNATED_MARKET_AREA`, letting partners request analytics reports grouped by Nielsen Designated Market Area (DMA), consistent with other member demographic pivots such as `MEMBER_REGION_V2`. Pivot items are returned as `urn:li:geo:{id}` URNs. You may use the `/adTargetingEntities` resource to resolve these geo URNs to DMA region names. When displaying results grouped by this pivot, you must display a "circle R" notice of registration immediately following each display of the DMA marks (that is, DMA®) and the statement "DMA® is a registered service mark of The Nielsen Company."
- **[Conversions API](ads-reporting/conversions-api-schema#userinfo): New `hashedFirstName` and `hashedLastName` fields**:

    Starting with the `202609` version, the `userInfo` object for the `/conversionEvents` endpoint supports two new optional fields for matching: `hashedFirstName` and `hashedLastName`, in addition to the existing plain text `firstName` and `lastName` fields. Before hashing, normalize the value to lowercase with no spaces or punctuation, and encode special characters as UTF-8. The result should be a SHA-256 HEX-encoded string of exactly 64 characters. A valid userInfo combination requires either firstName or hashedFirstName, together with either lastName or hashedLastName.
- **[Conversions API](ads-reporting/conversions-api-schema#conversion-rule-api-schema): New 180-day attribution window option**:

    The `postClickAttributionWindowSize` and `viewThroughAttributionWindowSize` fields on the Conversion Rule schema in `/conversions` endpoint now support a `180`-day value, in addition to the existing `365`-day option, for the following conversion types: `SUBMIT_APPLICATION`, `PURCHASE`, `ADD_TO_CART`, `QUALIFIED_LEAD`, `LEAD`, `MARKETING_QUALIFIED_LEAD`, and `SALES_QUALIFIED_LEAD`. This update is available on all active versions. `MARKETING_QUALIFIED_LEAD` and `SALES_QUALIFIED_LEAD` conversion types are available starting with the `202608` version onwards.

### Version Sunset

The monthly API versions below will be sunset and removed from the platform on the dates listed. For information on all the supported versions, refer to the [migrations](migrations#api-migration-status) documentation. To avoid disruptions to your platform, please [migrate](../versioning#how-do-i-migrate-from-an-older-api-version-to-a-later-version) to the latest API version launched today.

- **202510** - Oct 15, 2026
- **202511** - Nov 16, 2026

## August 2026 - Version 202608

### Product & Platform Announcements

- **[Matched Audiences API: Generally available to all qualified developers](../matched-audiences/matched-audiences#apply-for-access)**:

    Starting August 2026, the Matched Audiences API is now generally available for application to all qualified developers. You can [apply for access](../matched-audiences/matched-audiences#apply-for-access) directly from the Developer Portal.
- **[DMP Segments API: Cap on number of DMP Segments in ad account](../matched-audiences/create-and-manage-segments#create-dmp-segment)**:

    Starting August 2026, each sponsored account is restricted to a maximum of 1,000 DMP segments for Matched Audiences (`USER`, `COMPANY`, `LIST_UPLOAD`) and Predictive Audiences. Requests to the `/dmpSegments` endpoint from ad accounts that exceed this threshold return a `429` error with the code `SEGMENT_LIMIT_EXCEEDED`. This update applies to all versions. To allocate space for additional segments, delete unused segments before creating new ones. See [Delete DMP Segment](../matched-audiences/create-and-manage-segments#delete-dmp-segment) for details.
- **[Dynamic UTM API: Ad account-level tracking parameter support](ads-reporting/dynamic-utm-tracking#create-tracking-parameters-for-a-campaign)**:

    Starting with the `202608` version, the `/adTrackingParameters` endpoint now supports setting dynamic UTM tracking parameters at the ad account level using the `sponsoredAccount` member of the `adEntity` key, in addition to the existing `sponsoredCampaign`. Account-level parameters apply to creatives across all campaigns in the account. This is an additive, backward-compatible change.
- **[Conversions API: New conversion types for Marketing & Sales Qualified Leads](ads-reporting/conversions-api-schema#conversion-rule-api-schema)**:

    Starting with the `202608` version, the `/conversions` endpoint now supports `MARKETING_QUALIFIED_LEAD` and `SALES_QUALIFIED_LEAD` as granular conversion types in addition to the existing `QUALIFIED_LEAD`. Conversion events streamed on conversion rules with these new types are used in the qualified leads optimization goal for deeper funnel campaign optimization, similar to `QUALIFIED_LEAD`. See [Qualified leads optimization goal](https://www.linkedin.com/help/lms/answer/a6553958) for details.
- **[Conversions API: Additional use cases](../conversions/conversions-usecase)**:

    Additional use cases published for the Conversions API, including qualified leads optimization, retargeting audiences, source data for predictive audiences, and conversion lift testing.
- **[Ad Accounts API: New `productType` and `originatingCustomer` fields](ads/account-structure/create-and-manage-accounts#schema)**:

    Starting with the `202608` version, the `/adAccounts` endpoint returns `productType` (`MARKETING_SOLUTIONS`, `TALENT_SOLUTIONS`, `LINKEDIN_ON_LINKEDIN`) and `originatingCustomer` (a `urn:li:customer:{id}` URN). Both fields apply to ENTERPRISE accounts only and are immutable once set at account creation. This is an additive, backward-compatible change.
- **[Campaign Groups API: New billing, beneficiary, and buying type fields](ads/account-structure/create-and-manage-campaign-groups#schema)**:

    Starting with the `202608` version, the `/adCampaignGroups` endpoint supports `billingReference`, `billingParentReference`, `beneficiaryReference` (a union of `company` or `organization`), and `buyingType` (`AUCTION` or `RESERVATION`). All four fields are immutable once set at campaign group creation; `billingReference` and `billingParentReference` apply to ENTERPRISE accounts only. In earlier versions, these fields are rejected with a `422` error. This is an additive, backward-compatible change.

### Version Sunset

The monthly API versions below will be sunset and removed from the platform on the dates listed. For information on all the supported versions, refer to the [migrations](migrations#api-migration-status) documentation. To avoid disruptions to your platform, please [migrate](../versioning#how-do-i-migrate-from-an-older-api-version-to-a-later-version) to the latest API version launched today.

- **202508** - Aug 17, 2026
- **202509** - Sep 15, 2026
- **202510** - Oct 15, 2026

### Reminders

Starting Aug 31, 2026, LinkedIn will completely stop supporting Legacy Geo for Ads Targeting. Requests to create campaigns using legacy geo will result in a `400` error with the `INVALID_VALUE_FOR_FIELD` code. All partners and developers must use Bing-geo as previously published in this [migration guide](ads/advertising-targeting/bing-geo-migration-guide).

The top-level `location` field (for example, "San Francisco Bay Area") is also being removed from `/v2/me` and `/v2/people` responses. Partners currently relying on `location` may begin receiving an empty or null value and should migrate to the `geoLocation` field (for example, request `projection=(geoLocation(geo~,autoGenerated))`), which is already available on both endpoints. See the [Profile API](../../shared/integrations/people/profile-api#location-display-name) documentation for guidance on using `geoLocation` with the `geo~` projection to retrieve the location display name.

## July 2026 - Version 202607

### Product & Platform Announcements

- **[Predictive Audiences API: id field available in the response](../matched-audiences/predictive-audiences#predictive-audience)**:

    Starting version `202607`, fetching a Predictive Audience (single or list) now returns its read-only `id`. Partners can now obtain the `id` for audiences created in Campaign Manager or the API, and use it to update them.
- **[Conversions API: New user identifier available for matching](ads-reporting/conversions-api-schema#idtype)**:

    A new optional user identifier `SHA256_IP_ADDRESS` is available in the `userIds` object in the Conversion Event User Schema for `/rest/conversionEvents` to match with the hashed IP address of the user using SHA256. This update is available on all active versions. This is in addition to the existing `PLAINTEXT_IP_ADDRESS` already available in plain text format. Currently, only IPv4 addresses are supported.
- **[Create and Manage Campaigns: creativeSelection in SPONSORED_INMAILS type campaigns with LEAD_GENERATION objective for Message & Conversation Ads](ads/account-structure/create-and-manage-campaigns#optimization-based-on-objectivetype)**:

    Starting July 2026, the `adCampaigns` API will support, as the default, `OPTIMIZED` for `creativeSelection` in `SPONSORED_INMAILS` type campaigns (Message Ads and Conversation Ads) with the `LEAD_GENERATION` objective. Previously, this combination was rejected with a 400 validation error and forced to `ROUND_ROBIN`. If your integration creates or updates `SPONSORED_INMAILS` campaigns with the `LEAD_GENERATION` objective without explicitly setting `creativeSelection`, the behavior will default to `OPTIMIZED` starting with the July 2026 release and will apply to all versions. To preserve even ad rotation, explicitly set `creativeSelection` as `ROUND_ROBIN`. Note: `OPTIMIZED` is only valid for the `SPONSORED_INMAILS` type with the `LEAD_GENERATION` objective — all other objectives in this type still reject it with a 400 error.

### Version Sunset

The monthly API versions below will be sunset and removed from the platform on the dates listed. For information on all the supported versions, refer to the [migrations](migrations#api-migration-status) documentation. To avoid disruptions to your platform, please [migrate](../versioning#how-do-i-migrate-from-an-older-api-version-to-a-later-version) to the latest API version launched today.

- **202507** - Jul 15, 2026
- **202508** - Aug 17, 2026
- **202509** - Sep 15, 2026

## June 2026 - Version 202606

### Product & Platform Announcements

- **[Company Intelligence API: 365-Day Lookback and Company Attribute Decoration](../account-intel/account-intel-api#company-intelligence-filter-criteria)**:

    Starting with the version 202606, the `/accountIntelligence` endpoint adopts the following changes:

    - **filterCriteria.lookbackWindow**: A new value `LAST_365_DAYS` is now supported alongside the existing `LAST_7_DAYS`, `LAST_30_DAYS`, `LAST_60_DAYS`, `LAST_90_DAYS`, and `LAST_180_DAYS`. When supplied, engagement and conversion metrics are aggregated over the trailing 365 days from the data calculation date, giving partners a full year of engagement history per target company. Versions 202605 and earlier continue to cap the window at **180** days.
    - **companySize**: A `StaffCountRange` enum field representing the range of the number of staff employed by the target company. Possible values are: `SIZE_1`, `SIZE_2_TO_10`, `SIZE_11_TO_50`, `SIZE_51_TO_200`, `SIZE_201_TO_500`, `SIZE_501_TO_1000`, `SIZE_1001_TO_5000`, `SIZE_5001_TO_10000`, and `SIZE_10001_OR_MORE`. The field is response-only, included in the default projection, and defaults to `$UNKNOWN` when the target company has not declared a staff size.
    - **industry**: An `IndustryUrn` field identifying the industry the target company is associated with based on its primary business activities and products (e.g., urn:li:industry:1). The field is response-only, included in the default projection, and defaults to `urn:li:industry:0` when no industry has been assigned.
    - **countryCode**: A string field representing the ISO country code of the target company's headquarters (e.g., "US", "GB"). The field is response-only, included in the default projection, and defaults to an empty string when the headquarters country is not available.
    - **costInLocalCurrencyPerPaidQualifiedLead**: A double type field representing the cost per paid qualified lead (CPQL) attributed to the target company, in the advertiser's local currency. Derived as the ratio of total ad spend over the number of paid qualified leads collected from members of the target company within the lookback window. The field is response-only, included in the default projection, and defaults to 0.0 when no paid qualified leads have been attributed to the target company within the lookback window.
- **[Dynamic UTM API](ads-reporting/dynamic-utm-tracking#create-tracking-parameters-for-a-campaign)**: **Added dynamic tracking parameter support for CREATIVE\_NAME**:

    Starting with the version `202606`, the `/adTrackingParameters` endpoint now supports `CREATIVE_NAME` in addition to existing parameter values in `dynamicTrackingParameters` field. This will allow advertisers to track creative names along with their creative ID using Dynamic UTM that uses placeholder parameters which are automatically replaced with relevant values when an ad is served. Within Campaign Manager, this is already available within the URL tracking parameters under the Placement tab as `{{CREATIVE_NAME}}`.
- **[Conversation Ads API](ads/advertising-targeting/version/conversation-ads-integrations)**: **Not Interested Call-to-Action (CTA)**:

    A **Not Interested CTA** is automatically rendered on the `firstMessageContent` for `SponsoredConversations`. The CTA is applied to new and existing ads at render time and is not exposed in the API. Use test sends to preview the behavior. For ads created from Campaign Manager, GET requests to `/conversationAds/{sponsoredConversationURN}/sponsoredMessageContents` will now return a new `NOT_INTERESTED` value in the `replyType` field.
- **[Message Ads API](ads/advertising-targeting/version/message-ads-integrations#schema)**: **Not Interested Call-to-Action (CTA)**

    A **Not Interested CTA** is automatically rendered on **Message Ads**. The CTA is applied to new and existing ads at render time and is not exposed in the API. Use test sends to preview the behavior.

### Version Sunset

The monthly API versions below will be sunset and removed from the platform on the dates listed. For information on all the supported versions, refer to the [migrations](migrations#api-migration-status) documentation. To avoid disruptions to your platform, please [migrate](../versioning#how-do-i-migrate-from-an-older-api-version-to-a-later-version) to the latest API version launched today.

- **202506** - Jun 15, 2026
- **202507** - Jul 15, 2026
- **202508** - Aug 17, 2026

### Reminders

- **Change to Developer Support path**: Please contact **Developer Support** via the [Developer Support Request Form](https://www.linkedin.com/help/linkedin/ask/dsapi). This will be the primary way to reach Developer Support going forward. The Zendesk support path will sunset on June 30th. Please use the form for all new requests as we transition.
