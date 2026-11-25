const crypto = require('crypto');
const Staff = require('../models/Staff');
const Restaurant = require('../models/Restaurant');
const User = require('../models/User');
const sendEmail = require('../utils/sendEmail');

const ROLE_NAMES = {
  admin: 'Restaurant Admin',
  manager: 'Floor Manager',
  kitchen: 'Kitchen Staff / Chef',
  waiter: 'Waiter / Captain',
  cashier: 'Cashier / Billing',
  custom: 'Custom Role',
};

const ALL_PERMISSIONS = [
  'orders_view', 'orders_manage', 'table_sessions',
  'menu_view', 'menu_manage', 'menu_availability',
  'tables_view', 'tables_manage',
  'portal_handler', 'table_games', 'waiter_handler',
  'offers_manage', 'reviews_manage', 'biz_growth',
  'billing_settle', 'gst_reports', 'staff_manage',
];

/**
 * GET /api/restaurant/staff
 * Returns all real staff members for the restaurant, including the restaurant owner/admin.
 * Zero dummy data.
 */
exports.getStaff = async (req, res) => {
  try {
    const restaurantId = req.user.restaurantId;
    if (!restaurantId) {
      return res.status(400).json({ success: false, message: 'Restaurant ID missing' });
    }

    const [restaurant, staffList] = await Promise.all([
      Restaurant.findById(restaurantId).lean(),
      Staff.find({ restaurantId }).sort({ createdAt: -1 }).lean(),
    ]);

    // Build the Owner record from the real restaurant / user
    const ownerMember = {
      _id: `owner-${restaurantId}`,
      id: `owner-${restaurantId}`,
      name: restaurant?.admin?.name || req.user.name || 'Restaurant Admin',
      email: restaurant?.admin?.email || req.user.email,
      phone: restaurant?.admin?.phone || req.user.phone || '',
      roleId: 'admin',
      roleName: 'Restaurant Admin',
      status: 'active',
      isOwner: true,
      permissions: ALL_PERMISSIONS,
      invitedAt: restaurant?.createdAt || new Date(),
      activatedAt: restaurant?.createdAt || new Date(),
      lastLoginAt: req.user.lastLoginAt || new Date(),
    };

    // Formatted list: Real Owner first, followed by real staff members
    const formattedStaff = [
      ownerMember,
      ...staffList.map((m) => ({
        ...m,
        id: String(m._id),
      })),
    ];

    return res.status(200).json({
      success: true,
      data: formattedStaff,
    });
  } catch (error) {
    console.error('getStaff error:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch staff members', error: error.message });
  }
};

/**
 * POST /api/restaurant/staff/invite
 * Invites a new staff member and dispatches real activation email via SMTP.
 */
