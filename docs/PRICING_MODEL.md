# Pricing Model - Galveston Reservation System

**Status:** Draft  
**Last Updated:** 2026-05-27

---

## 1. Nightly Rate Structure

| Rate Type     | Nightly Rate | Applies To                  | Notes |
|---------------|--------------|-----------------------------|-------|
| **Weekday**   | $500        | Monday – Thursday nights    | - |
| **Weekend**   | $650        | Friday – Sunday nights      | See night counting rules below |
| **Holiday**   | $700        | Designated holidays         | **Overrides** Weekend and Weekday rates |

### Weekly Discount
- **$350 discount per 7 nights** (applied at the per-stay level).
- Example: A 7-night stay receives a $350 discount.
- A 14-night stay would receive a $700 discount (2 × $350).
- This discount applies after the nightly rates are calculated.

---

## 2. Night Counting Rules (Confirmed)

- All pricing is calculated **per night stayed**.
- Check-in time: After 3:00 PM
- Check-out time: Before 11:00 AM
- A stay from **Friday to Monday** (F-M) is charged as **3 nights**:
  - Example: Check-in Friday 3pm+ → Check-out Monday before 11am = **Friday night + Saturday night + Sunday night**.

This means we **cannot** use a simple `Math.ceil((end - start) / 86400000)` calculation. We must count the actual nights the guest is occupying the property.

---

## 3. Holiday Rate Strategy (Recommendations)

Since holidays override both weekday and weekend rates, we need a clean way to manage them.

### Recommended Approach

1. **Maintain a Holiday Calendar** in the database (or a config file that can be edited by admin).
2. Each holiday entry should have:
   - Name (e.g., "July 4th", "Thanksgiving", "Spring Break")
   - Start Date
   - End Date (inclusive of nights)
   - Optional: Notes

3. **Holiday Detection Logic**:
   - If **any night** of the stay falls within a defined holiday period → that night is charged at the Holiday rate ($700).
   - Holidays take full precedence over Weekend ($650) and Weekday ($500) rates.

### Suggested Initial Holiday Set for Galveston

Here’s a reasonable starting list for a Galveston short-term rental:

- New Year’s Eve / New Year’s Day period
- Spring Break (typically late Feb – mid March, often 2 weeks)
- Memorial Day weekend
- July 4th week
- Labor Day weekend
- Thanksgiving week
- Christmas / Winter Holiday period (Dec 20 – Jan 2 or similar)

**Recommendation**: Start with a small, manageable list and let the admin easily add/edit dates through an interface later.

---

## 4. Seasonal Rates Strategy (Recommendations)

You mentioned wanting seasonal rates in the future. Here’s a pragmatic way to approach it:

### Proposed Model

Instead of hard-coding rates forever, we can define **Seasons** that can override or layer on top of the base Weekday/Weekend rates.

Example structure:

| Season          | Weekday Rate | Weekend Rate | Applies To                  |
|-----------------|--------------|--------------|-----------------------------|
| Peak Summer     | $550         | $750         | June 1 – Aug 15             |
| Shoulder        | $500         | $650         | Mar 15 – May 31, Sep 1 – Oct 31 |
| Off-Season      | $400         | $500         | Nov 1 – Feb 28 (except holidays) |
| Holiday         | $700         | $700         | Defined holiday periods     |

### Implementation Thoughts

- Seasons can be date-range based.
- Holiday rates should still override seasonal rates.
- This gives you flexibility to adjust rates over time without changing code.
- The Rate Calculator would first determine the season for each night, then apply weekday/weekend/holiday logic on top.

Would you like me to propose a first draft of seasons for this property?

---

## 5. Price Breakdown & Fee Structure

This is the detailed fee/tax/commission model for the property.

### Guest-Facing Price (What the customer pays and sees)

| Component                    | Rate / Amount          | Notes |
|-----------------------------|------------------------|-------|
| **Nightly Fees**            | See Section 1         | Calculated from weekday/weekend/holiday rates + weekly discount |
| **Jamaica Beach, TX Hotel Tax** | 9%                  | Local hotel occupancy tax |
| **Texas State Hotel Tax**   | 6%                     | State-level hotel tax |
| **Cleaning Fee**            | $300 (flat)            | Per stay |
| **Total Price to Guest**    | Sum of above           | This is what gets quoted and charged |

**Important**: Items 1–4 above are **added together** and shown to the guest.

### Internal Payout Breakdown (Manager vs Owner)

| Component                  | Rate          | Notes |
|---------------------------|---------------|-------|
| **Management Fee**        | 22%           | Goes to the property manager. Tracked separately for owner payouts. |
| **Owner Proceeds**        | 78%           | Remaining amount after management fee (before or after taxes — to be confirmed). |

