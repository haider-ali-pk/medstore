// frontend/lib/policies.js   (NEW FILE)
import { formatMoney } from "./format";

export const PAGES = {
  terms:    { title: "Terms & Conditions",         field: "termsText" },
  privacy:  { title: "Privacy Policy",             field: "privacyText" },
  returns:  { title: "Returns & Refund Policy",    field: "returnPolicy" },
  shipping: { title: "Shipping & Delivery Policy", field: "shippingPolicy" },
  about:    { title: "About Us",                   field: "aboutText" },
};

const contact = (b) => {
  const l = [
    b.phone && `- Phone: ${b.phone}`,
    b.whatsapp && `- WhatsApp: ${b.whatsapp}`,
    b.email && `- Email: ${b.email}`,
    b.address && `- Address: ${b.address}`,
    b.openingHours && `- Opening hours: ${b.openingHours}`,
  ].filter(Boolean);
  return l.length ? l.join("\n") : "- Please use the Contact page of this website.";
};

const terms = (b) => `# 1. About these terms
These Terms & Conditions apply to every visit to this website and every order placed through it. The website is operated by ${b.name}${b.licenseNo ? ` (pharmacy licence no. ${b.licenseNo})` : ""}. By browsing the site, creating an account or placing an order you confirm that you have read and accepted these terms together with our Privacy Policy, Returns & Refund Policy and Shipping & Delivery Policy.

# 2. Your account
You must be at least 18 years old to create an account or place an order. You are responsible for keeping your password confidential and for all activity under your account. Please give an accurate name, phone number and delivery address so that your order can reach you.

# 3. Products and availability
We sell medicines, healthcare products, medical devices and other accessories. Product pictures are for illustration and packaging may change. All items are subject to availability. If an item you ordered is not available we will contact you, and we will never replace a medicine with another one without your agreement.

# 4. Prescription medicines
Prescription-only medicines are supplied only against a valid prescription from a registered medical practitioner. Upload a clear photo of the prescription at checkout. Our pharmacist verifies it before the order is dispatched and may contact you for clarification. We may refuse or cancel an order for prescription medicine if the prescription is missing, unclear, expired or cannot be verified. A person aged 18 or over should be available to receive prescription medicines.

# 5. Prices and payment
All prices are in ${b.currency === "PKR" ? "Pakistani Rupees (PKR)" : b.currency}. Delivery charges, if any, are shown at checkout before you confirm your order. If we find an obvious pricing error we will contact you before processing the order at the corrected price.
${[
  b.codEnabled && "- Cash on delivery: pay the rider in cash when your order arrives.",
  b.walletEnabled && "- JazzCash / Easypaisa / bank transfer: pay first and enter the transaction ID at checkout. The order is confirmed after we verify the payment.",
  b.cardEnabled && "- Debit / credit card: paid securely online at checkout.",
].filter(Boolean).join("\n")}

# 6. Orders and cancellation
Placing an order is an offer to buy. An order is accepted when we confirm it. We may decline or cancel an order for reasons such as: the item is out of stock, an error in price or product information, a missing or invalid prescription, unusual quantities, safety concerns, payment problems, an address we cannot deliver to, or suspected fraud. You can cancel an order before it is shipped by contacting us. Orders that have already shipped follow the Returns & Refund Policy.

# 7. Delivery
Delivery times, charges and conditions are explained in the Shipping & Delivery Policy. Risk in the goods passes to you when the order is delivered to the address you gave.

# 8. Returns and refunds
Because medicines affect health, they cannot be returned once delivered except in the cases described in the Returns & Refund Policy.

# 9. Health information
Information on this website is for general guidance and does not replace advice from a doctor or pharmacist. Always read the label and leaflet, and consult a healthcare professional if you are unsure, pregnant, giving medicine to a child or taking other medicines. In an emergency contact your doctor or go to the nearest hospital.

# 10. Acceptable use
Do not misuse this website, try to access it without permission, submit false prescriptions, or place orders for others without their consent. We may suspend accounts that break these terms.

# 11. Limitation of liability
To the extent allowed by law, ${b.name} is not liable for indirect or consequential loss, or for delays caused by events outside our control such as courier delays, strikes or severe weather. Nothing in these terms limits your rights under Pakistani consumer law or our responsibility to supply genuine, correctly labelled products.

# 12. Governing law
These terms are governed by the laws of the Islamic Republic of Pakistan, and the courts of Pakistan have jurisdiction over any dispute.

# 13. Changes to these terms
We may update these terms from time to time. The version published on this page applies to orders placed after the update.

# 14. Contact us
${contact(b)}`;

