export function hasPermission(user: { role?: string; permissions?: string[] } | null, permission: string): boolean {
    if (!user) return false;
    if (user.role === 'admin') return true;
    return Boolean(user.permissions?.includes(permission));
}

export function hasAnyPermission(
    user: { role?: string; permissions?: string[] } | null,
    permissions: string[],
): boolean {
    return permissions.some((permission) => hasPermission(user, permission));
}
