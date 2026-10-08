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
title: LMS API Documentation Versioning - LinkedIn | Microsoft Learn
canonicalUrl: https://learn.microsoft.com/en-us/linkedin/marketing/versioning?view=li-lms-2026-09
config_moniker_range: li-lms-2025-10 || li-lms-2025-11 || li-lms-2026-01 || li-lms-2026-02 || li-lms-2026-03 || li-lms-2026-04 || li-lms-2026-05 || li-lms-2026-06 || li-lms-2026-07 || li-lms-2026-08 || li-lms-2026-09
breadcrumb_path: /linkedin/breadcrumb/toc.json
recommendations: false
feedback_system: Standard
feedback_product_url: https://www.linkedin.com/help/linkedin/ask/dsapi
uhfHeaderId: MSDocsHeader-LinkedIn
description: LinkedIn API
ms.author: li_dramesh
ms.date: 2026-09-16T00:00:00.0000000Z
author: Deeksha-ramesh
ms.topic: article
ms.service: linkedin
ms.subservice: marketing
locale: en-us
document_id: f72e7fd8-7447-2092-7e00-1fa2acfb8a5a
document_version_independent_id: f72e7fd8-7447-2092-7e00-1fa2acfb8a5a
updated_at: 2026-09-16T07:33:00.0000000Z
original_content_git_url: https://github.com/MicrosoftDocs/linkedin-api-docs/blob/live/linkedin-api-docs/marketing/versioning.md
gitcommit: https://github.com/MicrosoftDocs/linkedin-api-docs/blob/02b3aecc68460f0b168a492a718c6e6e037c6c81/linkedin-api-docs/marketing/versioning.md
git_commit_id: 02b3aecc68460f0b168a492a718c6e6e037c6c81
default_moniker: li-lms-2026-09
site_name: Docs
depot_name: MSDN.linkedin-api-docs
page_type: conceptual
toc_rel: toc.json
feedback_help_link_type: ''
feedback_help_link_url: ''
word_count: 946
asset_id: marketing/versioning
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
source_path: linkedin-api-docs/marketing/versioning.md
platformId: 2348449f-d96b-67a6-b79d-ee561d0190a1
---

# LMS API Documentation Versioning - LinkedIn | Microsoft Learn

Warning

