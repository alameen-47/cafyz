# Cafyz — reply to App Review (4.3 / 4.2.6)

**Where to send:** App Store Connect → Cafyz → App Review → the rejected
submission (`d49f7513-deff-4c5d-8163-1a11aab464b9`) → **Reply to App Review**.

**Do NOT press "Resubmit to App Review" first.** Apple's message says to reply,
not resubmit. Send this reply and wait for their response.

## Before sending — two things must be confirmed by Ameen

1. **Question 4 (beta testing).** The text below says there was no formal
   external beta, only internal device testing. If that is wrong, correct it.
   **Never invent testers or feedback** — Apple can check TestFlight records.
2. **Question 9 (built for a client?).** The text says Cafyz is Ametronyx's own
   product. If any part of it was made for a specific restaurant client who
   supplied the concept or branding, this must be said — guideline 4.2.6 turns
   on exactly that.

Also confirm: the Render API is on an always-on instance, and the demo login
`reviewer@cafyz.com` works with every screen unlocked.

Send this about **Cafyz only**. Do not mention the other submissions' status,
and do not file an expedite request alongside it.

---

```
Hello App Review,

Thank you for the detailed questions. Below are full answers for Cafyz.

1. What the app does and the problem it solves

Cafyz is the software a restaurant or café runs its service on. A small
restaurant typically takes orders on a paper pad, shouts or carries them to the
kitchen, adds the bill by hand, and reconciles the day from a cash drawer and a
stack of slips. Orders get lost between the floor and the kitchen, tables are
double-seated, the printed bill does not match what was served, and the owner
has no reliable view of what sold.

Cafyz replaces that loop. A waiter takes an order on the phone against a table
or as a quick counter bill; the moment it is saved it appears on the kitchen
display, where cooks mark each item as it is prepared, so the floor can see
without walking to the pass. Tables show their state and open tabs. Bills split,
discount and settle across payment methods, and print to a Bluetooth thermal
receipt printer at the counter along with kitchen tickets. The menu — categories,
items, modifiers, photos, prices — is edited in the app and also published as a
QR menu guests can open on their own phones. Stock levels draw down as items
sell. Staff get individual logins with role-based access, so a cashier cannot
see payroll or analytics. The dashboard and reports show daily sales, top items
and period comparisons.

The problem it solves is the gap between the floor, the kitchen and the till in
a single small venue: one order record that the waiter, the cook, the cashier
and the owner all see, instead of four versions on paper.

2. Intended users

Owners, managers and floor staff of independent restaurants, cafés, bakeries,
cloud kitchens and small chains — typically one to five outlets, five to forty
covers, where the owner is usually on site. Our first market is India (prices
in rupees by default; other currencies are supported), and the interface is
available in eleven languages including Arabic with right-to-left layout.

Accounts belong to a restaurant. There is no public consumer sign-up: every
user — owner, manager, cashier, kitchen, waiter — is created under a specific
restaurant. The only part guests touch is the read-only QR menu, which needs no
account.

3. The gap it addresses

Restaurant software tends to split into two camps. On one side, full POS
suites built for chains: priced per terminal, sold with proprietary hardware,
set up by a dealer, and far beyond what a thirty-cover café will buy or run. On
the other, single-purpose phone apps — a billing app, or a QR-menu app, or a
kitchen-ticket app — that each solve one slice and do not share an order record,
so the venue still re-keys everything.

Cafyz is one product for a venue of that size, running on the phones and tablets
the staff already own, with no dedicated till hardware: order, kitchen display,
table, bill, printer, stock, staff roles and reports on the same record. Two
things in particular are built for this market rather than retrofitted: billing
and receipts are built around Indian practice and rupee rounding, and printing
targets the inexpensive 58/80 mm Bluetooth ESC/POS printers already standing on
these counters, driven natively over Bluetooth LE rather than through a browser
API that does not exist inside an app. The app also runs the whole service
offline-tolerantly and re-syncs, because connectivity in these venues is not
dependable.

4. Beta testing

We have not run a formal external TestFlight beta. Before submitting, our team
tested Cafyz on a range of devices — iPhones and iPads of several sizes, Android
phones including older models, and desktop browsers — against a sample
restaurant with owner, manager, cashier, kitchen and waiter accounts, and with a
physical Bluetooth thermal printer at a real counter.

Changes made as a result of that testing and present in this build include:
taking orders was reworked into a one-tap counter bill with tables optional,
because on a real counter the common case is a walk-in paying immediately rather
than a seated table; content was moved clear of the iPhone status bar, Dynamic
Island and home indicator; live screens such as the kitchen display were made
much cheaper to keep on screen after they were found to drain the battery on a
device left running all service; sessions were made durable so staff were not
signed out mid-shift; and offline failures were given a clear explanation and an
automatic retry instead of a blank error.

5. Standalone product, or part of a suite

Cafyz is a standalone product. Our developer account also publishes or has
submitted:

- Ametronyx — project and invoice management for freelancers and agencies.
- AxPro ERP — business management (sales, inventory, purchasing, accounting, HR)
  for companies in Saudi Arabia.
- Coorg Trade — software for agricultural produce traders in South India buying
  coffee, pepper, cardamom and arecanut from estates.
- CREDI8 — a credit book for shop owners to track what customers owe.
- FitCore Plus — gym management plus a member app for the gym's members.

None of them serves restaurants. None contains a point of sale for food service,
a kitchen display, table or reservation management, a menu with modifiers, a
guest QR menu, or food stock. The users do not overlap: a café owner has no use
for an estate purchase ledger, an HR module or a gym check-in, and none of those
businesses needs to send a ticket to a kitchen.

6. Could this be an in-app purchase or a feature inside another of our apps

No. The functionality is not an increment on any existing app of ours — it is
the operational core of a different business. Cafyz's central object is an order
moving from floor to kitchen to bill in minutes, with a kitchen display and a
receipt printer attached to it. No other app on our account has orders, covers,
tables, menus or kitchens at all, so there is nothing to extend.

Folding it in would also be wrong for the people using it. A restaurant's floor
staff and cooks would have to install an ERP or a gym app and work around
screens meant for accountants or trainers, and those apps' existing users would
be shown a kitchen display they have no use for. The pricing and the buyer are
different too: Cafyz is licensed per restaurant.

7. Code, frameworks or assets shared with our other apps

No significant code or assets are shared. Cafyz has its own repository, its own
backend and database, its own design and icon, and its own screens — the point
of sale, kitchen display, table map, menu editor, QR menu, inventory, staff
roles and analytics were all written for this app and exist in no other app on
our account. Its Bluetooth printing layer is written against the ESC/POS
receipt formats this trade uses.

What is genuinely in common is what any team shares across products: the same
widely used open-source libraries (listed under question 8) and our company
name, Ametronyx, as the developer. No screen, feature or asset was copied
between Cafyz and another app on the account.

8. Code, SDKs or content shared with third-party apps

Only standard third-party frameworks: React, Capacitor as the native app shell,
and ordinary open-source UI and utility libraries. Our first interface prototype
was generated with Figma Make, Figma's design-to-code tool, from our own design;
everything after that — the backend, the data model, the point of sale, the
kitchen display, the printing, the roles system — is our own work. We did not
buy or licence a restaurant-app template, and Cafyz does not share a codebase or
content library with any other company's app.

9. Was this app created for a client, partner or third party

No. Cafyz is Ametronyx's own product. We designed it, we own the brand and all
of its content, and we sell licences directly to restaurants. Because we are the
provider of the app's content, we submit it under our own developer account.

Notes on this build

The iPhone and iPad app contains no purchase, price or renewal prompt of any
kind; a restaurant that already holds a licence enters its key, and billing is
handled entirely outside the app. A demo login with a fully provisioned sample
restaurant is in App Review Information — every screen is unlocked on that
account, including the kitchen display and analytics.

Thank you for your time.

Ameen Khan
Ametronyx
```
