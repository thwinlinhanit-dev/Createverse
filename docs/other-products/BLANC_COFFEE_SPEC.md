# BLANC COFFEE --- Android Business Operating System

## Product, UX/UI, Architecture \& AI-Agent Implementation Specification

**Version:** 1.0  
**Date:** 2026-10-06  
**Product:** Blanc Coffee  
**Platform:** Android-first  
**Primary user:** Owner/operator --- no staff in V1

\---

# 0\. Executive Summary

Blanc Coffee is a small coffee/tea/nut business. The first application
must be designed around the actual business rather than a generic
restaurant POS.

The V1 system manages:

1. Orders and sales
2. Products and weight-based variants
3. Roasted coffee production/batches
4. Inventory
5. Purchases
6. Operating expenses
7. Owner investments and withdrawals
8. Customers
9. Daily closing
10. Financial and business reports

The system must be simple enough for one owner to operate quickly from
an Android phone, while its architecture must support future expansion
into cloud sync, multiple devices, multiple locations, staff, customer
loyalty, and AI business intelligence.

## Product principle

> \*\*Simple to operate, precise enough for accounting, and structured
> enough for future AI.\*\*

Do NOT build unnecessary restaurant features in V1.

\---

# 1\. Actual Blanc Coffee Product Catalog

## 1.1 Roasted Coffee

Roasted coffee is a product family.

### Form

* Bean
* Ground

### Required attributes

* Product name
* Origin/source
* Form
* Roast level
* Package weight
* Selling price
* Cost
* Roast batch
* Roast date
* Notes
* Active/inactive

### Roast levels

The system must support configurable roast levels: - Light -
Medium-Light - Medium - Medium-Dark - Dark - Custom

### Example variants

``` text
Roasted Coffee
├── Bean / Light / 100g
├── Bean / Light / 250g
├── Bean / Medium / 100g
├── Bean / Medium / 250g
├── Bean / Medium / 500g
├── Bean / Dark / 250g
└── Ground / Medium / 250g
```

Do not hard-code these variants. The owner must be able to create/edit
them.

\---

# 2\. Blanc Brew

Product family: - Brew

Variant/option: - Blanc Brew, Original Brew - No Sugar

Do not create unnecessary duplicated products if sugar is the only
difference.

Recommended model:

``` text
Product: Brew
Values:
  - Blanc Brew
  - Original Brew
  - No Sugar
```

Future options may include size or serving type without changing the
database model.

\---

# 3\. Green Tea

Product family: -  Tea

Current variants: - Green Tea အကျစ် 
                  -  Green Tea အပွ 
                  - Local Tea 
                  - Kyaukme Tea

Each variant supports: - Weight - Cost - Selling price - Source/origin -
Batch - Stock - Notes

The application must support Unicode/Burmese text correctly.

\---

# 4\. Macadamia

Product family: - Macadamia

Variants: - Nuts - With Shell

Each supports configurable weights such as: - 100g - 250g - 500g - 1kg

The owner must be able to add other weights later.

\---

# 5\. Product and Inventory Philosophy

Weight is a first-class business quantity.

The system must distinguish:

### Physical quantity

Example:

``` text
12.75 kg
```

### Packaged quantity

Example:

``` text
250g × 30 packages
500g × 8 packages
1kg × 2 packages
```

### Unit conversion

The system stores a canonical quantity in grams or millilitres where
appropriate.

For weight:

``` text
1 kg = 1000 g
1 lb = 453.59237 g
```

V1 should display the owner's preferred unit, but calculations use a
canonical base unit.

Never use floating-point values for financial calculations. Store money
as integer minor units or a precise decimal representation.

\---

# 6\. Core Business Modules

## V1 modules

``` text
Dashboard
Orders
Products
Inventory
Roasting
Purchases
Expenses
Customers
Reports
Daily Closing
Settings
```

## V2 modules

``` text
Advanced Analytics
Customer Loyalty
Promotions
Supplier Management
Cash Flow Forecasting
Inventory Forecasting
```

## V3 modules

``` text
AI Business Assistant
Sales Forecasting
Roast Planning
Customer Intelligence
Automated Alerts
```

## Explicitly excluded from V1

``` text
Staff management
Payroll
Multi-location
Complex restaurant kitchen management
Table management
Waiter management
Delivery fleet management
```

The architecture must allow them later but must not complicate V1.

\---

# 7\. UX/UI Product Direction

