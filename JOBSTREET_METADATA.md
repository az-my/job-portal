# JobStreet Fetchable Metadata Catalog

Verified: **2026-07-10**, JobStreet Indonesia, locale `id-ID`, zone `asia-4`.

This catalog covers fields observed in JobStreet's current first-party
`JobSearchV6` and `jobDetails` queries. It is not the entire private GraphQL schema:
JobStreet disables introspection. `Anonymous` means a live request returned the
field without a bearer token or authenticated account cookies. Conditional fields
may legitimately be `null` or empty for a particular listing.

## Collection Model

| Stage | Operation | Requests | Purpose |
|---|---|---:|---|
| Discovery | `JobSearchV6` | 1 per page | IDs, ordering, teaser, public salary, logo, facets and search metadata |
| Enrichment | `jobDetails` | 1 per new job | Full description, expiry, rich branding, screening questions and company metadata |

## Search Result Envelope

| Key path | Type / example | Description | Access |
|---|---|---|---|
| `jobSearchV6.totalCount` | `59570` | Total matching listings at request time | Anonymous |
| `jobSearchV6.userQueryId` | string | Server search correlation ID | Anonymous |
| `jobSearchV6.isQueryModified` | boolean | Whether JobStreet rewrote the submitted query | Anonymous |
| `jobSearchV6.canonicalCompany.id` | string | Canonical company match for company-oriented searches | Conditional |
| `jobSearchV6.canonicalCompany.description` | string | Canonical company display name | Conditional |
| `jobSearchV6.solMetadata` | JSON/scalar | Search optimization/tracking metadata | Anonymous, internal |
| `jobSearchV6.info.experiment` | string/null | Search experiment assignment | Conditional |
| `jobSearchV6.info.newSince` | string/number | Freshness boundary used by the result | Conditional |
| `jobSearchV6.info.source` | string | Search execution source | Anonymous |
| `jobSearchV6.info.timeTaken` | number | Server-side search duration | Anonymous |

## Search Listing Fields

| Key path | Type / example | Description | Access |
|---|---|---|---|
| `data[].id` | `"93254405"` | JobStreet job ID and deduplication key | Anonymous |
| `data[].title` | string | Displayed job title | Anonymous |
| `data[].teaser` | string | Short search-card description | Anonymous |
| `data[].bulletPoints[]` | string[] | Paid-product selling points | Conditional |
| `data[].advertiser.id` | string | Advertiser/account ID | Anonymous |
| `data[].advertiser.description` | string | Advertiser display name | Anonymous |
| `data[].companyName` | string/null | Canonical company name when resolved | Conditional |
| `data[].companyProfileStructuredDataId` | number/null | Internal company structured-data reference | Conditional |
| `data[].employer.companyUrl` | URL/null | Absolute JobStreet company profile URL | Conditional |
| `data[].employer.relativeCompanyUrl` | path/null | Relative company profile URL | Conditional |
| `data[].employer.zone` | string/null | Company profile market zone | Conditional |
| `data[].branding.serpLogoUrl` | URL/null | Search-results company logo | Conditional |
| `data[].salaryLabel` | string | Public salary display text; often empty | Anonymous |
| `data[].currencyLabel` | string/null | Salary currency display label | Conditional |
| `data[].listingDate.dateTimeUtc` | ISO timestamp | Actual listing timestamp | Anonymous |
| `data[].listingDate.label` | string | Localized relative date such as “hari ini” | Anonymous |
| `data[].locations[].countryCode` | `"ID"` | ISO country code | Anonymous |
| `data[].locations[].label` | string | Display location | Anonymous |
| `data[].locations[].seoHierarchy[].contextualName` | string[] | Location hierarchy from granular to broad | Anonymous |
| `data[].classifications[].classification.id` | string | Classification ID | Anonymous |
| `data[].classifications[].classification.description` | string | Classification label | Anonymous |
| `data[].classifications[].subclassification.id` | string | Subclassification ID | Anonymous |
| `data[].classifications[].subclassification.description` | string | Subclassification label | Anonymous |
| `data[].workTypes[]` | string[] | Full time, part time, contract, etc. | Anonymous |
| `data[].workArrangements.displayText` | string/null | Remote/hybrid/on-site display text | Conditional |
| `data[].roleId` | string/null | Normalized role identifier | Conditional |
| `data[].displayType` | string | Standard/promoted/premium presentation | Anonymous |
| `data[].isFeatured` | boolean | Featured listing flag | Anonymous |
| `data[].tags[].label` | string | Localized badge label | Conditional |
| `data[].tags[].type` | string | Badge code such as `EARLY_APPLICANT` | Conditional |
| `data[].tracking` | string/JSON | Per-result tracking reference | Anonymous, internal |
| `data[].solMetadata` | JSON/scalar | Ranking, section and request metadata | Anonymous, internal |
| `data[].externalReferences[].id` | string | External entity/reference ID | Conditional |
| `data[].externalReferences[].sourceSystem` | string | Originating system | Conditional |
| `data[].externalReferences[].type` | string | Reference type | Conditional |
| `data[].externalReferences[].metadata.name` | string | Referenced profile/person name | Conditional |
| `data[].externalReferences[].metadata.assets.profilePhotoUrl` | URL/null | Referenced profile photo | Conditional; review privacy |

