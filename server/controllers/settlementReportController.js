
const mongoose = require('mongoose');
const PDFDocument = require('pdfkit');

const User = require('../models/User');
const Group = require('../models/Group');
const Expense = require('../models/Expense');

const calculateGroupFinancials = require('../services/groupFinancialService');
const generateSettlementReport = require('../services/settlementReportService');

async function downloadSettlementReport(req, res) {
  let doc;

  try {
    const { groupId } = req.params;

    if (!mongoose.isValidObjectId(groupId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid group ID.',
      });
    }

    const user = await User.findOne({
      firebaseUid: req.user.uid,
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User profile not found.',
      });
    }

    // Verify that the requesting user belongs to this group.
    const group = await Group.findOne({
      _id: groupId,
      members: user._id,
    }).populate('members', 'name email');

    if (!group) {
      return res.status(404).json({
        success: false,
        message: 'Group not found or you are not a member.',
      });
    }

    const expenses = await Expense.find({
      groupId: group._id,
    })
      .sort({ createdAt: 1 })
      .populate([
        { path: 'paidBy', select: 'name email' },
        { path: 'contributions.user', select: 'name email' },
        { path: 'splits.user', select: 'name email' },
      ]);

    const financials = calculateGroupFinancials(group, expenses);

    // Validate financial consistency before starting the PDF response.
    const totalSpent = expenses.reduce(
      (sum, expense) => sum + expense.amount,
      0
    );

    const totalPaid = financials.balances.reduce(
      (sum, member) => sum + member.totalPaid,
      0
    );

    const totalShare = financials.balances.reduce(
      (sum, member) => sum + member.totalShare,
      0
    );

    const totalNetBalance = financials.balances.reduce(
      (sum, member) => sum + member.netBalance,
      0
    );

    if (
      totalSpent !== totalPaid ||
      totalSpent !== totalShare ||
      totalNetBalance !== 0
    ) {
      return res.status(422).json({
        success: false,
        message: 'Financial data is inconsistent. Report cannot be generated.',
      });
    }

    // Keep pages available so PDFKit can add page numbers later.
    doc = new PDFDocument({
      size: 'A4',
      margin: 0,
      autoFirstPage: true,
      bufferPages: true,
    });

    const safeGroupName = group.name
      .replace(/[^a-z0-9-_]/gi, '-')
      .replace(/-+/g, '-')
      .slice(0, 60);

    res.setHeader('Content-Type', 'application/pdf');

    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${safeGroupName}-settlement-report.pdf"`
    );

    res.setHeader('Cache-Control', 'private, no-store');

    doc.on('error', (error) => {
      console.error('PDF generation stream error:', error);

      if (!res.destroyed) {
        res.destroy(error);
      }
    });

    doc.pipe(res);

    generateSettlementReport(doc, group, expenses, financials);

    doc.end();
  } catch (error) {
    console.error('Download settlement report error:', error);

    if (doc && !doc.destroyed) {
      doc.destroy();
    }

    if (!res.headersSent && !res.destroyed) {
      return res.status(500).json({
        success: false,
        message: 'Unable to generate settlement report.',
      });
    }

    if (!res.destroyed) {
      res.destroy(error);
    }
  }
}

module.exports = {
  downloadSettlementReport,
};