exports.inviteStaff = async (req, res) => {
  try {
    const restaurantId = req.user.restaurantId;
    const { name, email, phone, roleId = 'manager', permissions = [] } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: 'Name is required' });
    }
    if (!email || !email.trim()) {
      return res.status(400).json({ success: false, message: 'Email is required' });
    }

    const cleanEmail = email.trim().toLowerCase();

    // Check if member already exists in this restaurant
    const existing = await Staff.findOne({ restaurantId, email: cleanEmail });
    if (existing) {
      return res.status(400).json({
        success: false,
        message: `A staff member with email "${cleanEmail}" already exists in this restaurant.`,
      });
    }

    const restaurant = await Restaurant.findById(restaurantId).lean();
    const restaurantName = restaurant?.name || 'Your Restaurant';

    // Generate secure token & 7 days expiry
    const token = crypto.randomBytes(24).toString('hex');
    const tokenExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const roleName = ROLE_NAMES[roleId] || 'Staff Member';

    const newStaff = await Staff.create({
      restaurantId,
      name: name.trim(),
      email: cleanEmail,
      phone: (phone || '').replace(/\D/g, ''),
      roleId,
      roleName,
      status: 'pending_activation',
      permissions,
      activationToken: token,
      tokenExpiresAt,
      invitedAt: new Date(),
      isOwner: false,
    });

    // Build real activation URL
    const mainDomain = process.env.FRONTEND_URL || 'http://localhost:3000';
    const activationUrl = `${mainDomain}/setup-password?token=${token}&email=${encodeURIComponent(cleanEmail)}`;

    // Send real invitation email via SMTP
    let emailSent = false;
    let emailError = null;

    try {
      const emailHtml = `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 16px; background-color: #ffffff;">
          <div style="margin-bottom: 24px; border-bottom: 1px solid #e2e8f0; padding-bottom: 16px;">
            <h2 style="color: #0f172a; margin: 0 0 6px 0; font-size: 20px;">Staff Invitation from ${restaurantName}</h2>
            <p style="color: #64748b; font-size: 13px; margin: 0;">Tablly Restaurant Operating System</p>
          </div>
          
          <p style="color: #334155; font-size: 14px; line-height: 1.6;">Hello <strong>${name.trim()}</strong>,</p>
          
          <p style="color: #334155; font-size: 14px; line-height: 1.6;">
            You have been invited by the restaurant administrator to join <strong>${restaurantName}</strong> as a <strong>${roleName}</strong> on the Tablly platform.
          </p>

          <p style="color: #334155; font-size: 14px; line-height: 1.6;">
            Please click the button below to accept your invitation and activate your staff login:
          </p>

          <div style="text-align: center; margin: 32px 0;">
            <a href="${activationUrl}" style="background-color: #f97316; color: #ffffff; padding: 14px 28px; text-decoration: none; border-radius: 10px; font-weight: bold; font-size: 14px; display: inline-block;">
              Activate Staff Account
            </a>
          </div>

          <div style="background-color: #f8fafc; border-radius: 8px; padding: 12px 16px; margin-top: 24px; border: 1px solid #e2e8f0;">
            <p style="color: #64748b; font-size: 12px; margin: 0; line-height: 1.5;">
              <strong>Note:</strong> This activation link is valid for 7 days. If the button above does not work, copy and paste this link into your browser:<br/>
              <span style="color: #f97316; word-break: break-all;">${activationUrl}</span>
            </p>
          </div>

          <div style="margin-top: 32px; border-top: 1px solid #f1f5f9; padding-top: 16px; text-align: center;">
            <p style="color: #94a3b8; font-size: 11px; margin: 0;">
              &copy; ${new Date().getFullYear()} Tablly. All rights reserved.
            </p>
          </div>
        </div>
      `;

      await sendEmail({
        email: cleanEmail,
        subject: `Invitation to join ${restaurantName} on Tablly`,
        html: emailHtml,
      });

      emailSent = true;
      console.log(`[Staff Invite] Email successfully dispatched to ${cleanEmail}`);
    } catch (err) {
      console.error(`[Staff Invite] Failed to dispatch email to ${cleanEmail}:`, err.message);
      emailError = err.message;
    }

    return res.status(201).json({
      success: true,
      message: emailSent
        ? `Invitation email successfully sent to ${cleanEmail}`
        : `Staff member created, but email failed: ${emailError || 'SMTP error'}`,
      emailSent,
      data: {
        ...newStaff.toObject(),
        id: String(newStaff._id),
      },
    });
  } catch (error) {
    console.error('inviteStaff error:', error);
    return res.status(500).json({ success: false, message: 'Failed to invite staff member', error: error.message });
  }
};

/**
 * POST /api/restaurant/staff/:id/resend
 * Resends activation email to a pending staff member.
 */