## Search Facets And Suggestions

| Key path | Type | Description | Access |
|---|---|---|---|
| `facets.distinctTitle[].{id,label,count}` | object[] | Title facet and matching count | Anonymous |
| `facets.location[].id` | string | Location facet ID | Anonymous |
| `facets.location[].count` | number | Matching jobs in location | Anonymous |
| `facets.location[].label[].{lang,text}` | object[] | Localized location labels | Anonymous |
| `queryParamLabels.keywords` | string/null | Display form of submitted keywords | Anonymous |
| `queryParamLabels.locations[].kind` | string | Location label type | Conditional |
| `queryParamLabels.locations[].contextualName.text` | string | Resolved location text | Conditional |
| `queryParamLabels.locationsHierarchy[].kind` | string | Hierarchy level/type | Conditional |
| `queryParamLabels.locationsHierarchy[].label.text` | string | Hierarchy display label | Conditional |
| `sortModes[].{name,value,isActive}` | object[] | Supported sorting choices and active choice | Anonymous |
| `suggestions.asyncPillsToken` | string/null | Token for asynchronously loaded filter pills | Conditional |
| `suggestions.company[].count` | number | Suggested-company match count | Conditional |
| `suggestions.company[].search.{companyName,keywords}` | object | Suggested company search parameters | Conditional |
| `suggestions.location[].{description,whereId}` | object[] | Suggested locations | Conditional |
| `suggestions.pills[].{label,keywords,isActive}` | object[] | Suggested search refinements | Conditional |
| `suggestions.relatedSearches[].{keywords,totalJobs}` | object[] | Related searches and counts | Conditional |
| `suggestions.showSABFilter` | boolean | UI filter visibility flag | Anonymous |

## Search Execution And Intent

These objects reveal what the server actually executed and can be used to audit
silent query rewriting.

| Key path | Type | Description | Access |
|---|---|---|---|
| `searchExecuted.classification` | string/null | Executed classification filter | Anonymous |
| `searchExecuted.companyName` | string/null | Executed company filter | Anonymous |
| `searchExecuted.dateRange` | string/null | Executed date window | Anonymous |
| `searchExecuted.distance` | number/null | Executed distance | Anonymous |
| `searchExecuted.keywords` | string/null | Executed keywords | Anonymous |
| `searchExecuted.minSalary` | number/null | Requested minimum salary filter, not a job salary | Anonymous |
| `searchExecuted.maxSalary` | number/null | Requested maximum salary filter, not a job salary | Anonymous |
| `searchExecuted.salaryType` | string/null | Requested salary interval/type | Anonymous |
| `searchExecuted.sortMode` | string/null | Actual sorting mode | Anonymous |
| `searchExecuted.tags` | string[]/null | Executed badge/tag filters | Anonymous |
| `searchExecuted.where` | string/null | Executed location text | Anonymous |
| `searchExecuted.workArrangement` | string/null | Executed arrangement filter | Anonymous |
| `searchExecuted.workTypes` | string[]/null | Executed work-type filters | Anonymous |
| `intentSuggestions[].{id,type,count}` | object | Suggested interpreted intent | Conditional |
| `intentSuggestions[].label.{defaultText,lang}` | object | Localized intent label | Conditional |
| `intentSuggestions[].params.*` | object | Suggested query parameters, including salary and work filters | Conditional |
| `location.{whereId,type,description}` | object | Resolved search location | Conditional |
| `location.defaultDistanceKms` | number | Default radius for resolved location | Conditional |
| `location.isGranular` | boolean | Whether resolved location is granular | Conditional |
| `location.localisedDescriptions[]` | object[] | Localized contextual location names | Conditional |