const privacy = (b) => `# 1. Who we are
${b.name} operates this website. This policy explains what personal information we collect, why we collect it and the choices you have.

# 2. Information we collect
- Account details: name, email address, phone number and password (stored in encrypted form).
- Order details: delivery name, phone, address, city, items ordered, payment method and payment reference.
- Prescription images, which are health information, when you order prescription medicines.
- Data kept in your browser: your login session and shopping cart.

# 3. How we use your information
- To process, deliver and support your orders.
- To verify prescriptions and meet pharmacy regulations.
- To contact you about your order, for example by phone or WhatsApp.
- To prevent fraud and to keep records the law requires.
We do not sell your personal information.

# 4. Prescriptions and health information
Prescription images are stored privately and are opened only by our pharmacy staff to verify and fulfil your order, using short-lived secure links. We do not use them for marketing.

# 5. Who we share it with
We share only what is needed with couriers (name, phone and address), with payment providers when you pay online, and with authorities when the law requires it.

# 6. Security and retention
We protect your data with access controls and encrypted passwords. We keep order and prescription records for as long as needed to serve you and to meet legal and pharmacy record-keeping duties, then delete or anonymise them.

# 7. Your choices
You can ask us to show you the information we hold, correct it, or delete your account, subject to records we must keep by law. Contact us using the details below.

# 8. Browser storage
This website stores your login session and shopping cart in your browser so the shop works. You can clear this at any time from your browser settings.

# 9. Children
This website is meant for adults. Parents and guardians may order for their children.

# 10. Changes to this policy
We may update this policy. The latest version is always on this page.

# 11. Contact us
${contact(b)}`;

const returns = (b) => `# 1. Medicines
For your safety, medicines cannot be returned or exchanged once delivered, unless:
- you received the wrong item,
- the package is damaged, leaking or tampered with, or
- the medicine is expired or close to expiry.
Please report the problem within 48 hours of delivery with your order number and a photo of the item and its packaging. We will replace the item or refund you.

# 2. Other accessories and devices
Non-medicine items (for example computer accessories, sports goods and general health devices) can be returned within 7 days of delivery if they are unused, in original packaging and complete with all parts. Faulty items covered by a manufacturer warranty are repaired or replaced under that warranty. Please contact us first.

# 3. How to request a return
Contact us with your order number, the item and the reason, and photos if the item is damaged or wrong. We reply within 1 to 2 working days and tell you what to do next.

# 4. Refunds
Approved refunds are paid back using the original payment method. Wallet and bank payments are usually refunded within 5 to 7 working days. Cash-on-delivery refunds are sent by bank transfer or mobile wallet. Delivery charges are refunded only when the return is because of our mistake.

# 5. Cancelled orders
If you cancel before your order is shipped, or if we cancel it, any payment you made is refunded in full.

# 6. Items we cannot take back
Opened or used medicines, prescription medicines (except as in section 1), items without original packaging, and items damaged after delivery.

# 7. Contact us
${contact(b)}`;

const shipping = (b) => {
  const money = (n) => formatMoney(n, b.currency);
  const fee = Number(b.deliveryFee || 0) > 0 ? `A delivery charge of ${money(b.deliveryFee)} applies to each order.` : "Delivery is free.";
  const free = b.freeDeliveryOver != null && Number(b.deliveryFee || 0) > 0 ? ` Orders of ${money(b.freeDeliveryOver)} or more are delivered free.` : "";
  return `# 1. Where we deliver
We deliver to addresses across Pakistan wherever our couriers operate. Enter your full address and city at checkout.

# 2. Delivery charges
${fee}${free} The exact amount is always shown at checkout before you place the order.

# 3. Processing and delivery time
Orders are usually processed within 1 working day. After dispatch, delivery normally takes 1 to 3 working days in major cities and 3 to 7 working days elsewhere. Orders that contain prescription medicine are dispatched after our pharmacist has verified the prescription, which can add some time.

# 4. Tracking your order
Follow the status of your order any time under My orders. We may also call or WhatsApp you to confirm details.

# 5. Receiving your order
Please keep your phone reachable on the day of delivery and check the parcel when it arrives. Report any damage straight away. For prescription medicines a person aged 18 or over should be present. If we cannot reach you the order may be returned to us; we will contact you to arrange another delivery, and repeated failed deliveries may lead to cancellation.

# 6. Delays
Courier delays, public holidays, bad weather and other events outside our control can affect delivery times. We will keep you informed if your order is delayed.

# 7. Contact us
${contact(b)}`;
};

const about = (b) => `# Who we are
${b.name} brings genuine medicines, healthcare products and everyday accessories to your door.${b.licenseNo ? ` We operate under pharmacy licence no. ${b.licenseNo}.` : ""}

# What we offer
- Medicines and healthcare products from licensed suppliers
- Medical devices and wellness essentials
- Other accessories and general items

# Our promise
- Genuine products with clear prices in rupees
- Prescription medicines only against a valid prescription
- Friendly help by phone or WhatsApp

# Visit or contact us
${contact(b)}`;

const MAKERS = { terms, privacy, returns, shipping, about };
export const defaultText = (slug, brand) => MAKERS[slug](brand || {});