## Design personality

Blanc Coffee should feel:

* Premium
* Warm
* Minimal
* Calm
* Professional
* Coffee-oriented
* Fast to operate

Avoid a cluttered enterprise ERP appearance.

## Visual language

Recommended: - Warm off-white background - Dark coffee/brown primary
text - Soft neutral surfaces - Subtle borders - Large readable numbers -
Rounded cards - Clear typography - Strong visual hierarchy - Minimal
animation

Do not make every screen look like a dashboard.

Operational screens should prioritize speed.

\---

# 8\. Navigation

Primary navigation:

``` text
Home
Orders
Inventory
Reports
More
```

More contains:

``` text
Products
Roasting
Purchases
Expenses
Customers
Daily Closing
Settings
```

The navigation can be adapted for tablets later.

\---

# 9\. Dashboard

## Required dashboard sections

### Today's financial summary

``` text
Today's Sales
Today's Orders
Today's Expenses
Estimated Gross Profit
```

### Inventory alerts

``` text
Low stock
Out of stock
Recent roast batches
```

### Sales highlights

``` text
Best-selling product
Most sold category
Top customer
```

### Quick actions

``` text
+ New Order
+ Expense
+ Purchase
+ Roast Batch
+ Inventory Adjustment
```

## Dashboard rules

* Load immediately from local database.
* Never wait for network.
* Show sync state separately.
* Do not make AI calls just to render the dashboard.

\---

# 10\. Order Workflow

## Create order

``` text
New Order
↓
Select customer or Walk-in
↓
Select products
↓
Select variant/options
↓
Enter quantity/weight
↓
Review
↓
Select payment
↓
Complete
↓
Inventory movement created
↓
Sale recorded
```

## Payment methods

Configurable defaults: - Cash - Bank - QR - Card - Other

The owner can enable/disable payment methods.

## Order states

``` text
Draft
Completed
Cancelled
Refunded
Partially Refunded
```

V1 should avoid complicated kitchen states.

\---

# 11\. Order Data Integrity

When an order is completed:

1. Validate product is active.
2. Validate sufficient stock where stock control is enabled.
3. Calculate subtotal.
4. Apply discount if any.
5. Calculate total.
6. Record payment.
7. Create inventory movements.
8. Create customer purchase history.
9. Record accounting/business event.
10. Mark order completed.

All required operations must be transactional.

If any critical operation fails, do not create a partially completed
order.

\---

# 12\. Product Data Model

Core Product:

``` text
Product
- id
- name
- categoryId
- description
- imageUri
- active
- inventoryTracked
- createdAt
- updatedAt
```

Product Variant:

``` text
ProductVariant
- id
- productId
- name
- sku
- form
- roastLevel
- weightGrams
- sellingPriceMinor
- costPriceMinor
- active
- createdAt
- updatedAt
```

Product Option:

``` text
ProductOption
- id
- productId
- name
```

Option Value:

``` text
ProductOptionValue
- id
- optionId
- value
- priceAdjustmentMinor
```

This allows: - Original/No Sugar - Bean/Ground - Roast level - Future
size options

without redesigning the database.

\---

# 13\. Inventory System

Inventory must be ledger-based.

Do NOT simply store:

``` text
currentStock = 15kg
```

without history.

Use:

``` text
InventoryItem
+
InventoryMovement
```

## Inventory movement types

``` text
PURCHASE
ROAST\_INPUT
ROAST\_OUTPUT
SALE
REFUND
ADJUSTMENT\_IN
ADJUSTMENT\_OUT
WASTE
TRANSFER
OPENING\_BALANCE
```

## Example

``` text
Coffee Green Beans
Opening:       +20.0kg
Roast Input:   -10.0kg
Remaining:     10.0kg
```

Roasted batch:

``` text
Roasted Output: +8.6kg
Roast Loss:      1.4kg
```

\---

# 14\. Inventory Ledger

Every stock-changing operation creates an immutable movement record.

Movement:

``` text
InventoryMovement
- id
- inventoryItemId
- movementType
- quantityBaseUnit
- referenceType
- referenceId
- unitCostMinor
- totalCostMinor
- occurredAt
- notes
- createdAt
```

Current stock is calculated from movements or maintained as a derived
value with reconciliation support.

The ledger must remain auditable.

Never silently overwrite inventory history.

\---

# 15\. Roasting Module

This is a special Blanc Coffee feature.