exports.resendActivation = async (req, res) => {
  try {
    const restaurantId = req.user.restaurantId;
    const { id } = req.params;

    const staffMember = await Staff.findOne({ _id: id, restaurantId });
    if (!staffMember) {
      return res.status(404).json({ success: false, message: 'Staff member not found' });
    }

    const restaurant = await Restaurant.findById(restaurantId).lean();
    const restaurantName = restaurant?.name || 'Your Restaurant';

    // Generate fresh token
    const token = crypto.randomBytes(24).toString('hex');
    const tokenExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    staffMember.activationToken = token;
    staffMember.tokenExpiresAt = tokenExpiresAt;
    staffMember.status = 'pending_activation';
    staffMember.invitedAt = new Date();
    await staffMember.save();

    const mainDomain = process.env.FRONTEND_URL || 'http://localhost:3000';
    const activationUrl = `${mainDomain}/setup-password?token=${token}&email=${encodeURIComponent(staffMember.email)}`;

    let emailSent = false;
    let emailError = null;

    try {
      const emailHtml = `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 16px; background-color: #ffffff;">
          <h2 style="color: #0f172a; margin: 0 0 12px 0;">New Activation Link for ${restaurantName}</h2>
          <p style="color: #334155; font-size: 14px;">Hello <strong>${staffMember.name}</strong>,</p>
          <p style="color: #334155; font-size: 14px;">Here is your refreshed activation link to join ${restaurantName} on Tablly:</p>
          <div style="text-align: center; margin: 28px 0;">
            <a href="${activationUrl}" style="background-color: #f97316; color: #ffffff; padding: 14px 28px; text-decoration: none; border-radius: 10px; font-weight: bold; font-size: 14px; display: inline-block;">
              Activate Staff Account
            </a>
          </div>
          <p style="color: #64748b; font-size: 12px;">This link is valid for 7 days.</p>
        </div>
      `;

      await sendEmail({
        email: staffMember.email,
        subject: `New Activation Link: Join ${restaurantName} on Tablly`,
        html: emailHtml,
      });

      emailSent = true;
    } catch (err) {
      console.error('Failed to resend activation email:', err.message);
      emailError = err.message;
    }

    return res.status(200).json({
      success: true,
      message: emailSent
        ? `Fresh activation email sent to ${staffMember.email}`
        : `Activation token refreshed, but email sending failed: ${emailError}`,
      emailSent,
      data: {
        ...staffMember.toObject(),
        id: String(staffMember._id),
      },
    });
  } catch (error) {
    console.error('resendActivation error:', error);
    return res.status(500).json({ success: false, message: 'Failed to resend activation email', error: error.message });
  }
};

/**
 * PUT /api/restaurant/staff/:id
 * Updates role, permissions, name, or phone of an existing staff member.
 */
exports.updateStaff = async (req, res) => {
  try {
    const restaurantId = req.user.restaurantId;
    const { id } = req.params;
    const { name, email, phone, roleId, permissions } = req.body;

    const staffMember = await Staff.findOne({ _id: id, restaurantId });
    if (!staffMember) {
      return res.status(404).json({ success: false, message: 'Staff member not found' });
    }

    if (name) staffMember.name = name.trim();
    if (phone !== undefined) staffMember.phone = (phone || '').replace(/\D/g, '');
    if (roleId) {
      staffMember.roleId = roleId;
      staffMember.roleName = ROLE_NAMES[roleId] || staffMember.roleName;
    }
    if (permissions && Array.isArray(permissions)) {
      staffMember.permissions = permissions;
    }

    await staffMember.save();

    return res.status(200).json({
      success: true,
      message: `Staff member updated successfully`,
      data: {
        ...staffMember.toObject(),
        id: String(staffMember._id),
      },
    });
  } catch (error) {
    console.error('updateStaff error:', error);
    return res.status(500).json({ success: false, message: 'Failed to update staff member', error: error.message });
  }
};

/**
 * PATCH /api/restaurant/staff/:id/status
 * Toggles status between 'active' and 'inactive'.
 */
exports.toggleStaffStatus = async (req, res) => {
  try {
    const restaurantId = req.user.restaurantId;
    const { id } = req.params;

    const staffMember = await Staff.findOne({ _id: id, restaurantId });
    if (!staffMember) {
      return res.status(404).json({ success: false, message: 'Staff member not found' });
    }

    const nextStatus = staffMember.status === 'active' ? 'inactive' : 'active';
    staffMember.status = nextStatus;
    await staffMember.save();

    return res.status(200).json({
      success: true,
      message: `Staff member status updated to ${nextStatus}`,
      status: nextStatus,
      data: {
        ...staffMember.toObject(),
        id: String(staffMember._id),
      },
    });
  } catch (error) {
    console.error('toggleStaffStatus error:', error);
    return res.status(500).json({ success: false, message: 'Failed to toggle status', error: error.message });
  }
};

/**
 * DELETE /api/restaurant/staff/:id
 * Removes a staff member from the roster.
 */
exports.deleteStaff = async (req, res) => {
  try {
    const restaurantId = req.user.restaurantId;
    const { id } = req.params;

    const deleted = await Staff.findOneAndDelete({ _id: id, restaurantId });
    if (!deleted) {
      return res.status(404).json({ success: false, message: 'Staff member not found' });
    }

    return res.status(200).json({
      success: true,
      message: `Staff member removed from roster`,
    });
  } catch (error) {
    console.error('deleteStaff error:', error);
    return res.status(500).json({ success: false, message: 'Failed to delete staff member', error: error.message });
  }
};
