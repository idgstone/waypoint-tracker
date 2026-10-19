export function filterAdminUsers(users, search) {
  const query = search.trim().toLowerCase();
  return users.filter((user) => user.name.toLowerCase().includes(query) || user.email.toLowerCase().includes(query));
}