## New roast batch

Input:

``` text
Green Coffee
Input Weight
Roast Level
Roast Date
Notes
```

Output:

``` text
Roasted Weight
```

Automatically calculate:

``` text
Roast Loss = Input Weight - Output Weight

Roast Loss % =
(Input Weight - Output Weight) / Input Weight × 100
```

Example:

``` text
Input: 10.0kg
Output: 8.6kg
Loss: 1.4kg
Loss: 14%
```

## Batch record

``` text
RoastBatch
- id
- sourceProductId
- outputProductVariantId
- batchCode
- inputWeightGrams
- outputWeightGrams
- lossWeightGrams
- lossPercent
- roastLevel
- roastedAt
- notes
- createdAt
```

\---

# 16\. Roast Costing

The system should estimate effective roasted coffee cost.

Example:

``` text
Green coffee cost = ¥3,500/kg
Input = 10kg
Input cost = ¥35,000

Output = 8.6kg

Effective raw coffee cost:
¥35,000 / 8.6kg
= ¥4,069.77/kg
```

Then optionally add: - Packaging - Electricity/gas - Processing - Labels

V1 can support raw-cost calculation and manual additional cost.

Do not pretend electricity/gas costs are exact unless the owner provides
a costing method.

\---

# 17\. Purchases

Purchase workflow:

``` text
New Purchase
↓
Supplier (optional in V1)
↓
Select item
↓
Quantity
↓
Unit cost
↓
Total
↓
Payment status
↓
Save
↓
Inventory increases
```

Purchase record:

``` text
Purchase
- id
- supplierId nullable
- purchaseDate
- subtotalMinor
- shippingMinor
- otherCostMinor
- totalMinor
- paymentStatus
- notes
```

Purchase item:

``` text
PurchaseItem
- id
- purchaseId
- inventoryItemId
- quantityBaseUnit
- unitCostMinor
- totalCostMinor
```

\---

# 18\. Expenses

Expense categories:

``` text
Rent
Electricity
Water
Gas
Internet
Packaging
Transportation
Shipping
Marketing
Maintenance
Equipment
Software
Taxes
Bank Fees
Other
```

Expense:

``` text
Expense
- id
- categoryId
- amountMinor
- expenseDate
- paymentMethod
- description
- receiptUri
- notes
- createdAt
```

Receipts should be optional.

\---

# 19\. Owner Investments

Owner investment is NOT an expense.

Investment:

``` text
OwnerInvestment
- id
- amountMinor
- date
- paymentMethod
- description
- notes
```

Examples:

``` text
Initial capital
Additional owner funding
Equipment capital injection
```

\---

# 20\. Owner Withdrawals

Withdrawal is also NOT an operating expense.

``` text
OwnerWithdrawal
- id
- amountMinor
- date
- paymentMethod
- description
- notes
```

This allows reports to distinguish:

``` text
Business profit
vs
Owner money movement
```

\---

# 21\. Customer CRM

Customer:

``` text
Customer
- id
- name
- phone
- email
- address
- notes
- birthday
- createdAt
- updatedAt
```

Customer metrics are derived:

``` text
Total orders
Lifetime spend
Average order value
Last order date
Favorite products
```

Do not duplicate these metrics as manually editable fields.

\---

# 22\. Walk-in Customers

Do not force customer creation for every sale.

Order can have:

``` text
customerId = null
```

Display:

``` text
Walk-in
```

This keeps ordering fast.

\---

# 23\. Daily Closing

Daily closing is a core V1 feature.

## Closing screen

``` text
Date

Sales
Cash
Bank
QR
Card
Refunds
Expenses

Expected cash
Actual cash

Difference
```

The owner can enter actual cash.

System calculates:

``` text
Cash Difference =
Actual Cash - Expected Cash
```

Closing record:

``` text
DailyClosing
- id
- businessDate
- expectedCashMinor
- actualCashMinor
- cashDifferenceMinor
- notes
- closedAt
```

A closed day should not be casually edited.

Corrections should use adjustment transactions.

\---

# 24\. Reports

## Sales reports

* Today
* Yesterday
* 7 days
* 30 days
* Current month
* Previous month
* Custom range

Metrics:

``` text
Revenue
Orders
Average order value
Units sold
Weight sold
Refunds
Discounts
```

## Product report

``` text
Product
Units sold
Weight sold
Revenue
Estimated COGS
Estimated gross profit
Gross margin
```

