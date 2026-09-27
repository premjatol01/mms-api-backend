const Lead = require('../models/Lead');

// Get all leads with pagination, search, and filters
exports.getLeads = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const query = {};

    // Text search (if implementing text index, otherwise regex)
    if (req.query.search) {
      const searchRegex = new RegExp(req.query.search, 'i');
      query.$or = [
        { restaurantName: searchRegex },
        { contactPerson: searchRegex },
        { phone: searchRegex },
        { email: searchRegex },
        { 'address.city': searchRegex }
      ];
    }

    if (req.query.stage) {
      query.stage = req.query.stage;
    }

    if (req.query.status) {
      query.status = req.query.status;
    }

    if (req.query.city) {
      query['address.city'] = new RegExp(req.query.city, 'i');
    }

    if (req.query.converted) {
      if (req.query.converted === 'converted') {
        query.stage = 'converted';
      } else if (req.query.converted === 'not_converted') {
        query.stage = { $ne: 'converted' };
      }
    }

    if (req.query.dateRange) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      let startDate;
      if (req.query.dateRange === 'today') {
        startDate = today;
      } else if (req.query.dateRange === 'this_week') {
        startDate = new Date(today);
        startDate.setDate(startDate.getDate() - 7);
      } else if (req.query.dateRange === 'this_month') {
        startDate = new Date(today);
        startDate.setMonth(startDate.getMonth() - 1);
      }
      
      if (startDate) {
        query.createdAt = { $gte: startDate };
      }
    }

    const leads = await Lead.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Lead.countDocuments(query);

    res.json({
      leads,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching leads', error: error.message });
  }
};

// Get single lead
exports.getLead = async (req, res) => {
  try {
    const lead = await Lead.findById(req.params.id);
    if (!lead) {
      return res.status(404).json({ message: 'Lead not found' });
    }
    res.json(lead);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching lead', error: error.message });
  }
};

// Create new lead
exports.createLead = async (req, res) => {
  try {
    const leadData = req.body;
    
    // Add initial activity
    leadData.activity = [{
      date: new Date(),
      action: "Lead created"
    }];

    const lead = new Lead(leadData);
    await lead.save();
    
    res.status(201).json(lead);
  } catch (error) {
    res.status(400).json({ message: 'Error creating lead', error: error.message });
  }
};

// Update lead
exports.updateLead = async (req, res) => {
  try {
    const updateData = req.body;
    
    const lead = await Lead.findById(req.params.id);
    if (!lead) {
      return res.status(404).json({ message: 'Lead not found' });
    }

    // Add activity if status changed
    if (updateData.status && updateData.status !== lead.status) {
      if (!updateData.activity) updateData.activity = lead.activity || [];
      updateData.activity.push({
        date: new Date(),
        action: `Status changed to ${updateData.status === 'active' ? 'Active' : 'Inactive'}`
      });
    }

    // Add activity if notes updated
    if (updateData.notes !== undefined && updateData.notes !== lead.notes) {
      if (!updateData.activity) updateData.activity = lead.activity || [];
      updateData.activity.push({
        date: new Date(),
        action: "Notes updated"
      });
    }

    const updatedLead = await Lead.findByIdAndUpdate(req.params.id, updateData, { new: true });
    res.json(updatedLead);
  } catch (error) {
    res.status(400).json({ message: 'Error updating lead', error: error.message });
  }
};

// Change lead stage
exports.changeStage = async (req, res) => {
  try {
    const { stage } = req.body;
    
    const lead = await Lead.findById(req.params.id);
    if (!lead) {
      return res.status(404).json({ message: 'Lead not found' });
    }

    // Add to activity log
    const activity = lead.activity || [];
    const formattedStage = stage.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    
    activity.push({
      date: new Date(),
      action: `Stage changed to ${formattedStage}`
    });

    lead.stage = stage;
    lead.activity = activity;
    
    await lead.save();
    res.json(lead);
  } catch (error) {
    res.status(400).json({ message: 'Error updating lead stage', error: error.message });
  }
};

// Toggle status
exports.toggleStatus = async (req, res) => {
  try {
    const lead = await Lead.findById(req.params.id);
    if (!lead) {
      return res.status(404).json({ message: 'Lead not found' });
    }

    const newStatus = lead.status === 'active' ? 'inactive' : 'active';
    
    const activity = lead.activity || [];
    activity.push({
      date: new Date(),
      action: `Status changed to ${newStatus === 'active' ? 'Active' : 'Inactive'}`
    });

    lead.status = newStatus;
    lead.activity = activity;
    
    await lead.save();
    res.json(lead);
  } catch (error) {
    res.status(400).json({ message: 'Error toggling lead status', error: error.message });
  }
};

// Convert lead to restaurant
exports.convertLead = async (req, res) => {
  try {
    const { restaurantId } = req.body;
    
    const lead = await Lead.findById(req.params.id);
    if (!lead) {
      return res.status(404).json({ message: 'Lead not found' });
    }

    // Since it's converted to a restaurant, remove it from the leads module completely.
    await Lead.findByIdAndDelete(req.params.id);
    
    res.json({ message: 'Lead successfully converted and removed', restaurantId });
  } catch (error) {
    res.status(400).json({ message: 'Error converting lead', error: error.message });
  }
};
