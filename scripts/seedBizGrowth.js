const mongoose = require('mongoose');
const BizGrowth = require('../models/BizGrowth');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const MONGO_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/tablly';

const sampleResources = [
  // ---------------------------------------------------------------------------
  // YouTube Videos (Video Masterclasses)
  // ---------------------------------------------------------------------------
  {
    title: 'What is Menu Engineering: Design Your Menu for Maximum Profit',
    type: 'youtube',
    url: 'https://www.youtube.com/watch?v=O8c8F_020r0',
    thumbnail: 'https://img.youtube.com/vi/O8c8F_020r0/hqdefault.jpg',
    description: 'Ryan Gromfin (The Restaurant Boss) breaks down how to strategically design, place, and price menu items to maximize profitability and guide customer choices.',
    content: 'Learn the psychology of removing dollar signs, placing items in golden eye-magnets, and separating high-margin dishes from low-margin items.',
    category: 'Menu & Pricing',
    platform: 'YouTube',
    sourceName: 'The Restaurant Boss',
    readTime: '12 min video',
    featured: true,
    status: 'active',
    viewsCount: 342,
    order: 1
  },
  {
    title: 'How To Do Menu Engineering: Double Your Restaurant Profit',
    type: 'youtube',
    url: 'https://www.youtube.com/watch?v=QtVfZuNuR5g',
    thumbnail: 'https://img.youtube.com/vi/QtVfZuNuR5g/hqdefault.jpg',
    description: 'Comprehensive analysis from studying 6,000+ restaurant menus to see what layout, typography, and pricing tricks actually compel guests to spend more.',
    content: 'Data-driven insights from Owner.com on menu psychology, upsell anchors, and eliminating items that slow down kitchen operations.',
    category: 'Operations',
    platform: 'YouTube',
    sourceName: 'Learn with Owner.com',
    readTime: '15 min video',
    featured: false,
    status: 'active',
    viewsCount: 218,
    order: 2
  },
  {
    title: 'Menu Matrix Explained: Engineer Your Restaurant\'s Menu for Success',
    type: 'youtube',
    url: 'https://www.youtube.com/watch?v=WOA6hKjUCNo',
    thumbnail: 'https://img.youtube.com/vi/WOA6hKjUCNo/hqdefault.jpg',
    description: 'Toast POS explains the classic 4-quadrant menu matrix: Stars, Plowhorses, Puzzles, and Dogs. Learn how to identify each using POS sales data.',
    content: 'Categorize your dishes by profitability and popularity. Protect your stars, reposition your puzzles, and eliminate dogs.',
    category: 'Menu & Pricing',
    platform: 'YouTube',
    sourceName: 'Toast POS',
    readTime: '9 min video',
    featured: false,
    status: 'active',
    viewsCount: 189,
    order: 3
  },
  {
    title: 'Menu Engineering That Actually Moves Restaurant Profit',
    type: 'youtube',
    url: 'https://www.youtube.com/watch?v=zF74tKY1Hpo',
    thumbnail: 'https://img.youtube.com/vi/zF74tKY1Hpo/hqdefault.jpg',
    description: 'David Scott Peters explains how confusing raw food cost % with contribution margin costs restaurants thousands, and how to fix it.',
    content: 'Focus on gross margin dollars brought to the bank rather than just percentages. Learn how to trim a bloated menu.',
    category: 'Cost Reduction',
    platform: 'YouTube',
    sourceName: 'The Restaurant Prosperity Formula',
    readTime: '14 min video',
    featured: false,
    status: 'active',
    viewsCount: 154,
    order: 4
  },
  {
    title: 'How to Manage a Restaurant: Understanding the Most Important Numbers',
    type: 'youtube',
    url: 'https://www.youtube.com/watch?v=0FEGSJPm1hU',
    thumbnail: 'https://img.youtube.com/vi/0FEGSJPm1hU/hqdefault.jpg',
    description: 'Learn the primary financial metrics every restaurant owner must track weekly: prime cost, food cost variance, and labor percentage.',
    content: 'Demystifying profit and loss statements so independent restaurant owners can make confident operational decisions.',
    category: 'Operations',
    platform: 'YouTube',
    sourceName: 'The Restaurant Boss',
    readTime: '18 min video',
    featured: false,
    status: 'active',
    viewsCount: 275,
    order: 5
  },
  {
    title: 'How To Manage a Restaurant: Create Systems & Standard Operating Procedures',
    type: 'youtube',
    url: 'https://www.youtube.com/watch?v=csKgRAYSKJo',
    thumbnail: 'https://img.youtube.com/vi/csKgRAYSKJo/hqdefault.jpg',
    description: 'Transform your restaurant from chaotic fires to a self-running system using opening/closing checklists, prep sheets, and station audits.',
    content: 'Step-by-step framework to document your kitchen and dining room processes so quality stays consistent even when you are off-site.',
    category: 'Staff Management',
    platform: 'YouTube',
    sourceName: 'The Restaurant Boss',
    readTime: '11 min video',
    featured: false,
    status: 'active',
    viewsCount: 198,
    order: 6
  },

  // ---------------------------------------------------------------------------
  // Blog Posts (Articles & Guides)
  // ---------------------------------------------------------------------------
  {
    title: 'The Ultimate Guide to Restaurant Menu Engineering',
    type: 'blog',
    url: 'https://pos.toasttab.com/blog/on-the-line/menu-engineering',
    thumbnail: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=800&q=80',
    description: 'Discover how to analyze food costs, calculate item contribution margins, and place high-margin dishes in golden eye-magnets to maximize profits.',
    content: 'Full breakdown of item placement, sensory descriptions, removing currency symbols, and utilizing decoy items to elevate mid-tier spending.',
    category: 'Menu & Pricing',
    sourceName: 'Toast POS Blog',
    readTime: '8 min read',
    featured: true,
    status: 'active',
    viewsCount: 420,
    order: 7
  },
  {
    title: 'How to Reduce Restaurant Labor Costs Without Understaffing',
    type: 'blog',
    url: 'https://www.7shifts.com/blog/restaurant-labor-cost/',
    thumbnail: 'https://images.unsplash.com/photo-1556910103-1c02745aae4d?w=800&q=80',
    description: 'Master the art of predictive labor scheduling, cross-training shifts, and keeping your prime cost under 60% without hurting guest experience.',
    content: 'Actionable scheduling tips, overtime controls, and station pacing designed to protect dining room service while optimizing payroll.',
    category: 'Operations',
    sourceName: '7shifts Academy',
    readTime: '6 min read',
    featured: false,
    status: 'active',
    viewsCount: 312,
    order: 8
  },
  {
    title: '10 Proven Ways to Increase Restaurant Table Turnover Without Rushing Guests',
    type: 'blog',
    url: 'https://www.lightspeedhq.com/blog/table-turnover/',
    thumbnail: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=800&q=80',
    description: 'Learn how modern QR code ordering, speedy kitchen checkouts, and layout flow allow cafes and bistros to seat 20% more diners on peak weekends.',
    content: 'Streamline the ordering and payment bottleneck. Eliminating the 10-minute wait for checks increases table turns and server gratuities.',
    category: 'Operations',
    sourceName: 'Lightspeed HQ',
    readTime: '7 min read',
    featured: false,
    status: 'active',
    viewsCount: 265,
    order: 9
  },
  {
    title: 'Restaurant Server Upselling Techniques That Actually Work',
    type: 'blog',
    url: 'https://www.touchbistro.com/blog/restaurant-upselling-techniques/',
    thumbnail: 'https://images.unsplash.com/photo-1544025162-d76694265947?w=800&q=80',
    description: 'Train your front-of-house staff to recommend pairing suggestions, describe dishes vividly, and naturally boost average ticket size by $4-$8 per guest.',
    content: 'Scripting techniques, appetizing adjectives, and timing principles that delight guests rather than feeling pushy.',
    category: 'Staff Management',
    sourceName: 'TouchBistro Guide',
    readTime: '5 min read',
    featured: false,
    status: 'active',
    viewsCount: 184,
    order: 10
  },

  // ---------------------------------------------------------------------------
  // Industry News (Industry News & Market Trends)
  // ---------------------------------------------------------------------------
  {
    title: 'How Dine-in QR Ordering & Mobile Menus are Boosting Check Sizes by 22%',
    type: 'news',
    url: 'https://www.nrn.com/technology/how-restaurants-use-digital-ordering-boost-efficiency',
    thumbnail: 'https://images.unsplash.com/photo-1552566626-52f8b828add9?w=800&q=80',
    description: 'Industry study reveals contactless digital tableside ordering encourages impulse appetizers, dessert add-ons, and higher tip percentages.',
    content: 'Visual menus with high-resolution photos give diners clarity and confidence, resulting in higher item counts per table.',
    category: 'Technology',
    sourceName: 'Nation\'s Restaurant News',
    readTime: '4 min read',
    featured: false,
    status: 'active',
    viewsCount: 390,
    order: 11
  },
  {
    title: 'Wholesale Food Price Volatility: Strategies Top Independent Diners Use to Protect Margins',
    type: 'news',
    url: 'https://www.restaurantbusinessonline.com/financing/how-restaurants-fight-food-cost-inflation',
    thumbnail: 'https://images.unsplash.com/photo-1498837167922-ddd27525d352?w=800&q=80',
    description: 'Key insights on managing dairy, poultry, and seasonal produce fluctuations through dynamic seasonal boards and smart ingredient cross-utilization.',
    content: 'How top restaurateurs recalculate plate costs quarterly and substitute volatile produce without compromising signature flavors.',
    category: 'Cost Reduction',
    sourceName: 'Restaurant Business Online',
    readTime: '5 min read',
    featured: false,
    status: 'active',
    viewsCount: 247,
    order: 12
  },
  {
    title: 'Diner Loyalty Trends: Why Automated Personalized Rewards Beat Blanket Discounts',
    type: 'news',
    url: 'https://modernrestaurantmanagement.com/loyalty-retention-trends/',
    thumbnail: 'https://images.unsplash.com/photo-1525610553991-2bede1a236e2?w=800&q=80',
    description: 'Why 80% of repeat restaurant revenue comes from the top 20% of frequent diners, and how digital order loyalty drives second-visit return rates.',
    content: 'Instead of generic discounts that erode margin, send targeted celebratory perks and surprise bounce-back rewards within 14 days.',
    category: 'Customer Retention',
    sourceName: 'Modern Restaurant Management',
    readTime: '6 min read',
    featured: false,
    status: 'active',
    viewsCount: 221,
    order: 13
  },
  {
    title: 'Consumer Dining Report: Why Fast Turnaround and Visual Menus Win Over Gen Z',
    type: 'news',
    url: 'https://www.qsrmagazine.com/consumer-trends/fast-casual-dining-habits-2026/',
    thumbnail: 'https://images.unsplash.com/photo-1565299585323-38d6b0865b47?w=800&q=80',
    description: 'Survey of 5,000 diners shows 74% prefer digital visual menus with high-resolution food photos over plain text paper menus.',
    content: 'Guests eat with their eyes first. Restaurants adopting high-resolution dish imagery see noticeable boosts in premium beverage and side dish orders.',
    category: 'Marketing',
    sourceName: 'QSR Magazine',
    readTime: '5 min read',
    featured: false,
    status: 'active',
    viewsCount: 168,
    order: 14
  },

  // ---------------------------------------------------------------------------
  // Social Media & Marketing Playbooks
  // ---------------------------------------------------------------------------
  {
    title: '10 Viral Instagram Reels & TikTok Ideas That Pack Restaurant Tables on Weeknights',
    type: 'social',
    url: 'https://www.instagram.com/reel/trending-food-hacks',
    thumbnail: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=800&q=80',
    description: 'Sizzling cheese pulls, flame sears, sauce pours, and chef prep: simple, repeatable 7-second reel hooks that generate local footfall.',
    content: 'Step-by-step visual templates, trending audio strategies, and location tag secrets to get into the Explore feeds of nearby foodies.',
    category: 'Marketing',
    platform: 'Instagram',
    sourceName: 'Instagram Food Creators',
    readTime: 'Action Playbook',
    featured: false,
    status: 'active',
    viewsCount: 512,
    order: 15
  },
  {
    title: 'The Google Business Profile Ranking Playbook for Local Cafes & Restaurants',
    type: 'social',
    url: 'https://support.google.com/business/answer/3038177',
    thumbnail: 'https://images.unsplash.com/photo-1559339352-11d035aa65de?w=800&q=80',
    description: 'How to rank in the coveted Google Maps Top 3 Local Pack for "best cafe near me" by boosting review velocity, photo updates, and live menus.',
    content: 'Setting primary and secondary categories, embedding your live digital menu link, and automating review requests after every verified dine-in.',
    category: 'Marketing',
    platform: 'Google Maps',
    sourceName: 'Local SEO Playbook',
    readTime: '10 min guide',
    featured: false,
    status: 'active',
    viewsCount: 433,
    order: 16
  },
  {
    title: 'Running Hyper-Local Meta & Instagram Ads on a $10/Day Budget to Drive Weekend Diners',
    type: 'social',
    url: 'https://www.facebook.com/business/industries/restaurant',
    thumbnail: 'https://images.unsplash.com/photo-1514933651103-005eec06c04b?w=800&q=80',
    description: 'Targeting people within a 3-mile radius of your restaurant with enticing Friday evening specials and direct table booking links.',
    content: 'Pinpoint radius targeting, ad scheduling to run only Thursday to Saturday from 3 PM to 7 PM, and compelling carousel ad formats.',
    category: 'Marketing',
    platform: 'Facebook',
    sourceName: 'Meta Business Guide',
    readTime: '8 min guide',
    featured: false,
    status: 'active',
    viewsCount: 289,
    order: 17
  },
  {
    title: 'Food Photography & Lighting Hacks Using an iPhone for Restaurant Staff',
    type: 'social',
    url: 'https://www.tiktok.com/tag/restaurantmarketing',
    thumbnail: 'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=800&q=80',
    description: 'Natural window lighting, 45-degree angle framing, and steam captures that make your signature dishes look appetizing and drive cravings.',
    content: 'Quick guide for kitchen managers and servers to capture crisp daily story updates on smartphones without professional camera equipment.',
    category: 'Marketing',
    platform: 'TikTok',
    sourceName: 'Food Styling Guide',
    readTime: '5 min guide',
    featured: false,
    status: 'active',
    viewsCount: 367,
    order: 18
  }
];

async function seed() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('Connected to MongoDB:', MONGO_URI);

    // Clear existing BizGrowth items
    await BizGrowth.deleteMany({});
    console.log('Cleared existing Biz Growth records.');

    // Insert new dummy resources
    const inserted = await BizGrowth.insertMany(sampleResources);
    console.log(`Successfully seeded ${inserted.length} Biz Growth resources!`);

    // Verify stats
    const stats = await BizGrowth.aggregate([
      {
        $group: {
          _id: '$type',
          count: { $sum: 1 }
        }
      }
    ]);
    console.log('Resource breakdown by type:', stats);

    process.exit(0);
  } catch (error) {
    console.error('Error seeding Biz Growth resources:', error);
    process.exit(1);
  }
}

seed();