## Expense report

``` text
Category
Amount
% of expenses
Trend
```

## Profit report

``` text
Revenue
- COGS
= Gross Profit

- Operating Expenses
= Operating Profit

Owner Investment
Owner Withdrawal
```

Important: Investment and withdrawal must not be treated as
revenue/expense.

\---

# 25\. Business Metrics

V1 KPI definitions:

### Revenue

Completed sales minus refunds.

### COGS

Estimated product cost associated with sold inventory.

### Gross Profit

``` text
Revenue - COGS
```

### Gross Margin

``` text
Gross Profit / Revenue × 100
```

### Operating Profit

``` text
Gross Profit - Operating Expenses
```

### Average Order Value

``` text
Revenue / Completed Orders
```

\---

# 26\. Product Profitability

Every product variant should support:

``` text
Selling price
Estimated unit cost
Estimated gross profit
Estimated gross margin
```

Example:

``` text
250g Roasted Coffee

Selling price: ¥2,000
Estimated cost: ¥1,050

Gross profit: ¥950
Gross margin: 47.5%
```

Clearly label estimates where exact cost accounting is unavailable.

\---

# 27\. Inventory Alerts

Configurable minimum stock:

``` text
Product Variant
Minimum Stock
Reorder Target
```

Alerts:

``` text
LOW STOCK
OUT OF STOCK
```

Future:

``` text
Estimated days remaining
Suggested purchase quantity
```

Do not build forecasting into V1 unless historical data exists.

\---

# 28\. Search

Global search should search:

``` text
Orders
Products
Customers
Purchases
Expenses
Roast batches
Inventory
```

Search should support Burmese and English text.

\---

# 29\. UX Screen List

## Core

``` text
01 Splash
02 Onboarding
03 Dashboard
04 New Order
05 Order Detail
06 Orders List
07 Product List
08 Product Detail
09 Variant Editor
10 Inventory
11 Inventory Detail
12 Inventory Adjustment
13 Roast Batches
14 New Roast Batch
15 Purchases
16 New Purchase
17 Expenses
18 New Expense
19 Customers
20 Customer Detail
21 Reports
22 Daily Closing
23 Settings
```

## Future

``` text
24 AI Assistant
25 Loyalty
26 Promotions
27 Suppliers
28 Forecasting
29 Multi-location
```

\---

# 30\. Android Architecture

Use a modern layered architecture.

Recommended:

``` text
Kotlin
Jetpack Compose
ViewModel
Coroutines
Flow
Room
DataStore
WorkManager
Navigation
```

The architecture should follow: - Separation of concerns - Single source
of truth - Unidirectional data flow - Persistent data models -
Repository boundaries

Android's current architecture guidance recommends a clearly defined
data layer, repository abstraction, Compose for new UI, coroutines/Flow,
and single-activity architecture. See official Android guidance:
https://developer.android.com/topic/architecture
https://developer.android.com/topic/architecture/recommendations

\---

# 31\. Offline-First Architecture

The local database is the primary source of truth.

``` text
UI
 ↓
ViewModel
 ↓
Use Case / Domain
 ↓
Repository
 ↓
Room Database
 ↓
Local state immediately available
```

Network synchronization is secondary:

``` text
Room
 ↕
Sync Queue
 ↕
API
 ↕
Cloud Database
```

The app must remain usable without internet for all core V1 operations.

Official Android guidance explicitly recommends a local data source for
offline-first applications and describes persistent write queues with
WorkManager for synchronization.

\---

# 32\. Sync Strategy

Every mutable record should contain:

``` text
id
createdAt
updatedAt
deletedAt nullable
syncStatus
version
```

Suggested sync states:

``` text
LOCAL\_ONLY
PENDING\_SYNC
SYNCED
SYNC\_ERROR
```

For V1, if the app is truly single-device, cloud sync can be implemented
after the local application is stable.

Do not introduce cloud complexity before the local business logic works.

\---

# 33\. Future Cloud Architecture

When needed:

``` text
Android App
    ↓
REST/GraphQL API
    ↓
Backend
    ↓
PostgreSQL
    ↓
Object Storage
```

Cloud responsibilities:

* Authentication
* Backup
* Sync
* Multi-device
* Reporting aggregation
* AI services

The backend must never be required for a basic sale if offline operation
is promised.

\---

# 34\. Suggested Backend

When cloud is introduced, use a boring, reliable backend.

