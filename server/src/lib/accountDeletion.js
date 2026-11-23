import mongoose from "mongoose";
import User from "../models/User.js";
import Application from "../models/Application.js";
import Feedback from "../models/Feedback.js";
import MentorLink from "../models/MentorLink.js";

/**
 * FR-15 account deletion: removes a user and everything that belongs to
 * them, as one unit.
 *
 * - Applicant: their applications (notes and stage history live inside
 *   each application), all feedback left on those applications, and every
 *   mentor link they created.
 * - Mentor: every link to them (accepted, pending or revoked, matched by
 *   id or by invited email) and all feedback they wrote.
 * - Admin: only the account itself.
 *
 * On MongoDB Atlas (a replica set) this runs inside a transaction, so it
 * is all-or-nothing. On a standalone server without transaction support
 * it falls back to deleting the dependent data first and the user last:
 * if anything fails midway the account still exists and the same request
 * can simply be retried.
 */
async function deleteEverything(user, session) {
  const opts = session ? { session } : {};
  const id = user._id;

  if (user.role === "applicant") {
    const apps = await Application.find({ owner: id }, "_id", opts);
    const appIds = apps.map((a) => a._id);
    await Feedback.deleteMany({ applicationId: { $in: appIds } }, opts);
    await Application.deleteMany({ owner: id }, opts);
    await MentorLink.deleteMany({ applicant: id }, opts);
  } else if (user.role === "mentor") {
    await Feedback.deleteMany({ mentorId: id }, opts);
    await MentorLink.deleteMany({ $or: [{ mentor: id }, { mentorEmail: user.email }] }, opts);
  }

  await User.deleteOne({ _id: id }, opts);
}

let transactionsSupported; // cached after the first check

// Transactions need a replica set (Atlas always is one) or a sharded
// cluster (mongos). A standalone server, or FerretDB, has neither.
async function supportsTransactions() {
  if (transactionsSupported === undefined) {
    const hello = await mongoose.connection.db.admin().command({ hello: 1 });
    transactionsSupported = Boolean(hello.setName) || hello.msg === "isdbgrid";
  }
  return transactionsSupported;
}

export async function deleteAccount(user) {
  if (!(await supportsTransactions())) {
    await deleteEverything(user, null);
    return;
  }
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(() => deleteEverything(user, session));
  } finally {
    await session.endSession();
  }
}

/** True if at least one other admin account would remain after removing `userId`. */
export async function anotherAdminExists(userId) {
  return (await User.countDocuments({ role: "admin", _id: { $ne: userId } })) > 0;
}