**Key Distinction**:
- The **22% management fee** is **not** shown to the guest.
- It must be tracked internally for financial reporting and owner payments.

### Proposed Stored Pricing Structure

```ts
type BookingPricing = {
  // === Guest Facing ===
  baseNightlyTotal: number;           // Sum of nightly fees after discounts
  jamaicaBeachTax: number;            // 9%
  texasStateTax: number;              // 6%
  cleaningFee: number;                // $300
  totalGuestPrice: number;            // What the guest actually pays

  // === Internal Breakdown ===
  managementFee: number;              // 22% (not shown to guest)
  ownerProceeds: number;              // Remaining amount for owner

  // Optional future breakdown
  taxBreakdown?: {
    jamaicaBeach: number;
    texasState: number;
  };
  feeBreakdown?: {
    cleaning: number;
    management: number;
  };
};
```

---

## 6. Pricing Calculation Approach (Proposed)

We will likely need a **Rate Calculator** service that can:

1. Take a date range (check-in + check-out).
2. Determine the rate type for each night (Weekday / Weekend / Holiday).
3. Apply weekly discounts when applicable.
4. Return a detailed breakdown:
   - Total base rate
   - Number of weekday nights
   - Number of weekend nights
   - Number of holiday nights
   - Weekly discount applied (if any)

The admin should be able to:
- See the system-calculated base rate when reviewing a request.
- Adjust the base rate if needed (with reason logging).
- Then add/confirm Taxes and Commission.

---

## 7. Open Questions

**Pricing & Fees**
- Is the 22% management fee calculated on (Base Nightly + Cleaning Fee), or on the full amount before/after taxes?
- Who is responsible for remitting the 9% + 6% hotel taxes (manager or owner)?
- Does the $300 cleaning fee go entirely to the owner, or is any portion kept by the manager?
- Should the 22% management fee also apply to the cleaning fee?

**Other**
- [Resolved] How exactly is the $350 weekly discount applied?
- [Resolved] Do holidays override weekend rates?
- How should we manage and maintain the list of holiday dates?
- What should the initial set of holiday periods be for this property?
- How should we structure seasonal rates (what seasons, what rate changes)?
- Will different channels (VRBO vs direct) have different commission rates?
- How do we want to handle VRBO rate/availability sync? (see VRBO Sync Strategy below)

---

## 7. VRBO Sync Strategy

Since VRBO bookings will use **VRBO’s own rates and booking process**, the main requirement for this system is **availability synchronization**.

### Recommended Approach

- Primary goal: Pull VRBO’s calendar so this system knows which dates are already booked on VRBO.
- We do **not** need to pull VRBO pricing for those bookings (they are managed on VRBO).
- We will implement **bidirectional** sync so this system can also block dates on VRBO.

### Decisions (May 2026)

- **Sync Method**: Bidirectional iCal feed
  - **Inbound**: Import blocked dates from VRBO into this system.
  - **Outbound**: Export blocked dates from this system back to VRBO.

- **Sync Frequency**: Daily is acceptable.

- **Conflict Handling**: Let the admin decide (manual resolution when conflicts are detected).

- **Data Expectations**: Capture dates + guest name from VRBO if the iCal feed provides it. Accept whatever data is available (many iCal feeds are limited to dates only for privacy reasons).

**Important Limitations of iCal**:
- iCal is primarily for availability. It does **not** reliably carry guest details, pricing, or booking status.
- Sync is not real-time (daily frequency as decided).
- Handling cancellations and modifications can be unreliable.
- True real-time bidirectional sync is difficult with pure iCal.

We will need a scheduled sync job (daily) that manages both the inbound and outbound iCal feeds.

---

## 8. Next Steps (Pricing & VRBO)

**Pricing & Fees**
- [x] Define weekly discount logic ($350 per 7 nights at stay level)
- [x] Confirm holidays override weekend rates
- [x] Document full fee/tax/commission breakdown (9% + 6% + $300 cleaning + 22% management)
- [ ] Clarify base for 22% management fee calculation (nightly only? + cleaning? + taxes?)
- [ ] Decide tax remittance responsibility (manager vs owner)
- [ ] Define how cleaning fee is split (if at all)

**System Design**
- [ ] Define holiday date management strategy + initial holiday list
- [ ] Design seasonal rate structure
- [ ] Design the Rate Calculator service (night-by-night logic + all fees)

**VRBO**
- [x] Decide VRBO calendar sync method → **Bidirectional iCal feed**
- [x] Confirm sync frequency → Daily
- [x] Confirm conflict handling → Admin decides manually
- [ ] Design the bidirectional iCal sync service / daily jobs
- [ ] Decide data model for imported VRBO bookings (what fields to store)
- [ ] Decide if richer VRBO integration (via API) is needed in the future