Possible stack:

``` text
Kotlin / Ktor
or
TypeScript / NestJS
```

Database:

``` text
PostgreSQL
```

Storage:

``` text
S3-compatible object storage
```

Authentication:

``` text
JWT/session-based authentication
```

Do not select a backend framework merely because it is fashionable. The
priority is maintainability and strong transactional behavior.

\---

# 35\. Database Schema

Core tables:

``` text
users
business\_profile

product\_categories
products
product\_variants
product\_options
product\_option\_values

inventory\_items
inventory\_movements

roast\_batches

orders
order\_items
order\_item\_options
payments
refunds

customers

purchase\_orders
purchase\_items
suppliers

expense\_categories
expenses

owner\_investments
owner\_withdrawals

daily\_closings

app\_settings
sync\_queue
audit\_log
```

\---

# 36\. Relationship Model

``` text
Product
  └── ProductVariant
        └── InventoryItem

ProductVariant
  └── RoastBatch (when applicable)

Customer
  └── Orders
        └── OrderItems
              └── ProductVariant

Purchase
  └── PurchaseItems
        └── InventoryItem

Order
  └── Payment

InventoryItem
  └── InventoryMovements
```

\---

# 37\. Audit Log

Business-critical changes must be auditable.

Track:

``` text
Order created
Order cancelled
Refund created
Expense created
Expense edited
Inventory adjusted
Purchase created
Roast batch created
Daily closing completed
Product price changed
```

Audit record:

``` text
AuditLog
- id
- entityType
- entityId
- action
- oldValueJson
- newValueJson
- timestamp
- actorId
```

For V1 single-user mode, actorId can represent the owner/device.

\---

# 38\. Security

Minimum requirements:

* Device authentication
* App lock/PIN
* Secure local storage for secrets
* No plaintext credentials
* Encrypted network communication
* Input validation
* Database backup/export
* Audit trail
* Safe handling of receipts/photos

Never put API keys directly into the Android application.

\---

# 39\. Backup \& Export

V1 must have a way to export business data.

Minimum:

``` text
CSV:
Orders
Order Items
Products
Inventory Movements
Expenses
Purchases
Customers
Roast Batches
```

Future:

``` text
JSON backup
Encrypted backup
Cloud backup
Automatic scheduled backup
```

The user must be able to recover business data without being trapped
inside the app.

\---

# 40\. Settings

Settings:

``` text
Business name
Currency
Date format
Weight unit
Default payment method
Tax configuration
Low-stock thresholds
Product categories
Expense categories
Payment methods
Backup/export
App lock
Theme
Language
```

Support: - English - Burmese - Japanese-ready architecture

Do not hard-code user-visible strings.

Use Android string resources/localization.

\---

# 41\. Localization

The app must support Burmese text from day one.

Examples:

``` text
အကျစ်
အပွ
```

Requirements: - UTF-8 everywhere - Unicode-safe database - Font
fallback - No text baked into images - Localizable strings -
Date/number/currency formatting through locale-aware APIs

\---

# 42\. UI Components

Create reusable components:

``` text
BlancScaffold
BlancTopBar
BlancBottomBar
MetricCard
MoneyCard
ProductCard
ProductVariantRow
OrderItemRow
InventoryStatusBadge
StockMovementRow
EmptyState
ErrorState
LoadingState
ConfirmDialog
MoneyInput
WeightInput
DatePickerField
SearchField
FilterChip
ReportCard
```

Do not duplicate UI code between screens.

\---

# 43\. Money Input Rules

Never accept ambiguous values.

Use: - Numeric keyboard - Currency formatting - Decimal-safe parsing -
Validation

Internally use minor currency units where possible.

Example:

``` text
¥1,250
```

must not be stored as a binary floating-point number.

\---

# 44\. Weight Input Rules

Allow:

``` text
100 g
250 g
500 g
1 kg
1.25 kg
```

Internally normalize to grams.

Examples:

``` text
1kg = 1000g
1.25kg = 1250g
250g = 250g
```

Display in the owner's preferred unit.

\---

# 45\. Validation Rules

Examples:

### Product

* Name required
* Price >= 0
* Weight > 0 when weight-based

### Order

* At least one item
* Quantity > 0
* Payment total valid

### Roast

* Input weight > 0
* Output weight >= 0
* Output weight <= input weight unless explicitly allowing special
workflows
* Roast loss cannot be negative

### Expense