**Deprecation Notice:** The Marketing Version 202510 (Marketing October 2025) will be sunset on October 15, 2026. We recommend that you migrate to the latest [versioned APIs](versioning) to avoid disruptions. For information on all the supported versions, refer to the [migrations](integrations/migrations#api-migration-status) documentation. If you haven’t yet migrated and have questions, submit a request on the [LinkedIn Developer Support Portal](https://www.linkedin.com/help/linkedin/ask/dsapi).

[![Try in Postman](../media/postman-button.png)](https://www.postman.com/linkedin-developer-apis/workspace/linkedin-marketing-solutions-versioned-apis/overview)

## Overview

LinkedIn Marketing APIs use versioning to provide stable and reliable integrations, even as new features are added. Versioning helps you plan, test, and update your integrations seamlessly, ensuring your applications keep working as the APIs evolve.

## Latest Version

| Version Name | Version Header |
| --- | --- |
| September 2026 | 202609 |

## What’s changing

LinkedIn’s Marketing APIs first versioned API release was June 2022 under a new base path: `https://api.linkedin.com/rest/`

Our versioned API releases follow a monthly cycle. These API versions are supported and stable for a minimum of one year before sunset. The LinkedIn Marketing API Program supports versioning so API partners can release changes over time. This document explains how to use versioned APIs.

### Why are our APIs versioned?

![GA May Versioning](../media/version-access-flow.png)

LinkedIn continuously improves our products, which means our APIs also evolve. We want our API partners to trust in stable integrations and reliable change schedules, so they can plan and execute more effectively.

### How your API client should use versioning

HTTP headers are used for clients to indicate which API version implementation they expect. Include a request header with the key “Linkedin-Version” and set the value to the version (format: YYYYMM) to correspond with the documentation version you are referencing. Example: “Linkedin-Version: 202601” would indicate that you are using the version published in the month of January.

```curl
curl -X POST 'https://api.linkedin.com/rest/adCampaigns' \
-H 'X-Restli-Protocol-Version: 2.0.0' \
-H 'Authorization: Bearer {INSERT_TOKEN}' \
-H 'Content-Type: application/json' \
-H 'Linkedin-Version: 202601' \
--data '{
    "account": "urn:li:sponsoredAccount:123212321",
    "audienceExpansionEnabled": false,
    }'
...
```

### Version Headers

In many cases, the URL resource paths your integration uses may not change across versions, but the behavior of the individual API methods can change. New parameters or fields may be available on the response schemas.

The API changes must include the Version Header for the version (release) that needs to be adopted. For the January 2026 Release, the versioned header would be: `"Linkedin-Version": "202601"`. Version headers are tied to the LinkedIn Marketing Solutions release year and month. The following table includes examples of version headers for recent versions:

| Version | Version Header Values |
| --- | --- |
| November 2025 | "Linkedin-Version": "202511" |
| October 2025 | "Linkedin-Version": "202510" |
| September 2025 | "Linkedin-Version": "202509" |

### Versioned API Docs

Each version of the LinkedIn Marketing API Program has distinct and comprehensive documentation covering all supported APIs. Each version includes a [changelog](integrations/recent-changes) that lists all changes from the previous version, indicating which resources have been updated or added. Initially, users have the option on each page in the marketing folder to view: Versioned content: “Marketing {Month} 202X”. The following image is an example of how to select the versioned content in the documentation.

![GA November Example Image](../media/version-dropdown.jpg)

## Version Cadence

LinkedIn Marketing API Program publishes new versions monthly, and those versions are supported for a minimum of one (1) year.

Individual API resources can evolve at different times (e.g. a reporting API may be updated one quarter a year). Each API resource has its own migration guide to help you navigate major updates.

You can choose to integrate with the newest API changes as they are released or wait until you are ready - ensure it is within the one year change API support window.

## Expectations

### No unversioned calls

LinkedIn expects every versioned API call to specify a version; the latest version is not applied by default. It is important to us that customers have the best possible experience with LinkedIn integrations. It is likely that customers have a great experience when the integration is being regularly maintained (at least once per year).

### Breaking Change Exceptions

At times, LinkedIn may need to change APIs within the supported stable window.

LinkedIn reserves the right to release a patch version to any API if required for any critical security, privacy issues, or bug fixes. While the likelihood of these scenarios is minimal, we work closely with partners to minimize the impact of any breaking changes.

## Frequently Asked Questions

### Which versions can I use?

Use any version that has not been sunset. The documentation reflects all available API versions.

### How do I migrate from an older API version to a later version?

To migrate your app from an older version to a later version, simply update the older version‘s `YYYYMM` formatted value in the header to the newer version’s value. For example, here’s how you can migrate from the January 2025 version to the January 2026 version.

```curl
-H ‘Linkedin-Version: 202501’  to  -H ‘Linkedin-Version: 202601’
```

Reasons for migrating to a later version include:

- Avoiding service disruptions; it is important to upgrade to a newer supported version before the older version is no longer supported. We are committed to supporting each version for a minimum of one year.
- Utilizing new features that are not accessible in the older version.

### Which version of the API should I migrate to?

While you can migrate to any later version of the API, migrating to the latest version comes with the following benefits:

- You can take advantage of all of our latest features.
- You have the option to wait up to one year before having to migrate again.

### What happens if the Version Header is missing in the request?

An error response is returned when the version header is missing in the request. Refer to the sample response [here](error-responses#example-4-version-header-is-missing-in-the-request).

### What happens if a deprecated Version Header is used in the request?

An error response is returned when the version header is deprecated (e.g., 202401). Refer to the sample response [here](error-responses#example-5-version-header-is-deprecated).