`searchParams` also echoes the internal normalized request. Observed keys include
advertiser/company IDs, classification/subclassification, date range, distance,
duplicates, encoded URL, engine configuration, facets/include lists, job ID,
keywords, locale, listing-date bounds, page/page size, salary range/type, site key,
sort mode, tags, user/query/session IDs, location IDs, work arrangement and work
type. These are request diagnostics, not attributes of an individual job.

## Detail Job Fields

| Key path | Type / example | Description | Access |
|---|---|---|---|
| `jobDetails.job.sourceZone` | string | Source market zone | Anonymous |
| `jobDetails.job.id` | string | Job ID | Anonymous |
| `jobDetails.job.title` | string | Full job title | Anonymous |
| `jobDetails.job.abstract` | string | Short job summary | Anonymous |
| `jobDetails.job.content(platform: WEB)` | HTML | Full advertisement content | Anonymous |
| `jobDetails.job.content2(zone: "asia-4")` | HTML | Full content through click-to-reveal path | Anonymous |
| `jobDetails.job.status` | `"Active"` | Listing status | Anonymous |
| `jobDetails.job.isExpired` | boolean | Whether listing is expired | Anonymous |
| `jobDetails.job.expiresAt.dateTimeUtc` | ISO timestamp | Listing expiry | Anonymous |
| `jobDetails.job.listedAt.dateTimeUtc` | ISO timestamp | Listing publication time | Anonymous |
| `jobDetails.job.listedAt.label` | string | Localized relative publication label | Anonymous |
| `jobDetails.job.isLinkOut` | boolean | Application leaves JobStreet | Anonymous |
| `jobDetails.job.isVerified` | boolean | Job/advertiser verification signal | Anonymous |
| `jobDetails.job.phoneNumber` | string/null | Public contact phone if supplied | Conditional; do not republish blindly |
| `jobDetails.job.contactMatches[].{type,value}` | object[] | Contacts detected in content | Conditional; sensitive |
| `jobDetails.job.salary.label` | string/null | Public salary label | Anonymous |
| `jobDetails.job.salary.currencyLabel` | string/null | Localized currency label | Conditional |
| `jobDetails.job.shareLink` | URL | Canonical share URL | Anonymous |
| `jobDetails.job.workTypes[].label` | string[] | Localized employment types | Anonymous |
| `jobDetails.job.location.label` | string | Long localized location | Anonymous |
| `jobDetails.job.classifications[].label` | string[] | Localized classification labels | Anonymous |

## Detail Tracking And SEO

| Key path | Type | Description | Access |
|---|---|---|---|
| `job.tracking.adProductType` | string | Advertisement product tier | Anonymous/internal |
| `job.tracking.classificationInfo.*` | object | Classification and subclassification IDs/labels | Anonymous |
| `job.tracking.hasRoleRequirements` | boolean | Role-requirement signal | Anonymous |
| `job.tracking.isPrivateAdvertiser` | boolean | Private advertiser flag | Anonymous |
| `job.tracking.locationInfo.{area,location,locationIds}` | object | Internal location tracking metadata | Anonymous |
| `job.tracking.workTypeIds` | string[] | Internal work-type IDs | Anonymous |
| `job.tracking.postedTime` | string/number | Tracking representation of posted time | Anonymous |
| `seoInfo.normalisedRoleTitle` | string/null | SEO-normalized role | Conditional |
| `seoInfo.workType` | string/null | SEO work type | Conditional |
| `seoInfo.classification` | string/null | SEO classification | Conditional |
| `seoInfo.subClassification` | string/null | SEO subclassification | Conditional |
| `seoInfo.where` | string/null | SEO location | Conditional |
| `seoInfo.broaderLocationName` | string/null | Broader localized location | Conditional |
| `seoInfo.normalisedOrganisationName` | string/null | SEO-normalized employer | Conditional |

## Detail Advertiser And Company

| Key path | Type | Description | Access |
|---|---|---|---|
| `job.advertiser.id` | string | Advertiser ID | Anonymous |
| `job.advertiser.name` | string | Localized advertiser name | Anonymous |
| `job.advertiser.isVerified` | boolean | Verified advertiser flag | Anonymous |
| `job.advertiser.registrationDate.dateTimeUtc` | timestamp/null | Advertiser registration date | Conditional |
| `companyProfile.id` | string | Company profile ID | Conditional |
| `companyProfile.name` | string | Profile name | Conditional |
| `companyProfile.companyNameSlug` | string | URL slug | Conditional |
| `companyProfile.shouldDisplayReviews` | boolean | Whether reviews may be displayed | Conditional |
| `companyProfile.branding.logo` | URL/null | Company profile logo | Conditional |
| `companyProfile.overview.description.paragraphs[]` | string[] | Company description | Conditional |
| `companyProfile.overview.industry` | string/null | Industry | Conditional |
| `companyProfile.overview.size.description` | string/null | Company size | Conditional |
| `companyProfile.overview.website.url` | URL/null | Employer website | Conditional |
| `companyProfile.reviewsSummary.overallRating.value` | number/null | Overall review rating | Conditional |
| `companyProfile.reviewsSummary.overallRating.numberOfReviews.value` | number | Review count | Conditional |
| `companyProfile.perksAndBenefits[].title` | string[] | Company perks | Conditional |
| `companySearchUrl` | URL | Search for jobs at this company | Anonymous |
| `companyTags[].{key,value}` | object[] | Localized company attributes | Conditional |