* Amount > 0
* Category required
* Date required

### Inventory adjustment

* Reason required
* Quantity != 0

\---

# 46\. Testing Strategy

Testing is not optional because this app handles money and inventory.

## Unit tests

Test:

``` text
Money calculations
Weight conversions
Order totals
Discounts
Refunds
COGS
Profit
Roast loss
Inventory balance
Daily closing
```

## Database tests

Test: - Order transaction - Inventory movement - Purchase - Roast
batch - Refund - Rollback behavior

## UI tests

Test critical flows:

``` text
Create order
Complete payment
Create expense
Create purchase
Create roast
Adjust inventory
Close day
```

## End-to-end test

Scenario:

``` text
Purchase 10kg green coffee
↓
Create roast batch
↓
Produce 8.6kg roasted coffee
↓
Package 250g
↓
Sell 250g
↓
Inventory decreases
↓
Revenue increases
↓
COGS recorded
↓
Profit report changes
```

\---

# 47\. Acceptance Criteria --- MVP

The MVP is complete only when all are true:

### Orders

* Owner can create an order offline.
* Owner can complete payment offline.
* Completed order appears immediately in reports.
* Inventory decreases correctly.
* Walk-in customers are supported.

### Products

* Owner can create/edit products.
* Owner can create weight variants.
* Owner can configure roast levels.
* Owner can configure sugar options.

### Inventory

* Every stock change creates a movement.
* Current stock is correct after sales/purchases/adjustments.
* Stock history is visible.

### Roasting

* Owner can create a roast batch.
* Input/output weight is recorded.
* Loss percentage is calculated.
* Output inventory is created.

### Finance

* Expenses are tracked separately from purchases.
* Owner investments are separate from expenses.
* Withdrawals are separate from expenses.
* Revenue and estimated profit reports work.

### Customers

* Walk-in sales work without customer creation.
* Customer purchase history works.
* Lifetime spending is calculated.

### Daily closing

* Expected cash is calculated.
* Actual cash can be entered.
* Difference is calculated.
* Closed day is recorded.

### Offline

* Core operations work without network.
* Data survives app restart.
* Sync can be added later without rewriting domain logic.

\---

# 48\. AI-Agent Development Strategy

This project should NOT be handed to an AI coding agent as:

> "Build me a coffee shop app."

That encourages uncontrolled implementation.

Give the agent this specification and make it work in milestones.

## Agent rules

1. Read the complete specification before coding.
2. Do not invent business requirements.
3. Do not remove requirements without explaining why.
4. Do not introduce unnecessary dependencies.
5. Do not mix UI, database, and business logic.
6. Write tests for financial/inventory logic first.
7. Keep every database migration explicit.
8. Never silently change historical financial records.
9. Never use floating-point money calculations.
10. Never make network access mandatory for core V1 operations.
11. Preserve Unicode/Burmese support.
12. Keep the project buildable after every milestone.
13. Run tests before declaring a milestone complete.
14. Document architectural decisions.
15. Do not create fake/mock functionality in production code unless
explicitly marked.

\---

# 49\. AI-Agent Implementation Milestones

## Milestone 0 --- Project foundation

Deliver:

``` text
Android project
Kotlin
Compose
Navigation
Dependency injection
Build configuration
Lint
Testing setup
CI
```

Acceptance: - Clean build - App launches - Test suite executes

\---

## Milestone 1 --- Design system

Deliver:

``` text
Theme
Typography
Spacing
Buttons
Cards
Inputs
Dialogs
Navigation
Loading/error/empty states
```

Acceptance: - UI components preview correctly. - Light/dark theme
architecture exists. - Burmese text renders correctly.

\---

## Milestone 2 --- Database foundation

Implement:

``` text
Products
Variants
Customers
Inventory
Orders
Expenses
Purchases
Roast batches
Daily closings
```

Acceptance: - Migrations work. - Database tests pass. - Repository layer
exists.

\---

## Milestone 3 --- Product management

Implement:

``` text
Product list
Product creation
Variant creation
Roast level
Weight
Pricing
Options
```

\---

## Milestone 4 --- Orders

Implement:

``` text
Order creation
Cart
Customer selection
Payment
Completion
Cancellation
Refund foundation
```

Critical: - Atomic transaction - Inventory movement

\---

## Milestone 5 --- Inventory

Implement:

``` text
Stock
Movements
Adjustments
Low-stock alerts
History
```

