import bcrypt from "bcryptjs";
import User from "../models/User.js";

/**
 * Factory Method pattern (per the team's Design Patterns UML doc).
 *
 * UserCreator declares the factory method buildUser(); each role has its
 * own concrete creator that decides the role-specific defaults. Callers
 * (register route, createAdmin script) only ask UserFactory for a role
 * and never need to know those defaults. Adding a new role means adding
 * one creator class, not editing every place that creates users.
 */
class UserCreator {
  /** Factory method: subclasses return the role-specific user fields. */
  // eslint-disable-next-line no-unused-vars
  buildUser({ name, email, passwordHash }) {
    throw new Error("buildUser() must be implemented by a concrete creator.");
  }

  async create({ name, email, password }) {
    const passwordHash = await bcrypt.hash(password, 10);
    const fields = this.buildUser({
      name: name.trim(),
      email: email.trim().toLowerCase(),
      passwordHash,
    });
    return User.create(fields);
  }
}

class ApplicantCreator extends UserCreator {
  buildUser(base) {
    return {
      ...base,
      role: "applicant",
      notificationPreferences: { deadlineReminders: true, mentorFeedback: true },
    };
  }
}

class MentorCreator extends UserCreator {
  buildUser(base) {
    // Mentors don't own applications, so deadline reminders don't apply.
    return {
      ...base,
      role: "mentor",
      notificationPreferences: { deadlineReminders: false, mentorFeedback: false },
    };
  }
}

class AdminCreator extends UserCreator {
  buildUser(base) {
    return {
      ...base,
      role: "admin",
      notificationPreferences: { deadlineReminders: false, mentorFeedback: false },
    };
  }
}

const creators = {
  applicant: new ApplicantCreator(),
  mentor: new MentorCreator(),
  admin: new AdminCreator(),
};

export const UserFactory = {
  /** Returns the concrete creator for a role; throws on an unknown role. */
  forRole(role) {
    const creator = creators[role];
    if (!creator) throw new Error(`Unknown role: ${role}`);
    return creator;
  },

  create(role, data) {
    return this.forRole(role).create(data);
  },
};