## Products, Branding And Application

| Key path | Type | Description | Access |
|---|---|---|---|
| `job.products.bullets[]` | string[] | Paid advertisement highlights | Conditional |
| `job.products.branding.id` | string | Branding asset set ID | Conditional |
| `job.products.branding.logo.url` | URL | Full company/job logo | Conditional |
| `job.products.branding.cover.url` | URL | Full cover image | Conditional |
| `job.products.branding.thumbnailCover.url` | URL | Thumbnail cover image | Conditional |
| `job.products.questionnaire.questions[]` | string[] | Employer screening questions | Conditional |
| `job.products.video.url` | URL | Advertisement video | Conditional |
| `job.products.video.position` | string/number | Video placement | Conditional |
| `restrictedApplication.label` | string/null | Country/application restriction message | Conditional |
| `sourcr.{image,imageMobile,link}` | object | Source/campaign attribution assets | Conditional |

## Work Arrangement And Auxiliary Metadata

| Key path | Type | Description | Access |
|---|---|---|---|
| `workArrangements.arrangements[].type` | string | Arrangement code | Conditional |
| `workArrangements.arrangements[].label` | string | Localized arrangement label | Conditional |
| `workArrangements.label` | string/null | Overall arrangement text | Conditional |
| `gfjInfo.location.*` | object | Country, suburb, region, state and postcode | Conditional |
| `gfjInfo.workTypes[].label` | string[] | GFJ employment type labels | Conditional |
| `gfjInfo.company.url` | URL/null | GFJ company URL | Conditional |
| `learningInsights.analytics` | JSON/scalar | Learning recommendation analytics | Conditional/internal |
| `learningInsights.content` | string/HTML | Learning recommendation content | Conditional |
| `badges.badges[].badge` | string | Detail badge code | Conditional |
| `badges.badges[].displayText` | string | Localized badge text | Conditional |
| `badges.badges[].message` | string | Expanded badge message | Conditional |
| `badges.badges[].badgeScore` | number | Responsive-hirer score | Conditional/internal |

## Authenticated-Only Or Personalized Fields

| Key path | Type | Description | Recommendation |
|---|---|---|---|
| `insights` / `ApplicantCount.count` | number | Applicant volume | Do not make scraper authentication-dependent |
| `ApplicantCount.volumeLabel` | string | Localized applicant-volume text | Optional; authenticated only |
| Saved/applied state from other operations | boolean/object | Candidate-specific state | Never collect into shared dataset |

The core description, salary label, lifecycle, branding, questionnaire and company
metadata were verified without authentication. Authentication should therefore
remain outside the scraper.

## Recommended Normalized Fields

| Normalized key | Preferred source |
|---|---|
| `title` | `details.job.title`, fallback search `title` |
| `company` | company profile name, advertiser name, then search company name |
| `description` | sanitized `content2`, fallback `content`, abstract, teaser, bullets |
| `salary` | details salary label, fallback search salary label |
| `salaryMin/salaryMax` | parsed only from a visible IDR salary label |
| `location` | details long location, fallback search location label |
| `type` | details localized work type plus arrangement |
| `logoUrl` | detail product logo, profile logo, then search SERP logo |
| `requirements` | extracted requirements section plus screening questions/classification |
| `createdAt` | details listed timestamp, fallback search listing timestamp |
| `expiresAt` | detail expiry timestamp |
| `status/isExpired` | detail lifecycle fields |
| `raw.search` | untouched discovery object |
| `raw.details` | untouched anonymous detail object |

## Privacy And Stability Exclusions

Do not publish bearer tokens, cookies, session/visitor IDs, registered candidate
IDs, contact matches, phone numbers, personalized state, or internal tracking
objects. Store only fields needed by the product. Treat every field and enum as
unstable because both operations are unofficial internal contracts.