\---

## Milestone 6 --- Roasting

Implement:

``` text
Roast batch
Input/output
Loss %
Cost calculation
Inventory movements
Batch history
```

\---

## Milestone 7 --- Purchases \& Expenses

Implement: - Purchases - Expense categories - Expenses - Receipt
attachments

\---

## Milestone 8 --- Customers

Implement: - Customer CRUD - History - Lifetime metrics - Favorite
products

\---

## Milestone 9 --- Reports

Implement: - Sales - Product performance - Inventory - Expenses -
Profit - Daily closing

\---

## Milestone 10 --- Backup

Implement: - CSV export - Local backup - Restore validation

\---

## Milestone 11 --- Hardening

Implement: - App lock - Audit log - Error handling - Database migration
testing - Crash resilience - Performance testing

\---

## Milestone 12 --- Optional cloud

Only after V1 is stable:

``` text
Authentication
API
Cloud database
Sync queue
Conflict handling
Backup
Multi-device
```

\---

# 50\. AI Business Assistant --- Future Specification

The AI must never directly modify financial data in the first AI
release.

Start read-only.

Questions:

``` text
How much did I sell this month?
What is my best-selling product?
Which product has the highest margin?
How much coffee did I sell?
How much tea did I sell?
How much did I spend?
What were my biggest expenses?
Which products are low stock?
How much did I roast?
What was my average roast loss?
```

AI output must cite the underlying business data internally and
distinguish: - Actual - Estimated - Forecast

Never fabricate missing numbers.

\---

# 51\. AI Tool Layer

Future AI tools:

``` text
get\_sales\_summary()
get\_product\_sales()
get\_product\_profitability()
get\_inventory\_status()
get\_inventory\_movements()
get\_expense\_summary()
get\_purchase\_summary()
get\_customer\_summary()
get\_roast\_batch\_summary()
get\_daily\_closing()
```

Write tools later:

``` text
create\_expense()
create\_purchase()
create\_inventory\_adjustment()
```

Write tools require explicit confirmation.

Example:

``` text
AI:
I recommend recording a ¥25,000 packaging expense.

\[Confirm]
\[Cancel]
```

Never allow an AI model to silently create financial transactions.

\---

# 52\. Future MCP / Agent Integration

Expose controlled business tools through an MCP-compatible tool layer
later.

Read tools:

``` text
blanc.get\_sales
blanc.get\_orders
blanc.get\_inventory
blanc.get\_expenses
blanc.get\_customers
blanc.get\_roasts
blanc.get\_reports
```

Action tools:

``` text
blanc.create\_order
blanc.create\_expense
blanc.create\_purchase
blanc.create\_roast
blanc.adjust\_inventory
```

All write tools: - Require authentication - Validate input - Produce
audit records - Require confirmation for high-impact operations

This allows future integration with coding/agent systems without giving
an agent unrestricted database access.

\---

# 53\. Analytics Event Model

Track product usage events separately from business transactions.

Examples:

``` text
screen\_view
product\_created
order\_started
order\_completed
report\_viewed
inventory\_adjusted
roast\_created
expense\_created
```

Do not use analytics events as the financial source of truth.

Business data comes from transactional tables.

\---

# 54\. Error Handling

Every screen needs:

``` text
Loading
Success
Empty
Error
Offline
```

Example:

``` text
Unable to sync right now.

Your local data is safe.
We'll retry automatically.
```

Never tell the user that an order failed merely because cloud sync
failed if the local transaction succeeded.

\---

# 55\. Performance

Target:

``` text
Dashboard open: near-instant from local DB
New order interaction: <100ms perceived response
Search: responsive on thousands of records
Reports: optimized queries
```

Do not load the entire database into memory.

Use: - Pagination - Database queries - Flows - Derived summaries -
Background work

\---

# 56\. Backup Philosophy

The most important data:

``` text
Orders
Payments
Inventory movements
Purchases
Expenses
Roast batches
Customers
Products
Daily closings
```

Never make a backup only of current stock.

The ledger/history is more valuable.

\---

# 57\. Future Multi-Device Architecture

Potential future:

``` text
Phone
   │
Tablet
   │
Laptop/Web
   │
   └──── Cloud
           │
       PostgreSQL
```

All devices synchronize business events/data.

Do not assume V1 has only one device forever.

\---

# 58\. Future Multi-Location Architecture

Add:

``` text
business
location
device
```

