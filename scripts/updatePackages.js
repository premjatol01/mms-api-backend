const mongoose = require('mongoose');
require('dotenv').config({ path: __dirname + '/../.env' });
const Package = require('../models/Package');

async function updatePackages() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB Atlas...');

  // Remove old packages to avoid duplicates and cleanly insert updated ones
  await Package.deleteMany({});

  const packagesData = [
    {
      name: "1 Month Free Trial",
      description: "Full-access 30-day risk-free trial for new restaurants with complete platform features",
      maxTables: 15,
      features: [
        "Digital QR Menu & Contactless Ordering",
        "Printable QR Code Generation & PNG Downloads",
        "Live Table Sessions & Bill Calculation",
        "Request Waiter Handler (Water, Call Captain, Bill)",
        "Interactive Table Games (Trivia, Dare Spin, Tic-Tac-Toe)",
        "Dedicated Restaurant Website & Subdomain",
        "Special Offers & Promotional Banners",
        "Google Review Booster (Boost 5-Star Ratings)",
        "Biz Growth Hub & Masterclasses",
        "Full Platform Access for 30 Days"
      ],
      price: 0,
      status: "active",
      pricing: [
        {
          duration: "free_trial",
          durationDays: 30,
          durationDisplay: "1 Month Free Trial (30 Days)",
          price: 0,
          isPopular: true
        }
      ]
    },
    {
      name: "Starter Plan",
      description: "Essential table QR ordering and digital presence for cafes & quick-service food trucks",
      maxTables: 10,
      features: [
        "Digital QR Menu & Contactless Ordering",
        "Printable QR Generation & Sharp PNG Downloads",
        "Live Table Sessions & Real-Time Bill Calculation",
        "Request Waiter Handler (Water, Call Captain)",
        "Dedicated Restaurant Website & Subdomain",
        "Basic Order Management & Sales History",
        "Up to 10 Restaurant Tables",
        "Email & Community Support"
      ],
      price: 499,
      status: "active",
      pricing: [
        {
          duration: "monthly",
          durationDays: 30,
          durationDisplay: "1 Month",
          price: 499,
          isPopular: false
        },
        {
          duration: "yearly",
          durationDays: 365,
          durationDisplay: "1 Year",
          price: 4999,
          isPopular: true
        }
      ]
    },
    {
      name: "Pro Growth Plan",
      description: "Complete dine-in ordering, guest games & marketing automation for growing restaurants",
      maxTables: 35,
      features: [
        "Everything in Starter Plan",
        "Up to 35 Restaurant Tables Capacity",
        "Custom Branded Designer QR Standee Templates",
        "High-Res Sharp PNG & ZIP Batch Downloads",
        "Interactive Table Games Hub (Foodie Trivia, Dare & Spin, Tic-Tac-Toe)",
        "Promotional Offers & Coupon Code Engine",
        "Instagram Follow & Win 10% Discount Campaign",
        "Guest Wi-Fi QR Code Sharing",
        "Google Review Booster (Boost 5-Star Dine-In Ratings)",
        "Biz Growth Hub (Video Masterclasses & Playbooks)",
        "Priority WhatsApp & Phone Support"
      ],
      price: 1499,
      status: "active",
      pricing: [
        {
          duration: "monthly",
          durationDays: 30,
          durationDisplay: "1 Month",
          price: 1499,
          isPopular: false
        },
        {
          duration: "yearly",
          durationDays: 365,
          durationDisplay: "1 Year",
          price: 14990,
          isPopular: true
        }
      ]
    },
    {
      name: "Enterprise Plan",
      description: "Complete multi-staff management, AI menu engineering & dedicated support for busy venues & chains",
      maxTables: 100,
      features: [
        "Everything in Pro Growth Plan",
        "Up to 100 Restaurant Tables (Multi-Zone/Floor)",
        "AI Menu Engineering & Smart Marketing Prompts",
        "Multi-Staff Access & Role Management",
        "Advanced Billing, GST Management & Sales Reports",
        "Custom QR Standee Graphic Design Requests",
        "Dedicated Account Manager & 24/7 VIP Concierge Support"
      ],
      price: 3499,
      status: "active",
      pricing: [
        {
          duration: "monthly",
          durationDays: 30,
          durationDisplay: "1 Month",
          price: 3499,
          isPopular: false
        },
        {
          duration: "yearly",
          durationDays: 365,
          durationDisplay: "1 Year",
          price: 34990,
          isPopular: true
        }
      ]
    }
  ];

  const created = await Package.insertMany(packagesData);
  console.log(`Successfully created ${created.length} packages in MongoDB:`);
  created.forEach((p) => {
    console.log(`- ${p.name} (₹${p.price}) [${p.pricing.length} pricing tiers, ${p.features.length} features]`);
  });

  process.exit(0);
}

updatePackages().catch((err) => {
  console.error("Error updating packages:", err);
  process.exit(1);
});
