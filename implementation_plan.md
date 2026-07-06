# Implementation Plan — Decoupling Mocks & Integrating Live PocketBase SDK

This plan outlines the transition of the WALY MOBILE frontend from local mock data arrays to real-time integration with the live PocketBase backend.

## User Review Required

> [!IMPORTANT]
> - **Collection Relations**: We will query records using PocketBase's `expand` parameter to join `loyalty_cards` with `loyalty_programs` and `merchants` in single requests.
> - **Offline Handling**: We will introduce basic state loading indicators to prevent blank screen layout pops when requests are pending.
> - **QR Scans Format**: The customer dashboard QR code will generate a JSON string: `{"id": "card_id", "customer": "customer_id"}`. The merchant scanner will parse this to issue stamps.

---

## Proposed Changes

### 1. Customer Portal Mocks Removal

#### [MODIFY] [index.tsx](file:///c:/Users/User/Documents/Work/WALY%20MOBILE/app/(customer)/index.tsx)
- **Remove**: `mockLoyaltyCards` constant.
- **Add**: `loyaltyCards` state and a `fetchLoyaltyCards` function.
- **Query**:
  ```typescript
  pb.collection('loyalty_cards').getFullList({
    filter: `customer = "${user.id}" && status = "active"`,
    expand: 'program,merchant',
    sort: '-updated'
  })
  ```
- **Mapping**:
  - Map `expand.merchant.name` to `merchantName`, `expand.program.stamp_goal` to `totalStamps`, `expand.program.reward_description` to `rewardName`, and `expand.program.card_color` to `gradientColors` (or default if null).
  - Bind points value dynamically to the user's `total_points` or stamps.

#### [MODIFY] [my-cards.tsx](file:///c:/Users/User/Documents/Work/WALY%20MOBILE/app/(customer)/my-cards.tsx)
- **Remove**: `mockLoyaltyCards` array.
- **Add**: State hook and fetch wrapper querying the customer's loyalty cards (`active` and `completed` status list).
- **Query**:
  ```typescript
  pb.collection('loyalty_cards').getFullList({
    filter: `customer = "${user.id}"`,
    expand: 'program,merchant',
    sort: '-updated'
  })
  ```

#### [MODIFY] [explore.tsx](file:///c:/Users/User/Documents/Work/WALY%20MOBILE/app/(customer)/explore.tsx)
- **Remove**: `mockMerchants` array.
- **Add**: Query to fetch active merchants and their linked loyalty programs.
- **Query**:
  ```typescript
  pb.collection('merchants').getFullList({
    filter: 'status = "active"',
    expand: 'loyalty_programs_via_merchant'
  })
  ```
- **Category Filter**: Implement filter locally on category string fields.

#### [MODIFY] [vouchers.tsx](file:///c:/Users/User/Documents/Work/WALY%20MOBILE/app/(customer)/vouchers.tsx)
- **Remove**: `mockVouchers` array.
- **Add**: Live vouchers fetch listing available (`active`) and consumed (`used` / `expired`) vouchers.
- **Query**:
  ```typescript
  pb.collection('vouchers').getFullList({
    filter: `customer = "${user.id}"`,
    expand: 'reward,reward.merchant',
    sort: '-created'
  })
  ```

---

### 2. Merchant Portal Mocks Removal

#### [MODIFY] [index.tsx](file:///c:/Users/User/Documents/Work/WALY%20MOBILE/app/(merchant)/index.tsx)
- **Remove**: `mockActivities` array.
- **Add**: Dashboard summary queries using PocketBase direct queries.
- **Queries**:
  - Recent transactions list:
    ```typescript
    pb.collection('transactions').getList(1, 10, {
      filter: `merchant = "${user.merchant_id}"`,
      expand: 'customer',
      sort: '-created'
    })
    ```
  - Retrieve daily/weekly stats by filtering `transactions` query responses.

#### [MODIFY] [customers.tsx](file:///c:/Users/User/Documents/Work/WALY%20MOBILE/app/(merchant)/customers.tsx)
- **Remove**: `mockTransactions` array.
- **Add**: Query to retrieve full transaction log histories for the shop.
- **Query**:
  ```typescript
  pb.collection('transactions').getFullList({
    filter: `merchant = "${user.merchant_id}"`,
    expand: 'customer',
    sort: '-created'
  })
  ```

#### [MODIFY] [give.tsx](file:///c:/Users/User/Documents/Work/WALY%20MOBILE/app/(merchant)/give.tsx)
- **Remove**: Simulated `triggerMockScanSuccess` alerts.
- **Add**: Live stamp award transactions.
- **Manual Input Logic**:
  - Search customer by phone:
    ```typescript
    const customer = await pb.collection('users').getFirstListItem(`phone = "${phoneNumber}"`);
    ```
  - Create transaction:
    ```typescript
    await pb.collection('transactions').create({
      customer: customer.id,
      merchant: user.merchant_id,
      type: 'earn',
      points: stampsCount, // Hooks will multiply points
      stamps: stampsCount
    });
    ```
- **QR Code Scan Logic**:
  - Parse the scanned JSON data.
  - Issue the `earn` transaction using the parsed `customer` and `merchant` values.

---

## Verification Plan

### Automated Tests
- Type checking verification:
  ```powershell
  npx tsc --noEmit
  ```

### Manual Verification
1. Log in on a customer profile account, confirm stamp cards load empty, and the notification banner appears.
2. Log in on a merchant profile account, type in a customer's phone number on the `/give` screen, and submit.
3. Confirm that the customer's balance updates instantly via SSE, and the unread notification badge is updated in the dashboard header.
