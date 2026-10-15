/**
 * Creates an Administrator account (FR-13/14). Admins are not
 * self-registered through /api/auth/register, so use this instead:
 *
 *   node scripts/createAdmin.js "Admin Name" admin@example.com 'Password123'
 */
import "dotenv/config";
import mongoose from "mongoose";
import { connectDB } from "../src/config/db.js";
import User from "../src/models/User.js";
import { UserFactory } from "../src/lib/userFactory.js";
import { isValidEmail, isStrongPassword } from "../src/lib/validators.js";

const [name, email, password] = process.argv.slice(2);

if (!name || !isValidEmail(email) || !isStrongPassword(password)) {
  console.error('Usage: node scripts/createAdmin.js "Name" email@example.com Password123');
  console.error("Password: at least 8 characters with a letter and a number.");
  process.exit(1);
}

await connectDB();
try {
  if (await User.findOne({ email: email.toLowerCase() })) {
    console.error(`An account with ${email} already exists.`);
    process.exitCode = 1;
  } else {
    const admin = await UserFactory.create("admin", { name, email, password });
    console.log(`Admin created: ${admin.email} (${admin._id})`);
  }
} finally {
  await mongoose.disconnect();
}