Then:

``` text
Blanc Coffee
├── Location A
├── Location B
└── Location C
```

Orders, inventory, expenses and reports become location-aware.

Do not implement this complexity in V1 unless required.

\---

# 59\. Future Customer Loyalty

Potential:

``` text
Points
Rewards
VIP tiers
Coupons
Birthday rewards
Referral
```

Keep loyalty separate from order logic so it can be added later.

\---

# 60\. Recommended Project Structure

``` text
app/
  src/main/java/com/blanccoffee/

    core/
      common/
      database/
      network/
      ui/
      navigation/
      security/
      logging/

    data/
      local/
      remote/
      repository/

    domain/
      model/
      repository/
      usecase/

    feature/
      dashboard/
      orders/
      products/
      inventory/
      roasting/
      purchases/
      expenses/
      customers/
      reports/
      closing/
      settings/

    sync/
      SyncManager
      SyncWorker
      SyncQueue

    ai/
      tools/
      assistant/
```

Do not create one giant package.

\---

# 61\. Definition of Done

A feature is not finished when the UI exists.

A feature is finished only when:

``` text
UI
+
ViewModel/state
+
Domain logic
+
Repository
+
Database
+
Validation
+
Error handling
+
Tests
+
Migration support
+
Accessibility
+
Localization
```

\---

# 62\. Product Philosophy

Blanc Coffee is not trying to become a giant restaurant ERP.

The system should optimize for:

``` text
FAST
ACCURATE
SIMPLE
AUDITABLE
OFFLINE
EXTENSIBLE
```

The owner should be able to complete common actions in seconds.

\---

# 63\. Most Important User Journeys

## Journey A --- Sale

``` text
Open app
→ New Order
→ Select product
→ Select weight
→ Payment
→ Complete
```

Target: extremely fast.

## Journey B --- Roast

``` text
Roasting
→ New Batch
→ Select green coffee
→ Enter input weight
→ Enter roast level
→ Enter output weight
→ Save
```

## Journey C --- Expense

``` text
Expense
→ New
→ Category
→ Amount
→ Date
→ Save
```

## Journey D --- Daily closing

``` text
Closing
→ Review sales
→ Count cash
→ Enter actual cash
→ Review difference
→ Close day
```

## Journey E --- Business review

``` text
Reports
→ Month
→ Revenue
→ COGS
→ Expenses
→ Profit
→ Product performance
```

\---

# 64\. First Release Scope

The first production release should contain exactly:

``` text
✓ Dashboard
✓ Product management
✓ Weight variants
✓ Roast levels
✓ Blanc Brew sugar option
✓ Orders
✓ Payments
✓ Customers
✓ Inventory
✓ Inventory ledger
✓ Roast batches
✓ Purchases
✓ Expenses
✓ Owner investments
✓ Owner withdrawals
✓ Daily closing
✓ Sales reports
✓ Expense reports
✓ Profit report
✓ CSV export
✓ Offline operation
✓ Burmese/English localization
✓ App lock
```

Do NOT delay the first release for:

``` text
AI
Cloud sync
Staff
Loyalty
Multi-location
Advanced forecasting
```

Those belong after the core system proves itself.

\---

# 65\. Final Agent Instruction

You are building a production-quality Android application for Blanc
Coffee.

The application is an owner-operated business management system, not a
generic restaurant POS.

Prioritize: 1. Correctness 2. Data integrity 3. Offline reliability 4.
Fast daily operation 5. Clear UX 6. Maintainable architecture 7.
Testability 8. Future extensibility

The actual products are:

``` text
Roasted Coffee
  - Bean
  - Ground
  - Roast level
  - Weight

Blanc Brew
  - Original Brew
  - No Sugar

Green Tea
  - အကျစ်
  - အပွ
  - Local Tea
  - Kyaukme Tea

Macadamia
  - Nuts
  - With Shell
```

There are currently no staff.

Do not invent staff workflows.

Do not invent product prices.

Do not invent suppliers.

Do not invent tax rules.

Make those configurable.

Do not hard-code business assumptions that the owner has not specified.

When requirements are missing, implement configurable fields or mark the
decision as requiring owner configuration.

Never compromise financial or inventory integrity for UI convenience.

Build incrementally.

Keep the project compiling and tests passing after every milestone.

The end goal is a reliable digital operating system for Blanc Coffee
that can eventually evolve into an AI-assisted business management
platform.

